import {
  AlbumParams,
  ArtistParams,
  LibraryActionTypes,
  LibraryState,
  PlaylistParams,
  TrackParams,
  UPDATE_ALBUM,
  UPDATE_ARTIST,
  UPDATE_LIBRARY,
  UPDATE_TRACK
} from '../actionTypes';
import {DATA_DIR} from '../../constants';
import fs from 'fs';

const initialState: LibraryState = {
  albums: [],
  artists: [],
  genres: [],
  playlists: [],
  tracks: [],
};

interface Item {
  id: number;
}

function getUpdatedMemberIds(memberIds: number[], updatedId: number, updatedMemberIds: number[], id: number): number[] {
  if (memberIds.includes(updatedId)) {
    if (updatedMemberIds.includes(id)) {
      // Both included, do nothing
      return memberIds;
    }
    // This was removed from the updated item, remove updated from this
    const index = memberIds.indexOf(updatedId);
    return [...memberIds.slice(0, index), ...memberIds.slice(index + 1)];
  } else if (updatedMemberIds.includes(id)) {
    // This was added to updated item, add updated to this
    return [...memberIds, updatedId];
  }
  // Neithr have, do nothing
  return memberIds;
}

function save(library: LibraryState): Promise<void> {
  const fileName = `${DATA_DIR}/library.json`;
  // maybe use sync if you want to do this on exit so it doesn't half write?
  // will have to see how exiting works on electron...
  return new Promise((resolve, reject) => {
    fs.writeFile(fileName, JSON.stringify(library), (err: Error | null) => {
      if (err) {
        reject(err);
      }
      return resolve();
    });
  });
}

function tracks(state: TrackParams[], action: LibraryActionTypes): TrackParams[] {
  switch (action.type) {
    case UPDATE_LIBRARY: {
      return [...action.payload.library.tracks];
    }
    case UPDATE_TRACK: {
      return state.map((track) => {
        if (track.id !== action.payload.id) {
          return track;
        }
        return {
          ...track,
          ...action.payload.info,
        };
      });
    }
    case UPDATE_ARTIST: {
      const trackIds = action.payload.info.trackIds;
      if (!trackIds) {
        return state;
      }
      return state.map((track) => {
        return {
          ...track,
          albumIds: getUpdatedMemberIds(track.artistIds, action.payload.id, trackIds, track.id),
        };
      });
    }
    case UPDATE_ALBUM: {
      const trackIds = action.payload.info.trackIds;
      if (!trackIds) {
        return state;
      }
      return state.map((track) => {
        return {
          ...track,
          albumIds: getUpdatedMemberIds(track.albumIds, action.payload.id, trackIds, track.id),
        };
      });
    }
    default: {
      return state;
    }
  }
}

function playlists(state: PlaylistParams[], action: LibraryActionTypes): PlaylistParams[] {
  switch (action.type) {
    case UPDATE_LIBRARY: {
      return [...action.payload.library.playlists];
    }
    default: {
      return state;
    }
  }
}

function genres(state: string[], action: LibraryActionTypes): string[] {
  switch (action.type) {
    case UPDATE_LIBRARY: {
      return [...action.payload.library.genres];
    }
    default: {
      return state;
    }
  }
}

function artists(state: ArtistParams[], action: LibraryActionTypes): ArtistParams[] {
  switch (action.type) {
    case UPDATE_LIBRARY: {
      return [...action.payload.library.artists];
    }
    case UPDATE_ARTIST: {
      return state.map((artist) => {
        if (artist.id !== action.payload.id) {
          return artist;
        }
        return {
          ...artist,
          ...action.payload.info,
        };
      });
    }
    case UPDATE_ALBUM: {
      const artistIds = action.payload.info.artistIds;
      if (!artistIds) {
        return state;
      }
      return state.map((artist) => {
        return {
          ...artist,
          albumIds: getUpdatedMemberIds(artist.albumIds, action.payload.id, artistIds, artist.id),
        };
      });
    }
    case UPDATE_TRACK: {
      const artistIds = action.payload.info.artistIds;
      if (!artistIds) {
        return state;
      }
      return state.map((artist) => {
        return {
          ...artist,
          trackIds: getUpdatedMemberIds(artist.trackIds, action.payload.id, artistIds, artist.id),
        };
      });
    }
    default: {
      return state;
    }
  }
}

function albums(state: AlbumParams[], action: LibraryActionTypes): AlbumParams[] {
  switch (action.type) {
    case UPDATE_LIBRARY: {
      return [...action.payload.library.albums];
    }
    case UPDATE_ARTIST: {
      const albumIds = action.payload.info.albumIds;
      if (!albumIds) {
        return state;
      }
      return state.map((album) => {
        return {
          ...album,
          artistIds: getUpdatedMemberIds(album.artistIds, action.payload.id, albumIds, album.id),
        };
      });
    }
    case UPDATE_TRACK: {
      const albumIds = action.payload.info.albumIds;
      if (!albumIds) {
        return state;
      }
      return state.map((album) => {
        return {
          ...album,
          trackIds: getUpdatedMemberIds(album.trackIds, action.payload.id, albumIds, album.id),
        };
      });
    }
    case UPDATE_ALBUM: {
      return state.map((album) => {
        if (album.id !== action.payload.id) {
          return album;
        }
        return {
          ...album,
          ...action.payload.info,
        };
      });
    }
    default: {
      return state;
    }
  }
}

export default function reducer(state: LibraryState = initialState, action: LibraryActionTypes): LibraryState {
  const library = {
    albums: albums(state.albums, action),
    artists: artists(state.artists, action),
    genres: genres(state.genres, action),
    playlists: playlists(state.playlists, action),
    tracks: tracks(state.tracks, action),
  };
  // only save if there is something to save, otherwise you overwrite when defaulting to the empty library
  if (library.albums.length) {
    save(library);
  }
  return library;
}
