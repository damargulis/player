import {
  CHANGE_VOLUME,
  CurrentlyPlayingActionTypes,
  CurrentlyPlayingState,
  NEXT_ALBUM,
  NEXT_TRACK,
  PLAY_PAUSE,
  PREV_ALBUM,
  PREV_TRACK,
  SET_PLAYLIST,
  SET_TIME,
  UPDATE_TIME,
} from '../actionTypes';
import {DEFAULT_VOLUME} from '../../constants';
import EmptyPlaylist from '../../playlist/EmptyPlaylist';

const initialState: CurrentlyPlayingState = {
  isPlaying: false,
  playlist: new EmptyPlaylist(),
  time: 0,
  volume: DEFAULT_VOLUME,
};

const currentlyPlaying = (state = initialState, action: CurrentlyPlayingActionTypes) => {
  switch (action.type) {
    case UPDATE_TIME: {
      return Object.assign({}, state, {
        setTime: undefined,
        time: action.payload.time,
      });
    }
    case SET_TIME: {
      return Object.assign({}, state, {
        setTime: action.payload.time,
      });
    }
    case CHANGE_VOLUME: {
      return Object.assign({}, state, {
        volume: action.payload.volume,
      });
    }
    case SET_PLAYLIST: {
      const playlist = action.payload.playlist;
      const trackId = action.payload.play && playlist.nextTrack();
      return Object.assign({}, state, {
        currentlyPlayingId: trackId,
        isPlaying: action.payload.play,
        playlist,
      });
    }
    case NEXT_TRACK: {
      const nextId = state.playlist.nextTrack();
      return Object.assign({}, state, {
        currentlyPlayingId: nextId,
        isPlaying: true,
      });
    }
    case NEXT_ALBUM: {
      const nextId = state.playlist.nextAlbum();
      return Object.assign({}, state, {
        currentlyPlayingId: nextId,
        isPlaying: true,
      });
    }
    case PREV_TRACK: {
      const prevId = state.playlist.prevTrack();
      return Object.assign({}, state, {
        currentlyPlayingId: prevId,
        isPlaying: true,
      });
    }
    case PREV_ALBUM: {
      const prevId = state.playlist.prevAlbum();
      return Object.assign({}, state, {
        currentlyPlayingId: prevId,
        isPlaying: true,
      });
    }
    case PLAY_PAUSE: {
      return Object.assign({}, state, {
        isPlaying: !state.isPlaying,
      });
    }
    default: {
      return state;
    }
  }
};

export default currentlyPlaying;
