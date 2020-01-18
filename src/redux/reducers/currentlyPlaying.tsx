// TODO: RENAME FILE TO PLAYLIST
import {
  CHANGE_VOLUME, CurrentlyPlayingActionTypes, CurrentlyPlayingState, NEXT_TRACK, UPDATE_TIME, SET_PLAYLIST, NEXT_ALBUM, PREV_ALBUM, PREV_TRACK
} from "../actionTypes";
import EmptyPlaylist from "../../playlist/EmptyPlaylist";

const DEFAULT_VOLUME = .1;

const initialState: CurrentlyPlayingState = {
  playlist: new EmptyPlaylist(),
  time: 0,
  volume: DEFAULT_VOLUME,
};

const currentlyPlaying = (state = initialState, action: CurrentlyPlayingActionTypes) => {
  switch (action.type) {
    case UPDATE_TIME: {
      return Object.assign({}, state, {
        time: action.payload.time,
      });
    }
    case CHANGE_VOLUME: {
      return Object.assign({}, state, {
        volume: action.payload.volume,
      });
    }
    case SET_PLAYLIST: {
      const playlist = action.payload.playlist;
      const track = playlist.getCurrentTrack();
      return Object.assign({}, state, {
        playlist,
        currentlyPlayingId: track && track.id,
      });
    }
    case NEXT_TRACK: {
      const next = state.playlist.nextTrack();
      return Object.assign({}, state, {
        currentlyPlayingId: next ? next.id : undefined,
      });
    }
    case NEXT_ALBUM: {
      const next = state.playlist.nextAlbum();
      return Object.assign({}, state, {
        currentlyPlayingId: next ? next.id : undefined,
      });
    }
    case PREV_TRACK: {
      const prev = state.playlist.prevTrack();
      return Object.assign({}, state, {
        currentlyPlayingId: prev ? prev.id : undefined,
      });
    }
    case PREV_ALBUM: {
      const prev = state.playlist.prevAlbum();
      return Object.assign({}, state, {
        currentlyPlayingId: prev ? prev.id : undefined,
      });
    }
    default: {
      return state;
    }
  }
};

export default currentlyPlaying;
