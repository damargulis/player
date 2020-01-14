import { CHANGE_VOLUME, CurrentlyPlayingActionTypes, CurrentlyPlayingState, UPDATE_TIME } from "../actionTypes";

const DEFAULT_VOLUME = .1;

const initialState: CurrentlyPlayingState = {
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
    default: {
      return state;
    }
  }
};

export default currentlyPlaying;
