import {
  ADD_TO_PLAYLIST,
  Album,
  Artist,
  LibraryActionTypes,
  LibraryState,
  Playlist,
  Track,
  UPDATE_ALBUM,
  UPDATE_ARTIST,
  UPDATE_LIBRARY,
  UPDATE_TRACK
} from '../actionTypes';
import {DATA_DIR} from '../../constants';
import fs from 'fs';

const initialState: LibraryState = {
  albums: {},
  artists: {},
  genres: {},
  playlists: {},
  tracks: {},
};

interface Item {
  id: number;
}

function getUpdatedMemberIds(memberIds: string[], updatedId: string, updatedMemberIds: string[], id: string): string[] {
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

function tracks(state: Record<number, Track>, action: LibraryActionTypes): Record<number, Track> {
  switch (action.type) {
    case UPDATE_LIBRARY: {
      return {...action.payload.library.tracks};
    }
    case UPDATE_TRACK: {
      const track = state[action.payload.id];
      return Object.assign({}, state, {
        [action.payload.id]: {
          ...track,
          ...action.payload.info,
        }});
    }
    case UPDATE_ARTIST: {
      const trackIds = action.payload.info.trackIds;
      if (!trackIds) {
        return state;
      }
      return Object.fromEntries(Object.entries(state).map(([id, track]) => {
        return [id, {
          ...track,
          artistIds: getUpdatedMemberIds(track.artistIds, action.payload.id.toString(), trackIds, track.id),
        }];
      }));
    }
    case UPDATE_ALBUM: {
      const trackIds = action.payload.info.trackIds;
      if (!trackIds) {
        return state;
      }
      return Object.fromEntries(Object.entries(state).map(([id, track]) => {
        return [id, {
          ...track,
          albumIds: getUpdatedMemberIds(track.albumIds, action.payload.id.toString(), trackIds, track.id),
        }];
      }));
    }
    default: {
      return state;
    }
  }
}

function playlists(state: Record<number, Playlist>, action: LibraryActionTypes): Record<number, Playlist> {
  switch (action.type) {
    case UPDATE_LIBRARY: {
      return {...action.payload.library.playlists};
    }
    case ADD_TO_PLAYLIST: {
      // TODO: change index to id
      const playlist = state[action.payload.index];
      const newIds = action.payload.trackIds.filter((trackId) => {
        return playlist.trackIds.indexOf(trackId.toString()) < 0;
      });
      const trackIds = [...playlist.trackIds, ...newIds];
      return Object.assign({}, state, {
        [action.payload.index]: {
          ...playlist,
          trackIds,
        },
      });
    }
    default: {
      return state;
    }
  }
}

function genres(state: Record<number, string>, action: LibraryActionTypes): Record<number, string> {
  switch (action.type) {
    case UPDATE_LIBRARY: {
      return {...action.payload.library.genres};
    }
    default: {
      return state;
    }
  }
}

function artists(state: Record<number, Artist>, action: LibraryActionTypes): Record<number, Artist> {
  switch (action.type) {
    case UPDATE_LIBRARY: {
      return {...action.payload.library.artists};
    }
    case UPDATE_ARTIST: {
      const artist = state[action.payload.id];
      return Object.assign({}, state, {
        ...artist,
        ...action.payload.info,
      });
    }
    case UPDATE_ALBUM: {
      const artistIds = action.payload.info.artistIds;
      if (!artistIds) {
        return state;
      }
      return Object.fromEntries(Object.entries(state).map(([id, artist]) => {
        // TODO: figure out why you need these toStrings()
        return [id, {
          ...artist,
          albumIds: getUpdatedMemberIds(artist.albumIds, action.payload.id.toString(), artistIds, artist.id),
        }];
      }));
    }
    case UPDATE_TRACK: {
      const artistIds = action.payload.info.artistIds;
      if (!artistIds) {
        return state;
      }
      return Object.fromEntries(Object.entries(state).map(([id, artist]) => {
        return [id, {
          ...artist,
          trackIds: getUpdatedMemberIds(artist.trackIds, action.payload.id.toString(), artistIds, artist.id),
        }];
      }));
    }
    default: {
      return state;
    }
  }
}

function albums(state: Record<number, Album>, action: LibraryActionTypes): Record<number, Album> {
  switch (action.type) {
    case UPDATE_LIBRARY: {
      return {...action.payload.library.albums};
    }
    case UPDATE_ARTIST: {
      const albumIds = action.payload.info.albumIds;
      if (!albumIds) {
        return state;
      }
      return Object.fromEntries(Object.entries(state).map(([id, album]) => {
        return [id, {
          ...album,
          artistIds: getUpdatedMemberIds(album.artistIds, action.payload.id.toString(), albumIds, album.id),
        }];
      }));
    }
    case UPDATE_TRACK: {
      const albumIds = action.payload.info.albumIds;
      if (!albumIds) {
        return state;
      }
      return Object.fromEntries(Object.entries(state).map(([id, album]) => {
        return [id, {
          ...album,
          trackIds: getUpdatedMemberIds(album.trackIds, action.payload.id.toString(), albumIds, album.id),
        }];
      }));
    }
    case UPDATE_ALBUM: {
      const album = state[action.payload.id];
      return Object.assign({}, state, {
        [action.payload.id]: {
          ...album,
          ...action.payload.info,
        },
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
  switch (action.type) {
    case UPDATE_LIBRARY:
    case UPDATE_ALBUM:
    case UPDATE_TRACK:
    case UPDATE_ARTIST:
    case ADD_TO_PLAYLIST:
      save(library);
      break;
    default:
      break;
  }
  return library;
}
