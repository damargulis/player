import EmptyPlaylist from './EmptyPlaylist';

/** How the queue last moved, so the DJ can tell a track skip from a whole-album rejection. */
/** Marks a queue move as the DJ's own rather than a listener's. */
export const DJ_ACTOR = 'dj';

export interface QueueTransition {
  kind: 'next-track' | 'next-album' | 'prev-track' | 'prev-album';
  /** Tracks dropped from the queue because the rest of an album was skipped. */
  dropped: string[];
  /** The album whose remainder was dropped. */
  albumId?: string;
  /**
   * Who caused it: DJ_ACTOR when the DJ advanced the queue itself, otherwise the listener's
   * name. Undefined when nothing announced itself, which means whoever is at the desktop.
   */
  actor?: string;
}

export interface QueueEntry {
  id: string;
  /** Set when the track was queued as part of a whole album; drives the skip/prev-album buttons. */
  albumId?: string;
}

/**
 * A queue driven by the DJ (Claude). `history` holds every track that has been
 * reached so far (the current one is at `current`); `upcoming` is what plays
 * next and can be rewritten at any time without touching the current track.
 */
export default class DJPlaylist extends EmptyPlaylist {
  private history: QueueEntry[];
  private upcoming: QueueEntry[];
  private current: number;
  private transition?: QueueTransition;
  private pendingActor?: string;

  constructor(seedTrackId?: string) {
    super();
    this.history = [];
    this.upcoming = seedTrackId ? [{id: seedTrackId}] : [];
    this.current = -1;
  }

  /**
   * Starts the queue already positioned on `trackId`, inheriting `upcoming`. Used when the DJ
   * takes over mid-playback: nothing is re-selected, so the audio element is never disturbed.
   */
  public adopt(trackId: string, upcoming: string[]): void {
    this.history = [{id: trackId}];
    this.current = 0;
    this.upcoming = upcoming.map((id) => ({id}));
  }

  public getCurrentTrack(): string | undefined {
    const entry = this.history[this.current];
    return entry && entry.id;
  }

  public nextTrack(): string | undefined {
    const next = this.advance();
    this.recordTransition({dropped: [], kind: 'next-track'});
    return next;
  }

  public prevTrack(): string | undefined {
    if (this.current > 0) {
      this.current--;
    }
    this.recordTransition({dropped: [], kind: 'prev-track'});
    return this.getCurrentTrack();
  }

  /** Skips the rest of the current queued album (or just this track if it wasn't queued as an album). */
  public nextAlbum(): string | undefined {
    const albumId = this.currentAlbumId();
    const dropped: string[] = [];
    if (albumId !== undefined && this.current === this.history.length - 1) {
      while (this.upcoming.length && this.upcoming[0].albumId === albumId) {
        const entry = this.upcoming.shift();
        if (entry) {
          dropped.push(entry.id);
        }
      }
    }
    const next = this.advance();
    this.recordTransition({albumId, dropped, kind: 'next-album'});
    return next;
  }

  /** Jumps back to the first track of the current queued album. */
  public prevAlbum(): string | undefined {
    const albumId = this.currentAlbumId();
    if (albumId === undefined) {
      return this.prevTrack();
    }
    while (this.current > 0 && this.history[this.current - 1].albumId === albumId) {
      this.current--;
    }
    this.recordTransition({albumId, dropped: [], kind: 'prev-album'});
    return this.getCurrentTrack();
  }

  /**
   * Names whoever is about to move the queue, so the feedback can say who skipped rather than
   * just that someone did. Pass DJ_ACTOR for the DJ's own skip_current, so it isn't misread as
   * the listener rejecting the track.
   */
  public noteActor(actor: string): void {
    this.pendingActor = actor;
  }

  /** Reads and clears how the queue last moved. */
  public consumeTransition(): QueueTransition | undefined {
    const transition = this.transition;
    this.transition = undefined;
    return transition;
  }

  public hasNextTrack(): boolean {
    return this.upcoming.length > 0 || this.current < this.history.length - 1;
  }

  public hasPrevTrack(): boolean {
    return this.current > 0;
  }

  public hasNextAlbum(): boolean {
    return this.currentAlbumId() !== undefined && this.hasNextTrack();
  }

  public hasPrevAlbum(): boolean {
    const albumId = this.currentAlbumId();
    return albumId !== undefined && this.current > 0 && this.history[this.current - 1].albumId === albumId;
  }

  /** Tracks that will play after the current one, in order. */
  public getUpcoming(): string[] {
    return this.forwardEntries().map((entry) => entry.id);
  }

  /** Like getUpcoming, but with album tags — lets the queue UI group whole-album runs. */
  public getUpcomingEntries(): QueueEntry[] {
    return this.forwardEntries().map((entry) => Object.assign({}, entry));
  }

  /** The entry for the current track, album tag included. */
  public getCurrentEntry(): QueueEntry | undefined {
    const entry = this.history[this.current];
    return entry && Object.assign({}, entry);
  }

  /** Tracks played so far in this session, oldest first, including the current one. */
  public getHistory(): string[] {
    return this.history.slice(0, this.current + 1).map((entry) => entry.id);
  }

  /** Replaces everything after the current track with untagged (non-album) tracks. */
  public setUpcoming(trackIds: string[]): void {
    this.setEntries(trackIds.map((id) => ({id})));
  }

  public addUpcoming(trackIds: string[], position: 'next' | 'end'): void {
    const added = trackIds.map((id) => ({id}));
    const existing = this.forwardEntries();
    this.setEntries(position === 'next' ? added.concat(existing) : existing.concat(added));
  }

  /** Queues a whole album's tracks, in order, tagged so the album transport buttons work on them. */
  public addAlbum(trackIds: string[], albumId: string, position: 'next' | 'end'): void {
    const added: QueueEntry[] = trackIds.map((id) => ({albumId, id}));
    const existing = this.forwardEntries();
    this.setEntries(position === 'next' ? added.concat(existing) : existing.concat(added));
  }

  public removeUpcoming(trackIds: string[]): void {
    this.setEntries(this.forwardEntries().filter((entry) => !trackIds.includes(entry.id)));
  }

  /** Moves to the next track without recording a transition; callers do that. */
  private advance(): string | undefined {
    if (this.current < this.history.length - 1) {
      // Navigating forward again after going back.
      this.current++;
      return this.getCurrentTrack();
    }
    const next = this.upcoming.shift();
    if (next === undefined) {
      // Queue is dry: playback stops until the DJ refills.
      return undefined;
    }
    this.history.push(next);
    this.current++;
    return next.id;
  }

  private recordTransition(transition: QueueTransition): void {
    this.transition = Object.assign({}, transition, {actor: this.pendingActor});
    this.pendingActor = undefined;
  }

  private currentAlbumId(): string | undefined {
    const entry = this.history[this.current];
    return entry && entry.albumId;
  }

  /** Everything after the current position: forward history (after a prev) plus the queue. */
  private forwardEntries(): QueueEntry[] {
    return this.history.slice(this.current + 1).concat(this.upcoming);
  }

  /**
   * Replaces what plays next, dropping the track that is already playing if it leads the list.
   *
   * The DJ reads the queue, thinks, then writes — and the song can end in between. The list it
   * writes was built when the next track was still *next*, so by the time it lands that track
   * is playing and ends up queued behind itself: shown twice, then played twice. Only a
   * *leading* duplicate is dropped, so deliberately re-queueing something later still works.
   */
  private setEntries(entries: QueueEntry[]): void {
    this.history = this.history.slice(0, this.current + 1);
    const currentId = this.getCurrentTrack();
    this.upcoming = entries.length && currentId !== undefined && entries[0].id === currentId
      ? entries.slice(1)
      : entries;
  }
}
