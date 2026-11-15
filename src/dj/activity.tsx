import DJPlaylist from '../playlist/DJPlaylist';
import store from '../redux/store';

/**
 * Tracks how long the room has been quiet: when the listener last did something, and how long
 * playback has been paused. The DJ reads this to tell "paused 90 minutes, nobody home" apart
 * from "skipped twice in five minutes", which matter very differently for whether to keep going.
 *
 * Lives apart from DJSession so the tool layer can read it without importing the session.
 */
class DJActivity {
  private lastInputAt?: number;
  private pausedSince?: number;
  private wasPlaying = false;
  private startedAt = Date.now();

  constructor() {
    store.subscribe(() => this.onStoreChange());
  }

  /** Call whenever the listener does something deliberate: a message, a skip, a queue edit. */
  public noteListenerInput(): void {
    this.lastInputAt = Date.now();
  }

  public getUptimeMs(): number {
    return Date.now() - this.startedAt;
  }

  public getStatus(): Record<string, unknown> {
    return {
      appOpenSeconds: Math.round(this.getUptimeMs() / 1000),
      idleSeconds: this.lastInputAt === undefined ? null : Math.round((Date.now() - this.lastInputAt) / 1000),
      pausedSeconds: this.pausedSince === undefined ? null : Math.round((Date.now() - this.pausedSince) / 1000),
    };
  }

  /**
   * One line for the DJ about the room.
   *
   * It used to report only "last listener input 48m ago", which the DJ read as an empty room
   * and wound the set down over — at a dinner party where every track was playing through to
   * the end. The number only ever counted time since someone *typed or pressed something*, and
   * saying so was the whole problem: silence in the chat is the normal state of a room where
   * music is working.
   *
   * So whether the music is actually running leads, and the quiet is named for what it is.
   */
  public describe(): string {
    const parts: string[] = [];
    const paused = this.pausedSince !== undefined;
    parts.push(paused
      ? `Playback paused for ${humanDuration(Date.now() - (this.pausedSince as number))}`
      : 'Music is playing');
    if (this.lastInputAt !== undefined) {
      parts.push(`nobody has typed or touched the controls for ${humanDuration(Date.now() - this.lastInputAt)}`);
    } else {
      parts.push('nobody has typed or touched the controls yet this session');
    }
    if (!paused) {
      parts.push('which is normal while a set is going well — it is not a sign of an empty room');
    }
    return parts.join(' · ');
  }

  private onStoreChange(): void {
    const state = store.getState();
    if (!(state.currentlyPlaying.playlist instanceof DJPlaylist)) {
      return;
    }
    const playing = state.currentlyPlaying.isPlaying;
    if (playing === this.wasPlaying) {
      return;
    }
    this.wasPlaying = playing;
    // A pause is a listener action; so is coming back.
    this.noteListenerInput();
    this.pausedSince = playing ? undefined : Date.now();
  }
}

export function humanDuration(ms: number): string {
  const minutes = Math.round(ms / 60000);
  if (minutes < 1) {
    return 'less than a minute';
  }
  if (minutes < 60) {
    return `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}

const activity = new DJActivity();
export default activity;
