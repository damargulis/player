import {
  ADD_TO_PLAYLIST,
  AlbumInfo,
  ArtistInfo,
  CHANGE_VOLUME,
  LibraryState,
  NEXT_ALBUM,
  NEXT_TRACK,
  PLAY_PAUSE,
  PREV_ALBUM,
  PREV_TRACK,
  SET_PLAYLIST,
  SET_TIME,
  TrackInfo,
  UPDATE_ALBUM,
  UPDATE_ARTIST,
  UPDATE_LIBRARY,
  UPDATE_TIME,
  UPDATE_TRACK,
} from './actionTypes';
import EmptyPlaylist from '../playlist/EmptyPlaylist';

export const updateTime = (time: number) => ({
  payload: {time},
  type: UPDATE_TIME,
});

export const updateLibrary = (library: LibraryState) => ({
  payload: {library},
  type: UPDATE_LIBRARY,
});

export const changeVolume = (volume: number) => ({
  payload: {volume},
  type: CHANGE_VOLUME,
});

export const nextTrack = () => ({
  type: NEXT_TRACK,
});

export const setPlaylist = (playlist: EmptyPlaylist, play: boolean) => ({
  payload: {playlist, play},
  type: SET_PLAYLIST,
});

export const nextAlbum = () => ({
  type: NEXT_ALBUM,
});

export const prevTrack = () => ({
  type: PREV_TRACK,
});

export const prevAlbum = () => ({
  type: PREV_ALBUM,
});

export const playPause = () => ({
  type: PLAY_PAUSE,
});

export const setTime = (time: number) => ({
  payload: {time},
  type: SET_TIME,
});

export const updateAlbum = (id: number, info: AlbumInfo) => ({
  payload: {id, info},
  type: UPDATE_ALBUM,
});

export const updateArtist = (id: number, info: ArtistInfo) => ({
  payload: {id, info},
  type: UPDATE_ARTIST,
});

export const updateTrack = (id: number, info: TrackInfo) => ({
  payload: {id, info},
  type: UPDATE_TRACK,
});

export const addToPlaylist = (index: number, trackIds: number[]) => ({
  payload: {index, trackIds},
  type: ADD_TO_PLAYLIST,
});
