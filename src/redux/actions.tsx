import {UPDATE_LIBRARY, UPDATE_TIME } from "./actionTypes";
import Library from "../library/Library";

export const updateTime = (time: number) => ({
  payload: {time},
  type: UPDATE_TIME,
});

export const updateLibrary = (library: Library) => ({
  payload: {library},
  type: UPDATE_LIBRARY,
});
