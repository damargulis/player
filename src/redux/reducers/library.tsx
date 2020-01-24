import {ADD_PLAY, LibraryActionTypes, LibraryState, SAVE, UPDATE_LIBRARY} from '../actionTypes';
import Library from '../../library/Library';

const initialState: LibraryState = {
  albums: [],
  artists: [],
  genres: [],
  playlists: [],
  tracks: [],
};

function library(state: LibraryState = initialState, action: LibraryActionTypes): LibraryState  {
  switch (action.type) {
    case UPDATE_LIBRARY: {
      return Object.assign({}, state, {
        albums: action.payload.library.getAlbums(),
        artists: action.payload.library.getArtists(),
        genres: action.payload.library.getGenres(),
        playlists: action.payload.library.getPlaylists(),
        tracks: action.payload.library.getTracks(),
      });
    }
    case SAVE: {
      // TODO: save shouldn't be its own action, call this from the other actions that need it
      const lib = new Library(state.tracks, state.albums, state.artists, state.genres, state.playlists);
      lib.save();
      return state;
    }
    case ADD_PLAY: {
      const item = action.payload.item;
      item.playCount++;
      // TODO: keep all dates? Or all within a time space, (to generate charts and such)...
      // if gonna save all, probably want to dump it somewhere separate and keep out of main process memory
      item.playDate = new Date();
      return state;
    }
    default: {
      return state;
    }
  }
}

export default library;
