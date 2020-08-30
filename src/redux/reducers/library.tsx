import {
  ADD_TO_PLAYLIST,
  Album,
  Artist,
  CREATE_BACKUP,
  DELETE_ALBUM,
  DELETE_ARTIST,
  Genre,
  LibraryActionTypes,
  LibraryState,
  Metadata,
  Playlist,
  RESET_LIBRARY,
  SAVE_NEW_TRACKS,
  Track,
  UPDATE_ALBUM,
  UPDATE_ARTIST,
  UPDATE_LIBRARY,
  UPDATE_TRACK,
  UPLOAD_FILES
} from '../actionTypes';
import {DATA_DIR} from '../../constants';
import fs from 'fs';
import shortid from 'shortid';
import {formatGenre, inverse} from '../../utils';

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

function createBackup(library: LibraryState): Promise<void> {
  const backups = `${DATA_DIR}/backups`;
  if (!fs.existsSync(backups)) {
    fs.mkdirSync(backups);
  }
  const fileName = `${backups}/${Date.now()}.json`;
  // TODO: maybe use sync if you want to do this on exit so it doesn't half write?
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

function save(library: LibraryState): Promise<void> {
  const fileName = `${DATA_DIR}/library.json`;
  // TODO: maybe use sync if you want to do this on exit so it doesn't half write?
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
    case DELETE_ALBUM: {
      return Object.fromEntries(Object.entries(state).map(([id, track]) => {
        const index = track.albumIds.indexOf(action.payload.id);
        if (index >= 0) {
          track.albumIds.splice(index, 1);
          return [id, {
            ...track,
            albumIds: [...track.albumIds],
          }];
        }
        return [id, track];
      }));
    }
    case DELETE_ARTIST: {
      return Object.fromEntries(Object.entries(state).map(([id, track]) => {
        const index = track.artistIds.indexOf(action.payload.id);
        if (index >= 0) {
          track.artistIds.splice(index, 1);
          return [id, {
            ...track,
            artistIds: [...track.artistIds],
          }];
        }
        return [id, track];
      }));
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
    case DELETE_ALBUM: {
      return Object.fromEntries(Object.entries(state).map(([id, artist]) => {
        const index = artist.albumIds.indexOf(action.payload.id);
        if (index >= 0) {
          artist.albumIds.splice(index, 1);
          return [id, {
            ...artist,
            albumIds: [...artist.albumIds],
          }];
        }
        return [id, artist];
      }));
    }
    case DELETE_ARTIST: {
      delete state[action.payload.id];
      return {...state};
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

function newTracks(state: string[], action: LibraryActionTypes): string[] {
  switch (action.type) {
    case UPDATE_LIBRARY:
      const update = action.payload.library.newTracks;
      if (!update) {
        return state;
      }
      return [...update];
    default:
      return state;
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
    case DELETE_ALBUM: {
      delete state[action.payload.id];
      return {...state};
    }
    case DELETE_ARTIST: {
      return Object.fromEntries(Object.entries(state).map(([id, album]) => {
        const index = album.artistIds.indexOf(action.payload.id);
        if (index >= 0) {
          album.artistIds.splice(index, 1);
          return [id, {
            ...album,
            artistIds: [...album.artistIds],
          }];
        }
        return [id, album];
      }));
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

function getOrCreateGenres(metadata: Metadata, state: LibraryState): string[] {
  // TODO: only gets...also create or no?
  const genreNames = metadata.genre.map((genre) => formatGenre(genre));
  const inverseGenres = inverse(state.genres);
  const genreIds = genreNames.map((name) => inverseGenres[name]).filter(Boolean);
  return genreIds;
}

function getOrCreateAlbums(
    metadata: Metadata, existingAlbums: Record<string, Album>, artist?: Artist): Album | undefined {
  if (!metadata.album) {
    return;
  }
  const album = Object.values(existingAlbums).find((a) => {
    // use has artistIds instead of name incase artists have the same name (super edge casey)
    return a.name === metadata.album && artist && artist.name === metadata.artist[0];
  });
  if (album) {
    return album;
  }
  return {
    id: shortid.generate(),
    warnings: {},
    errors: [],
    artistIds: [],
    name: metadata.album,
    trackIds: [],
    year: parseInt(metadata.year, 10),
    genreIds: [],
    playCount: 0,
    skipCount: 0,
    favorites: [],
  };
}

function getOrCreateArtist(metadata: Metadata, existingArtists: Record<string, Artist>): Artist | undefined {
  if (!metadata.artist) {
    return;
  }
  const artistMap = inverse(existingArtists);
  const artistIds = metadata.artist.map((artist) => artistMap[artist]).filter(Boolean);
  if (artistIds.length > 0) {
    return existingArtists[artistIds[0]];
  }
  return {
    id: shortid.generate(),
    name: metadata.artist[0],
    albumIds: [],
    errors: [],
    genreIds: [],
    trackIds: [],
  };
}

function createTrack(file: File, metadata: Metadata): Track {
  return {
    id: shortid.generate(),
    // TODO: can this be more accurate?
    duration: metadata.duration * 1000,
    playCount: 0,
    filePath: 'file://' + file.path,
    name: metadata.title,
    year: parseInt(metadata.year, 10),
    skipCount: 0,
    dateAdded: new Date(),
    favorites: [],
    genreIds: [],
    artistIds: [],
    albumIds: [],
    // TODO: this should be null? -- what does it come in from itunes as if never played?
    playDate: new Date(''),
  };
}

function addIdsIfNotThere(currentIds: string[], newIds: string[]): string[] {
  newIds.forEach((newId) => {
    if (currentIds.indexOf(newId) < 0) {
      currentIds = [...currentIds, newId];
    }
  });
  return currentIds;
}

function runReducer(state: LibraryState, action: LibraryActionTypes): LibraryState {
  switch (action.type) {
    case UPDATE_TRACK:
    case UPDATE_LIBRARY:
    case UPDATE_ALBUM:
    case UPDATE_ARTIST:
    case ADD_TO_PLAYLIST:
    case DELETE_ARTIST:
    case DELETE_ALBUM:
      return Object.assign({}, state, {
        albums: albums(state.albums, action),
        artists: artists(state.artists, action),
        genres: genres(state.genres, action),
        playlists: playlists(state.playlists, action),
        tracks: tracks(state.tracks, action),
        newTracks: newTracks(state.newTracks, action),
      });
    case RESET_LIBRARY:
      return action.payload.library;
    case SAVE_NEW_TRACKS:
      return {
        ...state,
        newTracks: [],
      };
    case UPLOAD_FILES:
      const idToTrackNo = {} as Record<string, number>;
      const updatedAlbums = {...state.albums};
      const updatedArtists = {...state.artists};
      const updatedTracks = {...state.tracks};
      const uploadedTracks = [] as string[];
      const updatedAlbumIds = new Set() as Set<string>;
      action.payload.metadatas.forEach((metadata, index) => {
        const file = action.payload.files[index];
        const artist = getOrCreateArtist(metadata, updatedArtists);
        const album = getOrCreateAlbums(metadata, updatedAlbums, artist);
        const genreIds = getOrCreateGenres(metadata, state);
        const track = createTrack(file, metadata);
        idToTrackNo[track.id] = metadata.track.no;
        if (album) {
          updatedAlbums[album.id] = {
            ...album,
            artistIds: artist ? addIdsIfNotThere(album.artistIds, [artist.id]) : album.artistIds,
            trackIds: addIdsIfNotThere(album.trackIds, [track.id]),
            genreIds: addIdsIfNotThere(album.genreIds, genreIds),
          };
        }
        if (artist) {
          updatedArtists[artist.id] = {
            ...artist,
            trackIds: addIdsIfNotThere(artist.trackIds, [track.id]),
            albumIds: album ? addIdsIfNotThere(artist.albumIds, [album.id]) : artist.albumIds,
            genreIds: addIdsIfNotThere(artist.genreIds, genreIds),
          };
        }
        updatedTracks[track.id] = {
          ...track,
          albumIds: album ? addIdsIfNotThere(track.albumIds, [album.id]) : track.albumIds,
          artistIds: artist ? addIdsIfNotThere(track.artistIds, [artist.id]) : track.artistIds,
          genreIds: addIdsIfNotThere(track.genreIds, genreIds),
        };
        uploadedTracks.push(track.id);
        if (album) {
          updatedAlbumIds.add(album.id);
        }
      });

      updatedAlbumIds.forEach((albumId) => {
        const album = updatedAlbums[albumId];
        album.trackIds.sort((trackId1, trackId2) => {
          return idToTrackNo[trackId1] - idToTrackNo[trackId2];
        });
      });

      return Object.assign({}, state, {
        albums: updatedAlbums,
        artists: updatedArtists,
        tracks: updatedTracks,
        newTracks: [...state.newTracks, ...uploadedTracks],
      });
    default:
        return state;
  }
}

export default function reducer(state: LibraryState = initialState, action: LibraryActionTypes): LibraryState {
  const library = runReducer(state, action);
  switch (action.type) {
    case CREATE_BACKUP:
      createBackup(library);
      break;
    case UPDATE_ALBUM:
    case UPDATE_ARTIST:
    case DELETE_ARTIST:
    case DELETE_ALBUM:
    case UPDATE_LIBRARY:
    case UPDATE_TRACK:
    case UPLOAD_FILES:
    case ADD_TO_PLAYLIST:
    case RESET_LIBRARY:
    case SAVE_NEW_TRACKS:
      save(library);
      break;
    default:
      break;
  }
  return library;
}
