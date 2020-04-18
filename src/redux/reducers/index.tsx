import currentlyPlaying from './currentlyPlaying';
import library from './library';
// import newTracks from './newTracks';
import {combineReducers} from 'redux';

export default combineReducers({currentlyPlaying, library});
