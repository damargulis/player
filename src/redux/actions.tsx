import Library from "../library/Library";
import {UPDATE_TIME, UPDATE_LIBRARY } from "./actionTypes";

export const updateTime = (time: number) => ({
  payload: {time},
  type: UPDATE_TIME,
});

export const updateLibrary = (library: Library) => ({
  payload: {library},
  type: UPDATE_LIBRARY,
});


