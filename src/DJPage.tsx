import {djQueueUpdated} from './redux/actions';
import {Track} from './redux/actionTypes';
import {apiKeyHelp, getApiKey} from './dj/api';
import './DJPage.css';
import DJPlaylist from './playlist/DJPlaylist';
import {shell} from 'electron';
import EmptyPlaylist from './playlist/EmptyPlaylist';
import {getMemoryStore, MemoryFile} from './dj/memory';
import React from 'react';
import {connect} from 'react-redux';
import {getArtistsByIds, getCurrentTrackId, getQueueVersion, getTrackById} from './redux/selectors';
import session, {DJSessionState} from './dj/session';
import {RootState} from './redux/store';
import {toTime} from './utils';

interface StateProps {
  playlist: EmptyPlaylist;
  currentTrackId?: string;
  queueVersion: number;
  getTrackById(id: string): Track;
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
}

class DJPage extends React.Component<DJPageProps, DJPageState> {
  private unsubscribe?: () => void;
  private transcriptRef = React.createRef<HTMLDivElement>();

  constructor(props: DJPageProps) {
    super(props);
    this.state = Object.assign({draft: '', memoryFiles: [], showMemory: false}, session.getState());
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
          {this.state.entries.length ? this.state.entries.map((entry) => (
            <div key={entry.id} className={`dj-entry ${entry.role}`}>{entry.text}</div>
          )) : (
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
          {this.state.busy && <div className="dj-thinking">DJ is digging through the crates…</div>}
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
    const currentId = history[history.length - 1];
    const earlier = history.slice(0, -1);
    const upcoming = playlist.getUpcoming();
    return (
      <div className="dj-queue">
        <div className="dj-queue-list">
          {earlier.length > 0 && <div className="dj-queue-section">Played</div>}
          {earlier.map((id, i) => this.renderRow(id, `h${i}`, 'history'))}
          <div className="dj-queue-section">Now playing</div>
          {currentId ? this.renderRow(currentId, 'now', 'now') :
            <div className="dj-queue-empty">Nothing playing yet.</div>}
          <div className="dj-queue-section">Up next ({upcoming.length})</div>
          {upcoming.length ? upcoming.map((id, i) => this.renderRow(id, `u${i}`, 'upcoming', i + 1)) :
            <div className="dj-queue-empty">Queue is empty.</div>}
        </div>
      </div>
    );
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

  private renderRow(id: string, key: string, kind: 'history' | 'now' | 'upcoming', index?: number): JSX.Element {
    const track = this.props.getTrackById(id);
    if (!track) {
      return <div key={key} className="dj-queue-row">(missing track)</div>;
    }
    return (
      <div key={key} className={`dj-queue-row ${kind}`}>
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
    const playlist = this.props.playlist;
    if (playlist instanceof DJPlaylist) {
      playlist.removeUpcoming([id]);
      this.props.djQueueUpdated();
    }
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
    session.send(text);
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
    getArtistNames: (ids: string[]) => getArtistsByIds(store, ids).filter(Boolean).map((a) => a.name).join(', '),
    getTrackById: (id: string) => getTrackById(store, id),
    playlist: store.currentlyPlaying.playlist,
    queueVersion: getQueueVersion(store),
  };
}

export default connect(mapStateToProps, {djQueueUpdated})(DJPage);
