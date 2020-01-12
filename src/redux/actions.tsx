
import { UPDATE_TIME } from "./actionTypes";

export const updateTime = (time) => ({
  payload: {time},
  type: UPDATE_TIME,
});
