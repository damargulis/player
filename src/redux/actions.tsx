import {
  ADD_TO_PLAYLIST,
  AlbumInfo,
  ArtistInfo,
  CHANGE_VOLUME,
  CREATE_BACKUP,
  DELETE_ALBUM,
  DELETE_ARTIST,
  DELETE_TRACK,
  LibraryInfo,
  LibraryState,
  Metadata,
  NEXT_ALBUM,
  NEXT_TRACK,
  PLAY_PAUSE,
  PREV_ALBUM,
  PREV_TRACK,
  RESET_LIBRARY,
  SAVE_NEW_TRACKS,
  SET_GENRES,
  SET_PLAYLIST,
  SET_TIME,
  Track,
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

export const setGenres = (genres: string[]) => ({
  payload: {genres},
  type: SET_GENRES,
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

export const deleteTrack = (track: Track) => ({
  payload: {track},
  type: DELETE_TRACK,
});

export const deleteAlbum = (id: string) => ({
  payload: {id},
  type: DELETE_ALBUM,
});

export const deleteArtist = (id: string) => ({
  payload: {id},
  type: DELETE_ARTIST,
});

export const addToPlaylist = (index: number, trackIds: string[]) => ({
  payload: {index, trackIds},
  type: ADD_TO_PLAYLIST,
});

export const saveNewTracks = () => ({
  type: SAVE_NEW_TRACKS,
});

export const createBackup = () => ({
  type: CREATE_BACKUP,
});

function getMetadata(file: File): Promise<Metadata> {
  return new Promise<Metadata>((resolve, reject) => {
    const stream = fs.createReadStream(file.path);
    mm(stream, {duration: true}, (err, metadata) => {
      if (err) {
        reject();
      }
      stream.close();
      resolve(metadata);
    });
  });
}

export function uploadFiles(files: File[]): (dispatch: (data: object) => void) => void {
  return (dispatch: (data: object) => void) => {
    const mp3Files = files.filter((file) => {
      return file.type.split('/')[0] === 'audio';
    });
    const metas = mp3Files.map((file) => {
      return getMetadata(file);
    });
    Promise.all(metas).then((metadatas) => {
      dispatch({type: UPLOAD_FILES, payload: {files: mp3Files, metadatas}});
    });
  };
}
