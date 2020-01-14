import Album from "../library/Album";
import Artist from "../library/Artist";
import Library from "../library/Library";
import Playlist from "../library/Playlist";
import Track from "../library/Track";

export const UPDATE_TIME = "UPDATE_TIME";
export const UPDATE_LIBRARY = "UPDATE_LIBRARY";
export const CHANGE_VOLUME = "CHANGE_VOLUME";

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

export type CurrentlyPlayingActionTypes = UpdateTimeAction | VolumeChangeAction;
export type LibraryActionTypes = UpdateLibraryAction;
