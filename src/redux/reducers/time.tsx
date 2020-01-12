
import { UPDATE_TIME } from "../actionTypes";

const time = (state = 0, action) => {
  switch (action.type) {
    case UPDATE_TIME: {
      return action.payload.time;
    }
    default: {
      return state;
    }
  }
};

export default time;
