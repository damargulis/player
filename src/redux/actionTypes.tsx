import EmptyPlaylist from '../playlist/EmptyPlaylist';

export const UPDATE_TIME = 'UPDATE_TIME';
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

export interface Album {
  id: string;
  warnings: Record<string, string>;
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

export interface LibraryState {
  tracks: Record<string, Track>;
  albums: Record<string, Album>;
  artists: Record<string, Artist>;
  playlists: Record<string, Playlist>;
  genres: Record<string, Genre>;
}

export interface CurrentlyPlayingState {
  time: number;
  volume: number;
  playlist: EmptyPlaylist;
  currentlyPlayingId?: string;
  isPlaying: boolean;
  setTime?: number;
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
  warnings?: Record<string, string>;
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
}

interface UpdateAlbum {
  type: typeof UPDATE_ALBUM;
  payload: {
    info: AlbumInfo;
    id: number;
  };
}

interface UpdateArtist {
  type: typeof UPDATE_ARTIST;
  payload: {
    info: ArtistInfo;
    id: number;
  };
}

interface UpdateTrack {
  type: typeof UPDATE_TRACK;
  payload: {
    info: TrackInfo;
    id: number;
  };
}

interface AddToPlaylist {
  type: typeof ADD_TO_PLAYLIST;
  payload: {
    index: number;
    trackIds: number[];
  };
}

export type CurrentlyPlayingActionTypes = UpdateTimeAction | VolumeChangeAction | NextTrackAction | SetPlaylistAction
  | NextAlbumAction | PrevTrackAction | PrevAlbumAction | PlayPauseAction | SetTimeAction;
export type LibraryActionTypes = UpdateLibraryAction | UpdateAlbum | UpdateArtist | UpdateTrack | AddToPlaylist;
