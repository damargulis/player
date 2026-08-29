import EmptyPlaylist from './EmptyPlaylist';

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

  constructor(seedTrackId?: string) {
    super();
    this.history = [];
    this.upcoming = seedTrackId ? [{id: seedTrackId}] : [];
    this.current = -1;
  }

  public getCurrentTrack(): string | undefined {
    const entry = this.history[this.current];
    return entry && entry.id;
  }

  public nextTrack(): string | undefined {
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

  public prevTrack(): string | undefined {
    if (this.current > 0) {
      this.current--;
    }
    return this.getCurrentTrack();
  }

  /** Skips the rest of the current queued album (or just this track if it wasn't queued as an album). */
  public nextAlbum(): string | undefined {
    const albumId = this.currentAlbumId();
    if (albumId !== undefined && this.current === this.history.length - 1) {
      while (this.upcoming.length && this.upcoming[0].albumId === albumId) {
        this.upcoming.shift();
      }
    }
    return this.nextTrack();
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
    return this.getCurrentTrack();
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

  private currentAlbumId(): string | undefined {
    const entry = this.history[this.current];
    return entry && entry.albumId;
  }

  /** Everything after the current position: forward history (after a prev) plus the queue. */
  private forwardEntries(): QueueEntry[] {
    return this.history.slice(this.current + 1).concat(this.upcoming);
  }

  private setEntries(entries: QueueEntry[]): void {
    this.history = this.history.slice(0, this.current + 1);
    this.upcoming = entries;
  }
}
