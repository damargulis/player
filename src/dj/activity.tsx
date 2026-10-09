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

  constructor() {
    store.subscribe(() => this.onStoreChange());
  }

  /** Call whenever the listener does something deliberate: a message, a skip, a queue edit. */
  public noteListenerInput(): void {
    this.lastInputAt = Date.now();
  }

  public getStatus(): Record<string, unknown> {
    return {
      idleSeconds: this.lastInputAt === undefined ? null : Math.round((Date.now() - this.lastInputAt) / 1000),
      pausedSeconds: this.pausedSince === undefined ? null : Math.round((Date.now() - this.pausedSince) / 1000),
    };
  }

  /** One line for the DJ, or '' when there is nothing notable to say. */
  public describe(): string {
    const parts: string[] = [];
    if (this.pausedSince !== undefined) {
      parts.push(`Paused for ${humanDuration(Date.now() - this.pausedSince)}`);
    }
    if (this.lastInputAt !== undefined) {
      parts.push(`last listener input ${humanDuration(Date.now() - this.lastInputAt)} ago`);
    } else {
      parts.push('no listener input yet this session');
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
