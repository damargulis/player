import {djQueueUpdated} from './redux/actions';
import {Album, Track} from './redux/actionTypes';
import {apiKeyHelp, getApiKey} from './dj/api';
import ArtImg from './ArtImg';
import './DJPage.css';
import DJPlaylist, {QueueEntry} from './playlist/DJPlaylist';
import {shell} from 'electron';
import EmptyPlaylist from './playlist/EmptyPlaylist';
import {getMemoryStore, MemoryFile} from './dj/memory';
import defaultAlbum from './resources/missing_album.png';
import React from 'react';
import {connect} from 'react-redux';
import {getAlbumById, getArtistsByIds, getCurrentTrackId, getQueueVersion, getTrackById} from './redux/selectors';
import session, {DJSessionState, OWNER, TranscriptEntry, VERBOSE_ROLES} from './dj/session';
import {speakerColor, speakerTint} from './dj/speakerColor';
import {RootState} from './redux/store';
import {toTime} from './utils';

interface StateProps {
  playlist: EmptyPlaylist;
  currentTrackId?: string;
  queueVersion: number;
  getTrackById(id: string): Track;
  getAlbumById(id: string): Album;
  getArtistNames(ids: string[]): string;
}

interface DispatchProps {
  djQueueUpdated(): void;
}

type DJPageProps = StateProps & DispatchProps;

interface DJPageState extends DJSessionState {
  draft: string;
  memoryFiles: MemoryFile[];
  showMemory: boolean;
  verbose: boolean;
}

class DJPage extends React.Component<DJPageProps, DJPageState> {
  private unsubscribe?: () => void;
  private transcriptRef = React.createRef<HTMLDivElement>();

  constructor(props: DJPageProps) {
    super(props);
    this.state = Object.assign({draft: '', memoryFiles: [], showMemory: false, verbose: false},
      session.getState());
  }

  public componentDidMount(): void {
    this.unsubscribe = session.subscribe(() => {
      this.setState(Object.assign({memoryFiles: readMemoryFiles()}, session.getState()), () => this.scrollToBottom());
    });
    this.setState({memoryFiles: readMemoryFiles()});
  }

  public componentWillUnmount(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
    }
  }

  public render(): JSX.Element {
    return (
      <div className="main dj-page">
        {this.renderChat()}
        {this.state.showMemory ? this.renderMemory() : this.renderQueue()}
      </div>
    );
  }

  private renderChat(): JSX.Element {
    const hasKey = Boolean(getApiKey());
    return (
      <div className="dj-chat">
        <div className="dj-chat-header">
          <span>{session.isActive() ? 'DJ is controlling the queue' : 'DJ is idle'}</span>
          <span>
            <label className="dj-verbose-toggle" title="Show the DJ's reasoning and every tool call">
              <input
                type="checkbox"
                checked={this.state.verbose}
                onChange={(evt) => this.setState({verbose: evt.target.checked}, () => this.scrollToBottom())}
              />
              Verbose
            </label>
            {' '}
            <button onClick={() => this.toggleMemory()}>
              {this.state.showMemory ? 'Show queue' : `Memory (${this.state.memoryFiles.length})`}
            </button>
            {' '}
            <button onClick={() => session.reset()} disabled={this.state.busy || !this.state.entries.length}>
              New session
            </button>
          </span>
        </div>
        <div className="dj-transcript" ref={this.transcriptRef}>
          {this.visibleEntries().length ? this.renderTranscript() : (
            <div className="dj-empty">
              {hasKey ? (
                <>
                  Tell the DJ what you're doing or how you feel — "rainy Sunday morning", "focus music, no vocals",
                  "getting ready to go out". Keep chatting to steer it; the current song keeps playing while the
                  queue changes.
                </>
              ) : (
                <>No Anthropic API key found. {apiKeyHelp()}</>
              )}
            </div>
          )}
          {this.state.busy && (
            <div className="dj-thinking">
              <span className="dj-thinking-text">{this.state.note || 'Digging through the crates'}</span>
              <span className="dj-dots" aria-hidden="true"><i /><i /><i /></span>
            </div>
          )}
        </div>
        <div className="dj-input">
          <textarea
            value={this.state.draft}
            placeholder={hasKey ? 'What should we listen to?' : 'Add ANTHROPIC_API_KEY to use the DJ'}
            disabled={!hasKey}
            onChange={(evt) => this.setState({draft: evt.target.value})}
            onKeyDown={(evt) => this.onKeyDown(evt)}
          />
          <button onClick={() => this.submit()} disabled={!hasKey || !this.state.draft.trim()}>Send</button>
        </div>
      </div>
    );
  }

  /** Names go on messages only once a second person has joined the conversation. */
  private renderTranscript(): JSX.Element[] {
    const entries = this.visibleEntries();
    const speakers: string[] = [];
    entries.forEach((entry) => {
      if (entry.speaker && speakers.indexOf(entry.speaker) < 0) {
        speakers.push(entry.speaker);
      }
    });
    // Label anyone who is not the owner, always. The original rule only labelled once two
    // people had spoken, which meant a guest chatting on their own appeared anonymous — the
    // one case where knowing who is talking matters most.
    const manySpeakers = speakers.length > 1;
    return entries.map((entry) => this.renderEntry(
      entry, Boolean(entry.speaker) && (manySpeakers || entry.speaker !== OWNER)));
  }

  private visibleEntries(): TranscriptEntry[] {
    if (this.state.verbose) {
      return this.state.entries;
    }
    return this.state.entries.filter((entry) => !VERBOSE_ROLES.includes(entry.role));
  }

  private renderEntry(entry: TranscriptEntry, showSpeaker: boolean): JSX.Element {
    // Each person keeps the same colour everywhere, derived from their name.
    const tinted = entry.role === 'user' && entry.speaker
      ? {background: speakerTint(entry.speaker), borderColor: speakerColor(entry.speaker)}
      : undefined;
    return (
      <div key={entry.id} className={`dj-entry ${entry.role}`} style={tinted}>
        {showSpeaker && entry.speaker &&
          <div className="dj-entry-speaker" style={{color: speakerColor(entry.speaker)}}>{entry.speaker}</div>}
        <div className="dj-entry-text">{entry.text}</div>
        {entry.detail !== undefined && this.state.verbose &&
          <pre className="dj-entry-detail">{entry.detail}</pre>}
      </div>
    );
  }

  private renderQueue(): JSX.Element {
    const playlist = this.props.playlist;
    if (!(playlist instanceof DJPlaylist)) {
      return (
        <div className="dj-queue">
          <div className="dj-queue-section">Queue</div>
          <div className="dj-queue-empty">The DJ takes over the queue once you send a message.</div>
        </div>
      );
    }
    const history = playlist.getHistory();
    const earlier = history.slice(0, -1);
    const current = playlist.getCurrentEntry();
    const upcoming = playlist.getUpcomingEntries();
    return (
      <div className="dj-queue">
        <div className="dj-queue-list">
          {earlier.length > 0 && <div className="dj-queue-section">Played</div>}
          {earlier.map((id, i) => this.renderRow(id, `h${i}`, 'history'))}
          <div className="dj-queue-section">Now playing</div>
          {current ? (
            <>
              {current.albumId !== undefined &&
                this.renderAlbumHeader(current.albumId, 'now', this.albumProgress(current, earlier, upcoming))}
              {this.renderRow(current.id, 'now', 'now', undefined, current.albumId !== undefined)}
            </>
          ) : <div className="dj-queue-empty">Nothing playing yet.</div>}
          <div className="dj-queue-section">Up next ({upcoming.length})</div>
          {upcoming.length ? this.renderUpcoming(upcoming, current) :
            <div className="dj-queue-empty">Queue is empty.</div>}
        </div>
      </div>
    );
  }

  /** "track m of n" for the album run the current track belongs to. */
  private albumProgress(current: QueueEntry, earlier: string[], upcoming: QueueEntry[]): string {
    const playlist = this.props.playlist as DJPlaylist;
    const played = playlist.getHistory();
    let before = 0;
    for (let i = played.length - 2; i >= 0; i--) {
      // Count the current album's already-played run right behind us.
      const track = this.props.getTrackById(played[i]);
      if (!track || !current.albumId || !track.albumIds.includes(current.albumId)) {
        break;
      }
      before++;
    }
    let after = 0;
    while (after < upcoming.length && upcoming[after].albumId === current.albumId) {
      after++;
    }
    return `track ${before + 1} of ${before + 1 + after}`;
  }

  /** Renders upcoming entries, folding consecutive same-album runs under an album header. */
  private renderUpcoming(entries: QueueEntry[], current?: QueueEntry): JSX.Element[] {
    const out: JSX.Element[] = [];
    let i = 0;
    while (i < entries.length) {
      const entry = entries[i];
      if (entry.albumId === undefined) {
        out.push(this.renderRow(entry.id, `u${i}`, 'upcoming', i + 1));
        i++;
        continue;
      }
      let end = i;
      while (end < entries.length && entries[end].albumId === entry.albumId) {
        end++;
      }
      const run = entries.slice(i, end);
      const continuing = i === 0 && current !== undefined && current.albumId === entry.albumId;
      const albumId = entry.albumId;
      out.push(this.renderAlbumHeader(albumId, `ua${i}`,
        continuing ? `${run.length} more track${run.length === 1 ? '' : 's'}` : `${run.length} tracks`,
        () => this.removeAlbum(albumId)));
      run.forEach((albumEntry, j) => {
        out.push(this.renderRow(albumEntry.id, `u${i + j}`, 'upcoming', i + j + 1, true));
      });
      i = end;
    }
    return out;
  }

  private renderAlbumHeader(albumId: string, key: string, detail: string, onRemove?: () => void): JSX.Element {
    const album = this.props.getAlbumById(albumId);
    if (!album) {
      return <div key={`ah-${key}`} className="dj-album-header">(unknown album)</div>;
    }
    const artist = this.props.getArtistNames(album.artistIds);
    return (
      <div key={`ah-${key}`} className={`dj-album-header ${key === 'now' ? 'now' : ''}`}>
        <ArtImg
          alt="album art"
          className="dj-album-art"
          fallback={defaultAlbum}
          file={album.albumArtFile}
          height="36"
          width="36"
        />
        <span className="meta">
          <div className="title">{album.name}</div>
          <div className="artist">{artist}{album.year ? ` · ${album.year}` : ''}</div>
        </span>
        <span className="detail">{key === 'now' ? `Album · ${detail}` : detail}</span>
        {onRemove && (
          <button className="remove" title="Remove the rest of this album" onClick={onRemove}>✕</button>
        )}
      </div>
    );
  }

  private removeAlbum(albumId: string): void {
    session.removeFromQueue([], albumId);
    this.props.djQueueUpdated();
  }

  private renderMemory(): JSX.Element {
    const files = this.state.memoryFiles;
    return (
      <div className="dj-queue dj-memory">
        <div className="dj-queue-section dj-memory-header">
          <span>What the DJ remembers</span>
          <button onClick={() => shell.openPath(getMemoryStore().rootDir)} title="Edit the notes in your own editor">
            Open folder
          </button>
        </div>
        <div className="dj-queue-list">
          {files.length ? files.map((file) => (
            <div key={file.path} className="dj-memory-file">
              <div className="dj-memory-path">{file.path.replace(/^\/memories\//, '')}</div>
              <pre className="dj-memory-body">{file.content}</pre>
            </div>
          )) : (
            <div className="dj-queue-empty">
              Nothing yet. Tell the DJ about yourself — who you are, what you and the people you listen with love or
              hate — and it will write notes here that persist across sessions. The files are plain markdown; edit or
              delete them freely.
            </div>
          )}
        </div>
      </div>
    );
  }

  private toggleMemory(): void {
    this.setState({memoryFiles: readMemoryFiles(), showMemory: !this.state.showMemory});
  }

  private renderRow(id: string, key: string, kind: 'history' | 'now' | 'upcoming', index?: number,
                    inAlbum?: boolean): JSX.Element {
    const track = this.props.getTrackById(id);
    if (!track) {
      return <div key={key} className="dj-queue-row">(missing track)</div>;
    }
    return (
      <div key={key} className={`dj-queue-row ${kind}${inAlbum ? ' in-album' : ''}`}>
        <span className="index">{kind === 'now' ? '▶' : index || ''}</span>
        <span className="meta">
          <div className="title">{track.name}</div>
          <div className="artist">{this.props.getArtistNames(track.artistIds)}</div>
        </span>
        <span className="length">{toTime(track.duration)}</span>
        {kind === 'upcoming' && (
          <button className="remove" title="Remove from queue" onClick={() => this.removeUpcoming(id)}>✕</button>
        )}
      </div>
    );
  }

  private removeUpcoming(id: string): void {
    session.removeFromQueue([id]);
    this.props.djQueueUpdated();
  }

  private onKeyDown(evt: React.KeyboardEvent<HTMLTextAreaElement>): void {
    if (evt.key === 'Enter' && !evt.shiftKey) {
      evt.preventDefault();
      this.submit();
    }
  }

  private submit(): void {
    const text = this.state.draft.trim();
    if (!text) {
      return;
    }
    this.setState({draft: ''});
    session.send(text, OWNER);
  }

  private scrollToBottom(): void {
    const el = this.transcriptRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }
}

function readMemoryFiles(): MemoryFile[] {
  try {
    return getMemoryStore().listFiles();
  } catch (err) {
    return [];
  }
}

function mapStateToProps(store: RootState): StateProps {
  return {
    currentTrackId: getCurrentTrackId(store),
    getAlbumById: (id: string) => getAlbumById(store, id),
    getArtistNames: (ids: string[]) => getArtistsByIds(store, ids).filter(Boolean).map((a) => a.name).join(', '),
    getTrackById: (id: string) => getTrackById(store, id),
    playlist: store.currentlyPlaying.playlist,
    queueVersion: getQueueVersion(store),
  };
}

export default connect(mapStateToProps, {djQueueUpdated})(DJPage);
