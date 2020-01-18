import Album from "../library/Album";
import Artist from "../library/Artist";
import EmptyPlaylist from "../playlist/EmptyPlaylist";
import Library from "../library/Library";
import Playlist from "../library/Playlist";
import Track from "../library/Track";

export const UPDATE_TIME = "UPDATE_TIME";
export const UPDATE_LIBRARY = "UPDATE_LIBRARY";
export const CHANGE_VOLUME = "CHANGE_VOLUME";
export const NEXT_TRACK = "NEXT_TRACK";
export const SET_PLAYLIST = "SET_PLAYLIST";
export const NEXT_ALBUM = "NEXT_ALBUM";
export const SONG_ENDED = "SONG_ENDED";
export const PREV_TRACK = "PREV_TRACK";
export const PREV_ALBUM = "PREV_ALBUM";

export interface LibraryState {
  tracks: Track[];
  albums: Album[];
  artists: Artist[];
  playlists: Playlist[];
  genres: string[];
}

export interface CurrentlyPlayingState {
  time: number;
  volume: number;
  playlist: EmptyPlaylist;
  currentlyPlayingId?: number;
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
  payload: {
    library: Library,
  };
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
  payload: {playlist: EmptyPlaylist};
}

export type CurrentlyPlayingActionTypes = UpdateTimeAction |
  VolumeChangeAction | NextTrackAction | SetPlaylistAction | NextAlbumAction | PrevTrackAction | PrevAlbumAction;
export type LibraryActionTypes = UpdateLibraryAction;
