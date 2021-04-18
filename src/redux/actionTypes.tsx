import EmptyPlaylist from '../playlist/EmptyPlaylist';

export const SET_GENRES = 'SET_GENRES';
export const DELETE_ARTIST = 'DELETE_ARTIST';
export const DELETE_ALBUM = 'DELETE_ALBUM';
export const CREATE_BACKUP = 'CREATE_BACKUP';
export const SAVE_NEW_TRACKS = 'SAVE_NEW_TRACKS';
export const UPLOAD_FILES = 'UPLOAD_FILES';
export const UPDATE_TIME = 'UPDATE_TIME';
export const RESET_LIBRARY = 'RESET_LIBRARY';
export const ADD_TO_PLAYLIST = 'ADD_TO_PLAYLIST';
export const UPDATE_LIBRARY = 'UPDATE_LIBRARY';
export const CHANGE_VOLUME = 'CHANGE_VOLUME';
export const NEXT_TRACK = 'NEXT_TRACK';
export const SET_PLAYLIST = 'SET_PLAYLIST';
export const NEXT_ALBUM = 'NEXT_ALBUM';
export const UPDATE_ALBUM = 'UPDATE_ALBUM';
export const UPDATE_TRACK = 'UPDATE_TRACK';
export const UPDATE_ARTIST = 'UPDATE_ARTIST';
export const PREV_TRACK = 'PREV_TRACK';
export const PREV_ALBUM = 'PREV_ALBUM';
export const PLAY_PAUSE = 'PLAY_PAUSE';
export const SET_TIME = 'SET_TIME';

export interface Playlist {
  name: string;
  trackIds: string[];
}

export interface PlaylistInfo {
  name?: string;
  trackIds?: string[];
}

// TODO: should be able to use from metadata import, not here
export interface Metadata {
    artist: string[];
    album: string;
    albumartist: string[];
    title: string;
    year: string;
    track: NoOf;
    disk: NoOf;
    genre: string[];
    picture: Picture[];
    duration: number;
}
export interface Picture {
    format: string;
    data: Buffer;
}

export interface NoOf {
  no: number;
  of: number;
}

export interface Track {
  id: string;
  duration: number;
  playCount: number;
  playDate: Date;
  filePath: string;
  artistIds: string[];
  albumIds: string[];
  name: string;
  year: number;
  genreIds: string[];
  skipCount: number;
  dateAdded: Date;
  favorites: number[];
  genius?: {
    id: string;
    page: string;
    errors: string[];
  };
  warning?: TrackInfo;
}

export interface Artist {
  id: string;
  name: string;
  albumIds: string[];
  artFile?: string;
  errors: string[];
  wikiPage?: string;
  genreIds: string[];
  trackIds: string[];
}

// TODO(maybe): move all extension data into Record<string,JSON>
export interface Album {
  id: string;
  errors: string[];
  albumArtFile?: string;
  artistIds: string[];
  name: string;
  trackIds: string[];
  year: number;
  wikiPage?: string;
  genreIds: string[];
  playCount: number;
  skipCount: number;
  favorites: number[];
}

export interface Genre {
  name: string;
}

export interface GenreInfo {
  name?: string;
}

export interface LibraryState {
  tracks: Record<string, Track>;
  albums: Record<string, Album>;
  artists: Record<string, Artist>;
  playlists: Record<string, Playlist>;
  genres: Record<string, Genre>;
  newTracks: string[];
}

export interface LibraryInfo {
  tracks?: Record<string, TrackInfo>;
  albums?: Record<string, AlbumInfo>;
  artists?: Record<string, ArtistInfo>;
  playlists?: Record<string, PlaylistInfo>;
  genres?: Record<string, GenreInfo>;
  newTracks?: string[];
}

export interface CurrentlyPlayingState {
  time: number;
  volume: number;
  playlist: EmptyPlaylist;
  currentlyPlayingId?: string;
  isPlaying: boolean;
  setTime?: number;
}

export interface SettingsState {
  genres: string[];
}

interface SetGenresAction {
  type: typeof SET_GENRES;
  payload: SettingsState;
}

interface UpdateTimeAction {
  type: typeof UPDATE_TIME;
  payload: CurrentlyPlayingState;
}

interface VolumeChangeAction {
  type: typeof CHANGE_VOLUME;
  payload: CurrentlyPlayingState;
}

interface UpdateLibraryAction {
  type: typeof UPDATE_LIBRARY;
  payload: {library: LibraryInfo};
}

interface ResetLibraryAction {
  type: typeof RESET_LIBRARY;
  payload: {library: LibraryState};
}

interface NextTrackAction {
  type: typeof NEXT_TRACK;
}

interface NextAlbumAction {
  type: typeof NEXT_ALBUM;
}

interface PrevTrackAction {
  type: typeof PREV_TRACK;
}

interface PrevAlbumAction {
  type: typeof PREV_ALBUM;
}

interface SetPlaylistAction {
  type: typeof SET_PLAYLIST;
  payload: {
    playlist: EmptyPlaylist;
    play: boolean;
  };
}

interface PlayPauseAction {
  type: typeof PLAY_PAUSE;
}

interface SetTimeAction {
  type: typeof SET_TIME;
  payload: {time: number};
}

export interface AlbumInfo {
  errors?: string[];
  albumArtFile?: string;
  artistIds?: string[];
  name?: string;
  trackIds?: string[];
  year?: number;
  wikiPage?: string;
  genreIds?: string[];
  playCount?: number;
  skipCount?: number;
  favorites?: number[];
}

export interface ArtistInfo {
  name?: string;
  albumIds?: string[];
  artFile?: string;
  errors?: string[];
  wikiPage?: string;
  genreIds?: string[];
  trackIds?: string[];
}

export interface TrackInfo {
  duration?: number;
  playCount?: number;
  playDate?: Date;
  filePath?: string;
  artistIds?: string[];
  albumIds?: string[];
  name?: string;
  year?: number;
  genreIds?: string[];
  skipCount?: number;
  dateAdded?: Date;
  favorites?: number[];
  genius?: {
    id?: string;
    page?: string;
    errors?: string[];
  };
  warning?: TrackInfo;
}

interface UpdateAlbum {
  type: typeof UPDATE_ALBUM;
  payload: {
    info: AlbumInfo;
    id: string;
  };
}

interface UpdateArtist {
  type: typeof UPDATE_ARTIST;
  payload: {
    info: ArtistInfo;
    id: string;
  };
}

interface DeleteAlbum {
  type: typeof DELETE_ALBUM;
  payload: {id: string};
}

interface DeleteArtist {
  type: typeof DELETE_ARTIST;
  payload: {id: string};
}

interface UpdateTrack {
  type: typeof UPDATE_TRACK;
  payload: {
    info: TrackInfo;
    id: string;
  };
}

interface SaveNewTracks {
  type: typeof SAVE_NEW_TRACKS;
}

interface CreateBackup {
  type: typeof CREATE_BACKUP;
}

interface UploadFile {
  type: typeof UPLOAD_FILES;
  payload: {files: File[]; metadatas: Metadata[]};
}

interface AddToPlaylist {
  type: typeof ADD_TO_PLAYLIST;
  payload: {
    index: number;
    trackIds: string[];
  };
}

export type CurrentlyPlayingActionTypes = UpdateTimeAction | VolumeChangeAction | NextTrackAction | SetPlaylistAction
  | NextAlbumAction | PrevTrackAction | PrevAlbumAction | PlayPauseAction | SetTimeAction;
export type LibraryActionTypes = UpdateLibraryAction | UpdateAlbum | UpdateArtist | UpdateTrack | AddToPlaylist
  | ResetLibraryAction | UploadFile | SaveNewTracks | DeleteArtist | DeleteAlbum | CreateBackup;
export type SettingsActionTypes = SetGenresAction;
