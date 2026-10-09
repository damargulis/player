import {
  CHANGE_VOLUME,
  CurrentlyPlayingActionTypes,
  CurrentlyPlayingState,
  DJ_QUEUE_UPDATED,
  DJ_TAKE_OVER,
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
  queueVersion: 0,
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
    case DJ_TAKE_OVER: {
      // Deliberately leaves currentlyPlayingId, isPlaying and time untouched: the DJ adopts
      // the track that is already playing rather than re-selecting (and restarting) it.
      return Object.assign({}, state, {
        playlist: action.payload.playlist,
        queueVersion: state.queueVersion + 1,
      });
    }
    case DJ_QUEUE_UPDATED: {
      return Object.assign({}, state, {
        queueVersion: state.queueVersion + 1,
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
