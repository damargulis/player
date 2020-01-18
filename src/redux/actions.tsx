import {
  CHANGE_VOLUME, NEXT_ALBUM, NEXT_TRACK, PREV_ALBUM, PREV_TRACK, SET_PLAYLIST, SONG_ENDED, UPDATE_LIBRARY, UPDATE_TIME,
} from "./actionTypes";
import EmptyPlaylist from "../playlist/EmptyPlaylist";
import Library from "../library/Library";

export const updateTime = (time: number) => ({
  payload: {time},
  type: UPDATE_TIME,
});

export const updateLibrary = (library: Library) => ({
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

export const setPlaylist = (playlist: EmptyPlaylist) => ({
  payload: {playlist},
  type: SET_PLAYLIST,
});

export const songEnded = () => ({
  type: SONG_ENDED,
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
