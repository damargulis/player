
import {LibraryActionTypes, LibraryState, UPDATE_LIBRARY } from "../actionTypes";

const initialState: LibraryState = {
  albums: [],
  artists: [],
  genres: [],
  playlists: [],
  tracks: [],
};

function library(state = initialState, action: LibraryActionTypes): LibraryState  {
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
    default: {
      return state;
    }
  }
}

export default library;
