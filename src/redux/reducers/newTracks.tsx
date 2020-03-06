import {
  NewTracksActionTypes,
  NewTracksState,
  UPLOAD_FILES,
} from '../actionTypes';

const initialState: NewTracksState = {
  files: [],
  tracks: [],
};

export default function newTracks(state = initialState, action: NewTracksActionTypes) {
  switch (action.type) {
    case UPLOAD_FILES:
      return Object.assign({}, state, {
        files: [...state.files, ...action.payload.files],
      });
    default:
      return state;
  }
}
