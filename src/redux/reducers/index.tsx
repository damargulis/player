import currentlyPlaying from './currentlyPlaying';
import library from './library';
import {combineReducers} from 'redux';
import settings from './settings';

export default combineReducers({currentlyPlaying, library, settings});
