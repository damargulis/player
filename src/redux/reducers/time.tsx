
import { TimeActionTypes, TimeState, UPDATE_TIME } from "../actionTypes";

const initialState: TimeState = {
  time: 0,
};

const time = (state = initialState, action: TimeActionTypes) => {
  switch (action.type) {
    case UPDATE_TIME: {
      return {
        time: action.payload.time,
      };
    }
    default: {
      return state;
    }
  }
};

export default time;
