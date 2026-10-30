import {changeVolume, createBackup, nextAlbum, nextTrack, playPause, prevAlbum, prevTrack, resetLibrary, setPlaylist,
  updateLibrary, updateTime, updateTrack} from './redux/actions';
import {Album, Artist, Genre, LibraryInfo, LibraryState, Playlist, Track, TrackInfo} from './redux/actionTypes';
import djActivity from './dj/activity';
import './App.css';
import {publishCatalog} from './backup/catalog';
import {runCloudBackup} from './backup/cloudBackup';
import {BACKUP_TIME, DATA_DIR} from './constants';
import {setPlaybackState, setTransportHandlers, updateNowPlaying} from './mediaSession';
import {MUSIC_BACKUP_START_DELAY, runMusicBackup} from './backup/musicBackup';

/** How often at most to push the DJ transcript to the mobile app while a reply streams. */
const DJ_STATE_THROTTLE = 200;
import {ipcRenderer} from 'electron';
import EmptyPlaylist from './playlist/EmptyPlaylist';
import {createLibrary} from './library/itunes';
import {deleteLibrary, loadLibrary} from './library/main';
import runWikiExtension from './extensions/wiki/main';
import runGeniusExtension from './extensions/genius/main';
import runMusicBrainzExtension from './extensions/musicbrainz/main';
import MaxWindow from './MaxWindow';
import MiniWindow from './MiniWindow';
import RandomAlbumPlaylist from './playlist/RandomAlbumPlaylist';
import * as React from 'react';
import {connect} from 'react-redux';
import {applyReaction, Reaction, toggleReaction} from './reactions';
import {
  getAlbumsByIds,
  getAllAlbumIds,
  getAllArtistIds,
  getAllTrackIds,
  getArtistsByIds,
  getCurrentTrack,
  getGenresByIds,
  getIsPlaying,
  getQueueVersion,
  getSetTime,
  getSyncedPlaylists,
  getTrackById,
  getVolume,
} from './redux/selectors';
import djSession, {MCP_TOOLS, OWNER} from './dj/session';
import {RootState} from './redux/store';
import {noteQueueActor} from './dj/tools';

/** Remote clients may name the person who pressed the button; the desktop and Android don't. */
interface RemoteActor {
  speaker?: string;
}

function actorOf(data?: RemoteActor): string {
  return (data && data.speaker) || OWNER;
}

interface StateProps {
  queueVersion: number;
  volume: number;
  track?: Track;
  playing: boolean;
  setTime?: number;
  getArtistsByIds(artistIds: string[]): Artist[];
  getAlbumsByIds(albumIds: string[]): Album[];
  getGenresByIds(genreIds: string[]): Genre[];
  runWikiExtension(albumIds: string[], artistIds: string[]): PromiseLike<LibraryInfo>;
  runGeniusExtension(trackIds: string[]): PromiseLike<LibraryInfo>;
  runMusicBrainzExtension(albumIds: string[], artistIds: string[]): PromiseLike<LibraryInfo>;
  getAllTrackIds(): string[];
  getAllAlbumIds(): string[];
  getAllArtistIds(): string[];
  getSyncedPlaylists(): Playlist[];
  getTrackById(trackId: string): Track;
}

interface DispatchProps {
  changeVolume(volume: number): void;
  updateTime(time: number): void;
  updateLibrary(library: LibraryInfo): void;
  createBackup(): void;
  resetLibrary(library: LibraryInfo): void;
  nextTrack(): void;
  prevAlbum(): void;
  prevTrack(): void;
  setPlaylist(playlist: EmptyPlaylist, play: boolean): void;
  playPause(): void;
  nextAlbum(): void;
  updateTrack(id: string, info: TrackInfo): void;
}

type AppProps = DispatchProps & StateProps;

interface AppState {
  mini: boolean;
}

class App extends React.Component<AppProps, AppState> {
  private audio: HTMLAudioElement;
  private djStateTimer?: number;
  private backupTimer?: number;
  /**
   * The file currently loaded into the audio element.
   *
   * Tracked explicitly rather than compared against the previous render's path: when the same
   * file plays twice in a row the path does not change, so a path comparison never reloads it
   * — and `ended` has already blanked `src`, so playback stops dead with nothing to restart it.
   */
  private loadedPath?: string;

  constructor(props: AppProps) {
    super(props);

    this.backupTimer = undefined;

    this.state = {
      mini: false,
    };
    ipcRenderer.on('minimize-reply', () => {
      this.onMinimize();
    });
    ipcRenderer.on('maximize-reply', () => {
      this.onMaximize();
    });
    ipcRenderer.on('toAlbum', () => {
      this.onMaximize();
    });
    ipcRenderer.on('toArtist', () => {
      this.onMaximize();
    });
    ipcRenderer.on('toTrack', () => {
      this.onMaximize();
    });
    // Remote transport can come from either phone; name the sender so a skip is attributed to
    // them rather than to whoever happens to be at the desktop.
    ipcRenderer.on('nextTrack', (evt, data?: RemoteActor) => {
      noteQueueActor(actorOf(data));
      this.props.nextTrack();
    });
    ipcRenderer.on('prevAlbum', (evt, data?: RemoteActor) => {
      noteQueueActor(actorOf(data));
      this.props.prevAlbum();
    });
    ipcRenderer.on('prevTrack', (evt, data?: RemoteActor) => {
      noteQueueActor(actorOf(data));
      this.props.prevTrack();
    });
    ipcRenderer.on('playTrack', () => {
      this.props.playPause();
    });
    ipcRenderer.on('nextAlbum', (evt, data?: RemoteActor) => {
      noteQueueActor(actorOf(data));
      this.props.nextAlbum();
    });
    ipcRenderer.on('favoriteTrack', () => {
      if (!this.props.track) {
        return;
      }
      const favorites = this.props.track.favorites.slice();
      const year = new Date().getFullYear();
      const index = favorites.indexOf(year);
      if (index === -1) {
        favorites.push(year);
      } else {
        favorites.splice(index, 1);
      }
      this.props.updateTrack(this.props.track.id, {favorites});
      this.sendControllerUpdate();
    });
    ipcRenderer.on('setTime', (evt, data) => {
      this.audio.currentTime = data;
    });
    ipcRenderer.on('setVolume', (evt, volume) => {
      this.props.changeVolume(volume);
    });
    ipcRenderer.on('get-synced-playlists', (evt, plays) => {
      Object.keys(plays).forEach((trackId) => {
        const track = this.props.getTrackById(trackId);
        if (track && plays[trackId]) {
          this.props.updateTrack(track.id, {
            playCount: track.playCount + plays[trackId],
            playDate: new Date(),
          });
        }
      });
      ipcRenderer.send('synced-playlists', {playlists: this.props.getSyncedPlaylists()});
    });
    ipcRenderer.on('dj-message', (evt, payload: string | {text: string; speaker?: string}) => {
      // The Android app sends a bare string and is always the owner; the web app names itself.
      if (typeof payload === 'string') {
        djSession.send(payload);
      } else if (payload && payload.text) {
        djSession.send(payload.text, payload.speaker || OWNER);
      }
    });
    ipcRenderer.on('dj-react', (evt, payload: {trackId?: string; reaction?: Reaction; speaker?: string}) => {
      const trackId = payload && payload.trackId;
      if (!trackId) {
        return;
      }
      const track = this.props.getTrackById(trackId);
      if (!track) {
        return;
      }
      const person = actorOf(payload);
      const year = new Date().getFullYear();
      // pressing the same verdict again clears it, so one button both sets and unsets
      const next = toggleReaction(track, person, payload.reaction || 'none', year);
      this.props.updateTrack(trackId, {reactions: applyReaction(track, person, next, year)});
      djSession.noteReaction(trackId, person, next);
    });
    ipcRenderer.on('dj-remove', (evt, payload: {trackIds?: string[]; albumId?: string; speaker?: string}) => {
      if (payload) {
        djSession.removeFromQueue(payload.trackIds || [], payload.albumId, actorOf(payload));
      }
    });
    ipcRenderer.on('dj-new-session', () => {
      djSession.reset();
    });
    ipcRenderer.on('dj-sync', () => {
      ipcRenderer.send('dj-state', djSession.getChatState());
    });
    // Streaming emits on every delta; coalesce so the phone gets smooth updates, not a flood.
    djSession.subscribe(() => this.pushDJState());
    ipcRenderer.on('dj-get-tools', () => {
      ipcRenderer.send('dj-tools', MCP_TOOLS);
    });
    ipcRenderer.on('dj-run-tool', (evt, req: {id: number; name: string; input: Record<string, unknown>}) => {
      ipcRenderer.send(`dj-tool-result-${req.id}`, djSession.runExternalTool(req.name, req.input));
    });
    ipcRenderer.on('get-track', (evt, trackId) => {
      const data = this.props.getTrackById(trackId);
      ipcRenderer.send('get-track-' + trackId, data);
    });
    ipcRenderer.on('get-game-tracks', () => {
      const gameTracks = this.props.getAllTrackIds().map((trackId) => {
        const track = this.props.getTrackById(trackId);
        const artist = this.props.getArtistsByIds(track.artistIds)
          .map((artistData) => artistData.name).join(', ');
        const genres = this.props.getGenresByIds(track.genreIds)
          .filter(Boolean).map((genre) => genre.name);
        const album = this.props.getAlbumsByIds(track.albumIds)[0];
        return {
          artFile: album && album.albumArtFile,
          artist,
          duration: track.duration,
          filePath: track.filePath,
          genres,
          name: track.name,
          playCount: track.playCount,
          year: track.year,
        };
      });
      ipcRenderer.send('game-tracks', gameTracks);
    });
    ipcRenderer.on('get-artist', (evt, artistId) => {
      const artist = this.props.getArtistsByIds([artistId])[0];
      ipcRenderer.send('get-artist-' + artistId, artist);
    });
    ipcRenderer.on('get-album', (evt, albumId) => {
      const album = this.props.getAlbumsByIds([albumId])[0];
      ipcRenderer.send('get-album-' + albumId, album);
    });
    ipcRenderer.on('run-extension', (type: {}, arg: string) => {
      switch (arg) {
      case 'wikipedia':
        this.props.runWikiExtension(this.props.getAllAlbumIds(), this.props.getAllArtistIds())
          .then((library) => {
            this.props.updateLibrary(library);
          });
        break;
      case 'genius':
        this.props.runGeniusExtension(this.props.getAllTrackIds()).then((library: LibraryInfo) => {
          this.props.updateLibrary(library);
        });
        break;
      case 'musicbrainz':
        this.props.runMusicBrainzExtension(this.props.getAllAlbumIds(), this.props.getAllArtistIds())
          .then((library) => {
            this.props.updateLibrary(library);
          });
        break;
      default:
        break;
      }
    });
    ipcRenderer.on('reset-library', () => {
      deleteLibrary().then(() => {
        createLibrary().then((library: LibraryState) => {
          this.props.resetLibrary(library);
          const playlist = new RandomAlbumPlaylist(Object.values(library.albums));
          this.props.setPlaylist(playlist, /* play= */ false);
          alert('Library uploaded');
        });
      });
    });
    ipcRenderer.send('extension-ready');

    loadLibrary(`${DATA_DIR}/library.json`).then((library: LibraryState) => {
      const playlist = new RandomAlbumPlaylist(Object.values(library.albums));
      this.props.updateLibrary(library);
      this.props.setPlaylist(playlist, /* play= */ false);
    }).catch((err: NodeJS.ErrnoException) => {
      if (err && err.code !== 'ENOENT') {
        // The library exists but could not be read - a locked file, a permissions problem, a
        // half-written save. Importing a fresh one would overwrite it, so stop and say so.
        const reason = err.code || err.message;
        alert(`Could not read your library (${reason}).

Nothing has been changed. Restart the app to try again; backups are in ${DATA_DIR}/backups.`);
        return;
      }
      createLibrary().then((library) => {
        const playlist = new RandomAlbumPlaylist(Object.values(library.albums));
        this.props.resetLibrary(library);
        this.props.setPlaylist(playlist, /* play= */ false);
      });
    });

    this.audio = new Audio();
    this.audio.volume = this.props.volume;
    // lets the macOS media keys, the menu-bar card and an AirPlay receiver's remote drive us
    setTransportHandlers({
      next: () => this.props.nextTrack(),
      pause: () => this.props.playPause(),
      play: () => this.props.playPause(),
      previous: () => this.props.prevTrack(),
    });
    this.audio.addEventListener('timeupdate', () => {
      this.props.updateTime(this.audio.currentTime);
      this.sendControllerUpdate();
    });
    this.audio.addEventListener('ended', () => {
      const track = this.props.track;
      if (track) {
        this.props.updateTrack(track.id, {
          playCount: track.playCount + 1,
          playDate: new Date(),
        });
      }
      this.audio.src = '';
      this.loadedPath = undefined;
      this.props.nextTrack();
    });
  }

  sendControllerUpdate(): void {
    const artists = this.props.track ? this.props.getArtistsByIds(this.props.track.artistIds) : [];
    const albums = this.props.track ? this.props.getAlbumsByIds(this.props.track.albumIds) : [];
    ipcRenderer.send('controller-state', {
      track: this.props.track,
      artists: artists,
      albums: albums,
      currentTime: this.audio.currentTime,
      mediaState: {
        paused: this.audio.paused,
        volume: this.audio.volume,
      },
    });
  }

  componentDidMount(): void {
    this.backupTimer = window.setInterval(() => {
      this.props.createBackup();
      this.cloudBackup();
      this.musicBackup();
    }, BACKUP_TIME);
    // the local backups only protect against this app; an offsite copy is what survives the
    // laptop, so try once at launch rather than waiting a full day for the first tick
    this.cloudBackup();
    // the music sweep is cheap when it is not due and expensive when it is, so hold it back
    // until the window has settled rather than competing with first paint
    window.setTimeout(() => this.musicBackup(), MUSIC_BACKUP_START_DELAY);
  }

  componentWillUnmount(): void {
    clearInterval(this.backupTimer);
  }

  public componentDidUpdate(prevProps: AppProps): void {
    if (prevProps.queueVersion !== this.props.queueVersion || prevProps.track !== this.props.track ||
        prevProps.playing !== this.props.playing) {
      // Keeps the phone's now-playing and queue in step; pushDJState is throttled.
      this.pushDJState();
    }
    if (this.audio.volume !== this.props.volume) {
      this.audio.volume = this.props.volume;
    }
    if (prevProps.track !== this.props.track) {
      this.updateNowPlayingCard();
    }
    if (prevProps.playing !== this.props.playing) {
      setPlaybackState(this.props.playing);
    }
    const path = this.props.track && this.props.track.filePath;
    if (path && path !== this.loadedPath) {
      this.audio.src = new URL(path).toString();
      this.loadedPath = path;
    }
    if (this.props.setTime !== undefined) {
      this.audio.currentTime = this.props.setTime;
    }
    if (this.props.playing && this.audio.paused && !this.audio.ended) {
      this.audio.play().catch(() => {});
    } else if (!this.props.playing) {
      this.audio.pause();
    }
  }

  public render(): JSX.Element {
    const mini = this.state.mini;
    // both kept on so that the subscriptions in max window stay, otherwise
    // message comes in before max window gets reattached
    // fix this better?
    return (
      <div>
        <div style={{display: mini ? 'initial' : 'none'}}>
          <MiniWindow />
        </div>
        <div style={{display: mini ? 'none' : 'initial'}}>
          <MaxWindow />
        </div>
      </div>
    );
  }

  /**
   * Pushes the current track to the OS now-playing card.
   *
   * Shares the artist/album lookups the phone controller already does. The art path is the
   * album's own file, so a track with no art simply shows none rather than a stale cover.
   */
  private updateNowPlayingCard(): void {
    const track = this.props.track;
    if (!track) {
      updateNowPlaying(undefined);
      return;
    }
    const artists = this.props.getArtistsByIds(track.artistIds);
    const albums = this.props.getAlbumsByIds(track.albumIds);
    updateNowPlaying({
      album: albums.length ? albums[0].name : '',
      artFile: albums.length ? albums[0].albumArtFile : undefined,
      artist: artists.map((artist) => artist.name).join(', '),
      title: track.name,
    });
  }

  /** Offsite copy of the irreplaceable files. Silent unless something actually went wrong. */
  private cloudBackup(): void {
    runCloudBackup().then((outcome) => {
      if (outcome.error) {
        // tslint:disable-next-line no-console
        console.error(`Cloud backup failed: ${outcome.error}`);
      } else if (outcome.uploaded && outcome.uploaded.length) {
        // tslint:disable-next-line no-console
        console.log(`Cloud backup uploaded ${outcome.uploaded.join(', ')}`);
      }
    });
  }

  /**
   * Offsite copy of the audio itself, fortnightly.
   *
   * Bounded per run, so this is a top-up for albums added since last time rather than a bulk
   * sync - the first ~163GB belongs to `scripts/backup-music.js`. A run that leaves files
   * behind is worth saying out loud: it is the only signal that the library is outgrowing what
   * the background job can keep up with.
   */
  private musicBackup(): void {
    runMusicBackup().then((outcome) => {
      if (outcome.error) {
        // tslint:disable-next-line no-console
        console.error(`Music backup failed: ${outcome.error}`);
        return;
      }
      if (outcome.uploaded) {
        // tslint:disable-next-line no-console
        console.log(`Music backup uploaded ${outcome.uploaded} file(s), ` +
          `${(outcome.bytes / 1048576).toFixed(0)}MB`);
      }
      if (outcome.pending) {
        // tslint:disable-next-line no-console
        console.log(`Music backup: ${outcome.pending} file(s) still to upload; ` +
          'it will continue tomorrow, or run scripts/backup-music.js to catch up in one go.');
      }
      // the manifest has just changed, which is exactly what the catalog is derived from
      this.publishStreamCatalog();
    });
  }

  /**
   * Publishes the index the streaming service reads.
   *
   * Runs after the music backup because it lists only what the manifest confirms is uploaded,
   * so publishing before would understate what the phone can play by a day.
   */
  private publishStreamCatalog(): void {
    publishCatalog().then((outcome) => {
      if (outcome.error) {
        // tslint:disable-next-line no-console
        console.error(`Catalog publish failed: ${outcome.error}`);
      } else if (outcome.object) {
        // tslint:disable-next-line no-console
        console.log(`Published stream catalog: ${outcome.count} track(s)`);
      }
    });
  }

  private setTime(time: number): void {
    this.audio.currentTime = time / 1000;
  }

  private onMaximize(): void {
    djActivity.noteListenerInput();
    this.setState({mini: false});
  }

  private pushDJState(): void {
    if (this.djStateTimer !== undefined) {
      return;
    }
    this.djStateTimer = window.setTimeout(() => {
      this.djStateTimer = undefined;
      ipcRenderer.send('dj-state', djSession.getChatState());
    }, DJ_STATE_THROTTLE);
  }

  private onMinimize(): void {
    djActivity.noteListenerInput();
    this.setState({mini: true});
  }

}

function mapStateToProps(store: RootState): StateProps {
  const track = getCurrentTrack(store);
  return {
    playing: getIsPlaying(store),
    runWikiExtension: (albumIds: string[], artistIds: string[]) => runWikiExtension(albumIds, artistIds, store),
    runGeniusExtension: (trackIds: string[]) => runGeniusExtension(store, trackIds),
    runMusicBrainzExtension: (albumIds: string[], artistIds: string[]) =>
      runMusicBrainzExtension(albumIds, artistIds, store),
    queueVersion: getQueueVersion(store),
    setTime: getSetTime(store),
    track,
    volume: getVolume(store),
    getSyncedPlaylists: () => getSyncedPlaylists(store),
    getAllArtistIds: () => getAllArtistIds(store),
    getAllAlbumIds: () => getAllAlbumIds(store),
    getAllTrackIds: () => getAllTrackIds(store),
    getArtistsByIds: (artistIds) => getArtistsByIds(store, artistIds),
    getAlbumsByIds: (albumIds) => getAlbumsByIds(store, albumIds),
    getGenresByIds: (genreIds) => getGenresByIds(store, genreIds),
    getTrackById: (trackId) => getTrackById(store, trackId),
  };
}

export default connect(mapStateToProps, {changeVolume, updateTime, playPause, updateLibrary, resetLibrary, nextTrack,
  prevAlbum, prevTrack, setPlaylist, updateTrack, nextAlbum, createBackup})(App);
