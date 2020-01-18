import {LibraryActionTypes, LibraryState, SAVE, UPDATE_LIBRARY} from '../actionTypes';
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
      const lib = new Library(state.tracks, state.albums, state.artists, state.genres, state.playlists);
      lib.save();
      return state;
    }
    default: {
      return state;
    }
  }
}

export default library;
