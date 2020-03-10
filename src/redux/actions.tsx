import {
  ADD_TO_PLAYLIST,
  AlbumInfo,
  ArtistInfo,
  CHANGE_VOLUME,
  CREATE_TRACK_FROM_FILE,
  LibraryInfo,
  LibraryState,
  Metadata,
  NEXT_ALBUM,
  NEXT_TRACK,
  PLAY_PAUSE,
  PREV_ALBUM,
  PREV_TRACK,
  RESET_LIBRARY,
  SET_PLAYLIST,
  SET_TIME,
  TrackInfo,
  UPDATE_ALBUM,
  UPDATE_ARTIST,
  UPDATE_LIBRARY,
  UPDATE_TIME,
  UPDATE_TRACK,
  UPLOAD_FILES,
} from './actionTypes';
import EmptyPlaylist from '../playlist/EmptyPlaylist';
import fs from 'fs';
import mm from 'musicmetadata';

export const updateTime = (time: number) => ({
  payload: {time},
  type: UPDATE_TIME,
});

export const updateLibrary = (library: LibraryInfo) => ({
  payload: {library},
  type: UPDATE_LIBRARY,
});

export const resetLibrary = (library: LibraryState) => ({
  payload: {library},
  type: RESET_LIBRARY,
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

export const updateAlbum = (id: string, info: AlbumInfo) => ({
  payload: {id, info},
  type: UPDATE_ALBUM,
});

export const updateArtist = (id: string, info: ArtistInfo) => ({
  payload: {id, info},
  type: UPDATE_ARTIST,
});

export const updateTrack = (id: string, info: TrackInfo) => ({
  payload: {id, info},
  type: UPDATE_TRACK,
});

export const addToPlaylist = (index: number, trackIds: string[]) => ({
  payload: {index, trackIds},
  type: ADD_TO_PLAYLIST,
});

const createTrackFromFile = (metadata: Metadata, file: File) => ({
  payload: {metadata, file},
  type: CREATE_TRACK_FROM_FILE,
});

export function uploadFiles(files: File[]) {
  return (dispatch: (data: object) => void) => {
    dispatch({type: UPLOAD_FILES, payload: {files}});
    const filePromises = files.map((file) => {
      return new Promise((resolve, reject) => {
        const stream = fs.createReadStream(file.path);
        if (file.type.split('/')[0] !== 'audio') {
          // TODO: if img, upload
          return resolve();
        }
        mm(stream, {duration: true}, (err, metadata) => {
          if (err) {
            reject();
          }
          dispatch(createTrackFromFile(metadata, file));
          stream.close();
          resolve(metadata);
        });
      });
    });
    return Promise.all(filePromises);
  };
}
