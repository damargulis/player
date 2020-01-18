import currentlyPlaying from "./currentlyPlaying";
import library from "./library";
import { combineReducers } from "redux";

export default combineReducers({ currentlyPlaying, library});
