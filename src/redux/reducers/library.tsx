import {
  ADD_TO_PLAYLIST,
  Album,
  Artist,
  CREATE_TRACK_FROM_FILE,
  Genre,
  LibraryActionTypes,
  LibraryState,
  Metadata,
  Playlist,
  RESET_LIBRARY,
  Track,
  UPDATE_ALBUM,
  UPDATE_ARTIST,
  UPDATE_LIBRARY,
  UPDATE_TRACK
} from '../actionTypes';
import {DATA_DIR} from '../../constants';
import fs from 'fs';
import {inverse} from '../../utils';

const initialState: LibraryState = {
  albums: {},
  artists: {},
  genres: {},
  playlists: {},
  tracks: {},
  newTracks: [],
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

function tracks(state: Record<string, Track>, action: LibraryActionTypes): Record<string, Track> {
  switch (action.type) {
    case UPDATE_LIBRARY: {
      const update = action.payload.library.tracks;
      if (!update) {
        return state;
      }
      return Object.assign({}, state, Object.fromEntries(Object.entries(update).map(([id, track]) => {
        return [id, {
          ...state[id],
          ...track,
        }];
      })));
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

function playlists(state: Record<string, Playlist>, action: LibraryActionTypes): Record<string, Playlist> {
  switch (action.type) {
    case UPDATE_LIBRARY: {
      const update = action.payload.library.playlists;
      if (!update) {
        return state;
      }
      return Object.assign({}, state, Object.fromEntries(Object.entries(update).map(([id, playlist]) => {
        return [id, {
          ...state[id],
          ...playlist,
        }];
      })));
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

function genres(state: Record<string, Genre>, action: LibraryActionTypes): Record<string, Genre> {
  switch (action.type) {
    case UPDATE_LIBRARY: {
      const update = action.payload.library.genres;
      if (!update) {
        return state;
      }
      return Object.assign({}, state, Object.fromEntries(Object.entries(update).map(([id, genre]) => {
        return [id, {
          ...state[id],
          ...genre,
        }];
      })));
    }
    default: {
      return state;
    }
  }
}

function artists(state: Record<string, Artist>, action: LibraryActionTypes): Record<string, Artist> {
  switch (action.type) {
    case UPDATE_LIBRARY: {
      const udpate = action.payload.library.artists;
      if (!udpate) {
        return state;
      }
      return Object.assign({}, state, Object.fromEntries(Object.entries(udpate).map(([id, artist]) => {
        return [id, {
          ...state[id],
          ...artist,
        }];
      })));
    }
    case UPDATE_ARTIST: {
      const artist = state[action.payload.id];
      return Object.assign({}, state, {
        [action.payload.id]: {
          ...artist,
          ...action.payload.info,
        },
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

function albums(state: Record<string, Album>, action: LibraryActionTypes): Record<string, Album> {
  switch (action.type) {
    case UPDATE_LIBRARY: {
      const update = action.payload.library.albums;
      if (!update) {
        return state;
      }
      return Object.assign({}, state, Object.fromEntries(Object.entries(update).map(([id, album]) => {
        return [id, {
          ...state[id],
          ...album,
        }];
      })));
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

function createTrack(file: File, metadata: Metadata, state: LibraryState): Track {
  console.log(metadata);
  let nextId = 0;
  while (state.tracks[nextId.toString()]) {
    nextId++;
  }
  const genreMap = inverse(state.genres);
  const genreIds = metadata.genre.map((genre) => genreMap[genre]).filter(Boolean);
  const artistMap = inverse(state.artists);
  const artistIds = metadata.artist.map((artist) => artistMap[artist]).filter(Boolean);
  const albumMap = inverse(state.albums);
  // TODO: albums (and artist) might have the same name....inverse wont work...
  const albumIds = [metadata.album].map((album) => albumMap[album]).filter(Boolean);
  return {
    id: nextId.toString(),
    // TODO: can this be more accurate?
    duration: metadata.duration * 1000,
    playCount: 0,
    filePath: file.path,
    name: metadata.title,
    year: parseInt(metadata.year, 10),
    skipCount: 0,
    dateAdded: new Date(),
    favorites: [],
    genreIds: genreIds,
    artistIds: artistIds,
    albumIds: albumIds,
    // TODO: this should be null? -- what does it come in from itunes as if never played?
    playDate: new Date(''),
  };
}

function runReducer(state: LibraryState, action: LibraryActionTypes): LibraryState {
  switch (action.type) {
    case UPDATE_LIBRARY:
    case UPDATE_ALBUM:
    case UPDATE_TRACK:
    case UPDATE_ARTIST:
    case ADD_TO_PLAYLIST:
      return Object.assign({}, state, {
        albums: albums(state.albums, action),
        artists: artists(state.artists, action),
        genres: genres(state.genres, action),
        playlists: playlists(state.playlists, action),
        tracks: tracks(state.tracks, action),
      });
    case RESET_LIBRARY:
        return action.payload.library;
    case CREATE_TRACK_FROM_FILE:
        return Object.assign({}, state, {
          newTracks: [...state.newTracks, createTrack(action.payload.file, action.payload.metadata, state)],
        });
    default:
        return state;
  }
}

export default function reducer(state: LibraryState = initialState, action: LibraryActionTypes): LibraryState {
  const library = runReducer(state, action);
  switch (action.type) {
    case UPDATE_ALBUM:
    case UPDATE_ARTIST:
    case UPDATE_LIBRARY:
    case UPDATE_TRACK:
    case CREATE_TRACK_FROM_FILE:
    case ADD_TO_PLAYLIST:
    case RESET_LIBRARY:
      save(library);
      break;
    default:
      break;
  }
  return library;
}
