
import {UPDATE_LIBRARY, LibraryActionTypes, LibraryState } from "../actionTypes";
import Library from "../../library/Library";

const initialState: LibraryState = {
  tracks: [],
  albums: [],
  artists: [],
  playlists: [],
  genres: []
}

function library(state = initialState, action: LibraryActionTypes): LibraryState  {
  switch (action.type) {
    case UPDATE_LIBRARY: {
      return Object.assign({}, state, {
        tracks: action.payload.library.getTracks(),
        albums: action.payload.library.getAlbums(),
        artists: action.payload.library.getArtists(),
        playlists: action.payload.library.getPlaylists(),
        genres: action.payload.library.getGenres()
      });
    }
    default: {
      return state;
    }
  }
};

export default library;
