import {
  SET_GENRES,
  SettingsActionTypes,
  SettingsState,
} from '../actionTypes';
const initialState: SettingsState = {
  genres: [],
};

const settings = (state = initialState, action: SettingsActionTypes) => {
  switch (action.type) {
    case SET_GENRES: {
      return Object.assign({}, state, {
        genres: action.payload.genres,
      });
    }
    default:
      return state;
  }
};

export default settings;
