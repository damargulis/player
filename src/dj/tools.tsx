import {Album, Artist, DJ_QUEUE_UPDATED, DJ_TAKE_OVER, NEXT_TRACK, SET_PLAYLIST, Track} from '../redux/actionTypes';
import activity, {humanDuration} from './activity';
import {Tool} from './api';
import DJPlaylist from '../playlist/DJPlaylist';
import {
  getAlbumById,
  getAllTracks,
  getArtistById,
  getGenreById,
  getSelectedGenres,
  getTime,
  getTrackById,
} from '../redux/selectors';
import store, {RootState} from '../redux/store';
import {toTime} from '../utils';

const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 150;

export const DJ_TOOLS: Tool[] = [
  {
    description: 'Search the library by free text. Matches against track title, artist name and album name ' +
      '(case-insensitive substring). Use this when you have a specific song, artist or album in mind.',
    input_schema: {
      properties: {
        limit: {type: 'integer', description: `Max results (default ${DEFAULT_LIMIT}, max ${MAX_LIMIT})`},
        query: {type: 'string', description: 'Text to search for'},
      },
      required: ['query'],
      type: 'object',
    },
    name: 'search_library',
  },
  {
    description: 'List artists in the library with their track/album counts and genres, most tracks first. ' +
      'Optionally filter by a genre name or a name substring. Paginate with offset.',
    input_schema: {
      properties: {
        genre: {type: 'string', description: 'Only artists with this genre (substring match)'},
        limit: {type: 'integer', description: `Max results (default ${DEFAULT_LIMIT}, max ${MAX_LIMIT})`},
        offset: {type: 'integer', description: 'Skip this many results (for paging)'},
        query: {type: 'string', description: 'Artist name substring'},
      },
      type: 'object',
    },
    name: 'list_artists',
  },
  {
    description: 'List every genre in the library with how many tracks carry it.',
    input_schema: {properties: {}, type: 'object'},
    name: 'list_genres',
  },
  {
    description: 'Get an artist\'s albums (with years) and every track they have in the library.',
    input_schema: {
      properties: {
        name: {
          description: 'Artist name (exact, case-insensitive; falls back to best substring match)',
          type: 'string',
        },
      },
      required: ['name'],
      type: 'object',
    },
    name: 'get_artist',
  },
  {
    description: 'Draw a random sample of tracks matching optional filters. Good for discovering what the ' +
      'library has in a genre or era, or for finding deep cuts. Returns the total match count too.',
    input_schema: {
      properties: {
        artist: {type: 'string', description: 'Artist name substring'},
        favorites_only: {type: 'boolean', description: 'Only tracks the user has marked as a favorite'},
        genre: {type: 'string', description: 'Genre name substring'},
        limit: {type: 'integer', description: `Sample size (default ${DEFAULT_LIMIT}, max ${MAX_LIMIT})`},
        max_year: {type: 'integer', description: 'Latest release year'},
        min_play_count: {type: 'integer', description: 'Only tracks played at least this many times'},
        min_year: {type: 'integer', description: 'Earliest release year'},
        added_within_days: {type: 'integer', description: 'Only tracks added to the library this recently'},
        unplayed_only: {type: 'boolean', description: 'Only tracks the user has never played'},
      },
      type: 'object',
    },
    name: 'sample_tracks',
  },
  {
    description: 'Browse albums as whole works: a random sample of albums matching optional filters, with ids ' +
      'for queue_albums. Use this when the listener wants full albums rather than a mixed queue.',
    input_schema: {
      properties: {
        artist: {type: 'string', description: 'Artist name substring'},
        favorites_only: {type: 'boolean', description: 'Only albums marked as a favorite'},
        genre: {type: 'string', description: 'Genre name substring'},
        limit: {type: 'integer', description: `Sample size (default ${DEFAULT_LIMIT}, max ${MAX_LIMIT})`},
        max_year: {type: 'integer', description: 'Latest release year'},
        min_play_count: {
          description: 'Only albums whose tracks average at least this many plays',
          type: 'integer',
        },
        min_year: {type: 'integer', description: 'Earliest release year'},
        query: {type: 'string', description: 'Album title substring'},
        unplayed_only: {type: 'boolean', description: 'Only albums with no plays on any track'},
      },
      type: 'object',
    },
    name: 'search_albums',
  },
  {
    description: 'Queue whole albums: every track of each album, in album order, nothing skipped. ' +
      'Album ids come from search_albums or get_artist. position works like add_to_queue. Tracks queued this ' +
      'way are album-tagged, so the listener\'s next/prev-album buttons skip whole albums.',
    input_schema: {
      properties: {
        album_ids: {type: 'array', items: {type: 'string'}, description: 'Album ids in play order'},
        position: {
          description: 'Play right after the current track, or at the end (default)',
          enum: ['next', 'end'],
          type: 'string',
        },
      },
      required: ['album_ids'],
      type: 'object',
    },
    name: 'queue_albums',
  },
  {
    description: 'Show what is playing now (with elapsed time), what is queued next, and what has played ' +
      'this session, plus how long the room has been idle or paused.',
    input_schema: {properties: {}, type: 'object'},
    name: 'get_queue',
  },
  {
    description: 'Read-only: what is playing right now, the listening context (local time, volume, whether ' +
      'the app is in the mini player, any genre filter the listener set, how long the room has been idle ' +
      'or paused, what this session has played so far) and whether the DJ queue is active yet. Safe to ' +
      'call before you have queued anything — unlike get_queue it never implies a DJ queue exists.',
    input_schema: {properties: {}, type: 'object'},
    name: 'now_playing',
  },
  {
    description: 'What the listener has actually been playing lately, newest first, from the whole library ' +
      '(not just this session). Good for "more of what I have been into" and for avoiding what they just ' +
      'heard yesterday.',
    input_schema: {
      properties: {
        days: {type: 'integer', description: 'How far back to look (default 14)'},
        limit: {type: 'integer', description: `Max results (default ${DEFAULT_LIMIT}, max ${MAX_LIMIT})`},
      },
      type: 'object',
    },
    name: 'recent_plays',
  },
  {
    description: 'A compact profile of the library and listening history: size, total plays and playtime, ' +
      'how much is unplayed, top genres and artists by plays, favorites per year, and how much was added ' +
      'recently. Call this once early if you have no memory of this listener yet.',
    input_schema: {properties: {}, type: 'object'},
    name: 'library_stats',
  },
  {
    description: 'Replace everything queued after the current track. The current track keeps playing. ' +
      'Track ids come from the other tools.',
    input_schema: {
      properties: {
        track_ids: {type: 'array', items: {type: 'string'}, description: 'Track ids in play order'},
      },
      required: ['track_ids'],
      type: 'object',
    },
    name: 'set_queue',
  },
  {
    description: 'Add tracks to the queue without disturbing what is already queued.',
    input_schema: {
      properties: {
        position: {
          description: 'Play right after the current track, or at the end (default)',
          enum: ['next', 'end'],
          type: 'string',
        },
        track_ids: {type: 'array', items: {type: 'string'}, description: 'Track ids in play order'},
      },
      required: ['track_ids'],
      type: 'object',
    },
    name: 'add_to_queue',
  },
  {
    description: 'Remove specific tracks from the upcoming queue.',
    input_schema: {
      properties: {
        track_ids: {type: 'array', items: {type: 'string'}, description: 'Track ids to remove'},
      },
      required: ['track_ids'],
      type: 'object',
    },
    name: 'remove_from_queue',
  },
  {
    description: 'Skip the currently playing track and start the next queued one immediately. ' +
      'Only use when the user asks to skip or clearly dislikes what is on.',
    input_schema: {properties: {}, type: 'object'},
    name: 'skip_current',
  },
];

export interface ToolOutcome {
  content: string;
  isError?: boolean;
  queueChanged?: boolean;
}

function str(input: Record<string, unknown>, key: string): string | undefined {
  const val = input[key];
  return typeof val === 'string' && val.trim() ? val.trim() : undefined;
}

function num(input: Record<string, unknown>, key: string): number | undefined {
  const val = input[key];
  return typeof val === 'number' && !isNaN(val) ? val : undefined;
}

function bool(input: Record<string, unknown>, key: string): boolean {
  return input[key] === true;
}

function strList(input: Record<string, unknown>, key: string): string[] {
  const val = input[key];
  return Array.isArray(val) ? val.filter((v) => typeof v === 'string') as string[] : [];
}

function limitOf(input: Record<string, unknown>): number {
  const limit = num(input, 'limit');
  return Math.max(1, Math.min(MAX_LIMIT, limit || DEFAULT_LIMIT));
}

function includes(haystack: string, needle: string): boolean {
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

function daysAgo(date: Date | undefined): string {
  if (!date || isNaN(date.getTime()) || date.getTime() <= 0) {
    return 'never';
  }
  const days = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (days <= 0) {
    return 'today';
  }
  return days === 1 ? '1 day ago' : `${days} days ago`;
}

function artistNames(state: RootState, ids: string[]): string {
  return ids.map((id) => getArtistById(state, id)).filter(Boolean).map((a) => a.name).join(', ') || 'Unknown';
}

function genreNames(state: RootState, ids: string[]): string {
  return ids.map((id) => getGenreById(state, id)).filter(Boolean).map((g) => g.name).join('/');
}

function albumName(state: RootState, track: Track): string {
  const album = track.albumIds.length ? getAlbumById(state, track.albumIds[0]) : undefined;
  return album ? album.name : '';
}

/** Position of a track within its album — album trackIds are stored in track-number order. */
function trackPosition(state: RootState, track: Track): string {
  if (!track.albumIds.length) {
    return '';
  }
  const album = getAlbumById(state, track.albumIds[0]);
  if (!album) {
    return '';
  }
  const index = album.trackIds.indexOf(track.id);
  return index >= 0 ? ` #${index + 1}/${album.trackIds.length}` : '';
}

/** One compact line per track — this is what Claude reads, so keep it dense. */
export function formatTrack(state: RootState, track: Track): string {
  const plays = track.playCount ? `plays:${track.playCount} last:${daysAgo(track.playDate)}` : 'unplayed';
  const fav = track.favorites && track.favorites.length ? ' ♥' : '';
  const skips = track.skipCount ? ` skips:${track.skipCount}` : '';
  const genres = genreNames(state, track.genreIds);
  return `${track.id} | ${track.name} — ${artistNames(state, track.artistIds)} | ${albumName(state, track)}` +
    `${trackPosition(state, track)}${track.year ? ` (${track.year})` : ''} | ${toTime(track.duration)} | ` +
    `${genres || 'no genre'} | ${plays}${skips}${fav}`;
}

const TRACK_LINE_LEGEND = 'Format: id | title — artist | album #track/total (year) | length | genres | play stats. ' +
  'Album track numbers come from the stored album order (no disc numbers in this library).';

function formatTracks(state: RootState, tracks: Track[]): string {
  return tracks.map((t) => formatTrack(state, t)).join('\n');
}

function getPlaylist(state: RootState): DJPlaylist | undefined {
  const playlist = state.currentlyPlaying.playlist;
  return playlist instanceof DJPlaylist ? playlist : undefined;
}

/**
 * Hands the queue to the DJ, creating the DJPlaylist on first use. Every tool that mutates the
 * queue calls this, so the DJ can start a set from a cold app with nothing playing — and so there
 * is no list of "queue tools" to keep in sync when a new one is added.
 */
export function ensureDJPlaylist(): DJPlaylist {
  const state = store.getState();
  const existing = getPlaylist(state);
  if (existing) {
    return existing;
  }
  const currentId = state.currentlyPlaying.currentlyPlayingId;
  const playlist = new DJPlaylist();
  if (currentId) {
    // Adopt the track that is already playing, and inherit whatever the app's own playlist had
    // queued rather than discarding it. DJ_TAKE_OVER leaves playback state alone, so the current
    // track is neither restarted nor un-paused.
    playlist.adopt(currentId, state.currentlyPlaying.playlist.getUpcoming());
    store.dispatch({payload: {playlist}, type: DJ_TAKE_OVER});
  } else {
    store.dispatch({payload: {play: false, playlist}, type: SET_PLAYLIST});
  }
  return playlist;
}

/** Starts playback when the DJ has queued something but nothing is playing (e.g. a cold start). */
export function startIfIdle(): void {
  const state = store.getState();
  const playlist = getPlaylist(state);
  if (playlist && !state.currentlyPlaying.currentlyPlayingId && playlist.getUpcoming().length) {
    store.dispatch({type: NEXT_TRACK});
  }
}

function searchLibrary(state: RootState, input: Record<string, unknown>): ToolOutcome {
  const query = str(input, 'query');
  if (!query) {
    return {content: 'query is required', isError: true};
  }
  const limit = limitOf(input);
  const scored = getAllTracks(state).map((track) => {
    let score = 0;
    if (includes(track.name, query)) {
      score += track.name.toLowerCase() === query.toLowerCase() ? 10 : 4;
    }
    const artists = artistNames(state, track.artistIds);
    if (includes(artists, query)) {
      score += artists.toLowerCase() === query.toLowerCase() ? 6 : 3;
    }
    if (includes(albumName(state, track), query)) {
      score += 2;
    }
    return {score, track};
  }).filter((s) => s.score > 0).sort((a, b) => b.score - a.score || b.track.playCount - a.track.playCount);
  if (!scored.length) {
    return {content: `No tracks match "${query}".`};
  }
  const shown = scored.slice(0, limit).map((s) => s.track);
  const header = `${scored.length} match(es) for "${query}"${scored.length > limit ? `, showing ${limit}` : ''}.`;
  return {content: `${header}\n${TRACK_LINE_LEGEND}\n${formatTracks(state, shown)}`};
}

function listArtists(state: RootState, input: Record<string, unknown>): ToolOutcome {
  const query = str(input, 'query');
  const genre = str(input, 'genre');
  const limit = limitOf(input);
  const offset = Math.max(0, num(input, 'offset') || 0);
  const artists = Object.values(state.library.artists).filter((artist: Artist) => {
    if (query && !includes(artist.name, query)) {
      return false;
    }
    if (genre && !includes(genreNames(state, artist.genreIds), genre)) {
      return false;
    }
    return artist.trackIds.length > 0;
  }).sort((a, b) => b.trackIds.length - a.trackIds.length || a.name.localeCompare(b.name));
  const page = artists.slice(offset, offset + limit);
  const lines = page.map((artist) => {
    const genres = genreNames(state, artist.genreIds);
    return `${artist.name} (${artist.trackIds.length} tracks, ${artist.albumIds.length} albums)${genres ? ` — ${genres}` : ''}`;
  });
  const more = offset + limit < artists.length ? ` Use offset=${offset + limit} for more.` : '';
  return {content: `${artists.length} artist(s); showing ${offset + 1}-${offset + page.length}.${more}\n${lines.join('\n')}`};
}

function listGenres(state: RootState): ToolOutcome {
  const counts: Record<string, number> = {};
  getAllTracks(state).forEach((track) => {
    track.genreIds.forEach((id) => {
      counts[id] = (counts[id] || 0) + 1;
    });
  });
  const lines = Object.keys(counts).map((id) => ({count: counts[id], name: getGenreById(state, id).name}))
    .sort((a, b) => b.count - a.count).map((g) => `${g.name}: ${g.count}`);
  return {content: lines.length ? lines.join('\n') : 'No genres in library.'};
}

function getArtist(state: RootState, input: Record<string, unknown>): ToolOutcome {
  const name = str(input, 'name');
  if (!name) {
    return {content: 'name is required', isError: true};
  }
  const all = Object.values(state.library.artists) as Artist[];
  const artist = all.find((a) => a.name.toLowerCase() === name.toLowerCase()) ||
    all.filter((a) => includes(a.name, name)).sort((a, b) => b.trackIds.length - a.trackIds.length)[0];
  if (!artist) {
    return {content: `No artist matching "${name}". Try search_library or list_artists.`};
  }
  const albums = artist.albumIds.map((id) => getAlbumById(state, id)).filter(Boolean)
    .sort((a: Album, b: Album) => (a.year || 0) - (b.year || 0))
    .map((album: Album) => {
      const year = album.year ? ` (${album.year})` : '';
      const stats = albumPlayStats(state, album);
      const plays = stats.totalPlays ? `, ${stats.totalPlays} plays (~${stats.meanPlays}/track)` : ', unplayed';
      const fav = album.favorites && album.favorites.length ? ' ♥' : '';
      return `${album.id} | ${album.name}${year} — ${album.trackIds.length} tracks${plays}${fav}`;
    });
  const tracks = artist.trackIds.map((id) => getTrackById(state, id)).filter(Boolean);
  const genres = artist.genreIds.length ? ` — ${genreNames(state, artist.genreIds)}` : '';
  return {content: `${artist.name}${genres}
Albums:
${albums.join('\n') || '(none)'}

Tracks (${tracks.length}):
${TRACK_LINE_LEGEND}
${formatTracks(state, tracks)}`};
}

function sampleTracks(state: RootState, input: Record<string, unknown>): ToolOutcome {
  const genre = str(input, 'genre');
  const artist = str(input, 'artist');
  const minYear = num(input, 'min_year');
  const maxYear = num(input, 'max_year');
  const minPlays = num(input, 'min_play_count');
  const favoritesOnly = bool(input, 'favorites_only');
  const unplayedOnly = bool(input, 'unplayed_only');
  const addedWithin = num(input, 'added_within_days');
  const limit = limitOf(input);
  const matches = getAllTracks(state).filter((track) => {
    if (addedWithin !== undefined && !withinDays(track.dateAdded, addedWithin)) {
      return false;
    }
    if (genre && !includes(genreNames(state, track.genreIds), genre)) {
      return false;
    }
    if (artist && !includes(artistNames(state, track.artistIds), artist)) {
      return false;
    }
    if (minYear !== undefined && (!track.year || track.year < minYear)) {
      return false;
    }
    if (maxYear !== undefined && (!track.year || track.year > maxYear)) {
      return false;
    }
    if (minPlays !== undefined && track.playCount < minPlays) {
      return false;
    }
    if (favoritesOnly && !(track.favorites && track.favorites.length)) {
      return false;
    }
    if (unplayedOnly && track.playCount > 0) {
      return false;
    }
    return true;
  });
  if (!matches.length) {
    return {content: 'No tracks match those filters.'};
  }
  // Partial Fisher-Yates: take `limit` random picks without shuffling the whole list.
  const pool = matches.slice();
  const picks: Track[] = [];
  for (let i = 0; i < Math.min(limit, pool.length); i++) {
    const j = i + Math.floor(Math.random() * (pool.length - i));
    [pool[i], pool[j]] = [pool[j], pool[i]];
    picks.push(pool[i]);
  }
  return {content: `${matches.length} track(s) match; random sample of ${picks.length}:\n${TRACK_LINE_LEGEND}\n${formatTracks(state, picks)}`};
}

interface AlbumPlayStats {
  totalPlays: number;
  meanPlays: number;
  skips: number;
  lastPlayed?: Date;
}

/**
 * Album-level play stats, summed from the album's tracks. `album.playCount`/`skipCount` are NOT
 * maintained by playback — only `track.playCount` is incremented when a track finishes (and by
 * mobile sync), so the album fields sit at 0 forever unless hand-edited in the album editor.
 */
function albumPlayStats(state: RootState, album: Album): AlbumPlayStats {
  const tracks = album.trackIds.map((id) => getTrackById(state, id)).filter(Boolean);
  let totalPlays = 0;
  let skips = 0;
  let lastPlayed: Date | undefined;
  tracks.forEach((track) => {
    totalPlays += track.playCount;
    skips += track.skipCount;
    if (track.playCount > 0 && track.playDate && track.playDate.getTime() > 0 &&
        (!lastPlayed || track.playDate.getTime() > lastPlayed.getTime())) {
      lastPlayed = track.playDate;
    }
  });
  return {
    lastPlayed,
    meanPlays: tracks.length ? Math.round(totalPlays / tracks.length) : 0,
    skips,
    totalPlays,
  };
}

function formatAlbum(state: RootState, album: Album): string {
  const artists = album.artistIds.map((id) => getArtistById(state, id)).filter(Boolean)
    .map((a) => a.name).join(', ') || 'Unknown';
  const tracks = album.trackIds.map((id) => getTrackById(state, id)).filter(Boolean);
  const length = toTime(tracks.reduce((total, t) => total + t.duration, 0));
  const genres = genreNames(state, album.genreIds);
  const stats = albumPlayStats(state, album);
  const plays = stats.totalPlays
    ? `plays:${stats.totalPlays} (~${stats.meanPlays}/track) last:${daysAgo(stats.lastPlayed)}`
    : 'unplayed';
  const fav = album.favorites && album.favorites.length ? ' ♥' : '';
  return `${album.id} | ${album.name} — ${artists}${album.year ? ` (${album.year})` : ''} | ` +
    `${album.trackIds.length} tracks, ${length} | ${genres || 'no genre'} | ${plays}` +
    `${stats.skips ? ` skips:${stats.skips}` : ''}${fav}`;
}

const ALBUM_LINE_LEGEND = 'Format: id | title — artist (year) | tracks, length | genres | play stats. ' +
  'Album play stats are summed from the album\'s tracks; ~N/track is the average plays per track.';

function searchAlbums(state: RootState, input: Record<string, unknown>): ToolOutcome {
  const query = str(input, 'query');
  const genre = str(input, 'genre');
  const artist = str(input, 'artist');
  const minYear = num(input, 'min_year');
  const maxYear = num(input, 'max_year');
  const minPlays = num(input, 'min_play_count');
  const favoritesOnly = bool(input, 'favorites_only');
  const unplayedOnly = bool(input, 'unplayed_only');
  const limit = limitOf(input);
  const matches = (Object.values(state.library.albums) as Album[]).filter((album) => {
    if (!album.trackIds.length) {
      return false;
    }
    if (query && !includes(album.name, query)) {
      return false;
    }
    if (genre && !includes(genreNames(state, album.genreIds), genre)) {
      return false;
    }
    if (artist) {
      const names = album.artistIds.map((id) => getArtistById(state, id)).filter(Boolean).map((a) => a.name).join(', ');
      if (!includes(names, artist)) {
        return false;
      }
    }
    if (minYear !== undefined && (!album.year || album.year < minYear)) {
      return false;
    }
    if (maxYear !== undefined && (!album.year || album.year > maxYear)) {
      return false;
    }
    if (minPlays !== undefined || unplayedOnly) {
      const stats = albumPlayStats(state, album);
      if (minPlays !== undefined && stats.meanPlays < minPlays) {
        return false;
      }
      if (unplayedOnly && stats.totalPlays > 0) {
        return false;
      }
    }
    if (favoritesOnly && !(album.favorites && album.favorites.length)) {
      return false;
    }
    return true;
  });
  if (!matches.length) {
    return {content: 'No albums match those filters.'};
  }
  const pool = matches.slice();
  const picks: Album[] = [];
  for (let i = 0; i < Math.min(limit, pool.length); i++) {
    const j = i + Math.floor(Math.random() * (pool.length - i));
    [pool[i], pool[j]] = [pool[j], pool[i]];
    picks.push(pool[i]);
  }
  const lines = picks.map((a) => formatAlbum(state, a)).join('\n');
  const header = `${matches.length} album(s) match; random sample of ${picks.length}:`;
  return {content: `${header}\n${ALBUM_LINE_LEGEND}\n${lines}`};
}

function queueAlbums(input: Record<string, unknown>): ToolOutcome {
  const state = store.getState();
  const albumIds = strList(input, 'album_ids');
  const valid: string[] = [];
  const invalid: string[] = [];
  const trackIds: string[] = [];
  albumIds.forEach((id) => {
    const album = state.library.albums[id];
    if (album) {
      valid.push(id);
      trackIds.push(...album.trackIds.filter((trackId) => state.library.tracks[trackId]));
    } else {
      invalid.push(id);
    }
  });
  if (!valid.length) {
    return {content: `None of those album ids exist: ${invalid.join(', ') || '(none given)'}`, isError: true};
  }
  const playlist = ensureDJPlaylist();
  const position = str(input, 'position') === 'next' ? 'next' : 'end';
  // 'next' with several albums: insert in reverse so the first listed album plays first.
  const ordered = position === 'next' ? valid.slice().reverse() : valid;
  ordered.forEach((albumId) => {
    const album = getAlbumById(state, albumId);
    playlist.addAlbum(album.trackIds.filter((trackId) => state.library.tracks[trackId]), albumId, position);
  });
  store.dispatch({type: DJ_QUEUE_UPDATED});
  startIfIdle();
  const names = valid.map((id) => getAlbumById(state, id).name).join('; ');
  const warning = invalid.length ? `Ignored unknown album ids: ${invalid.join(', ')}\n` : '';
  const summary = `Queued ${valid.length} album(s), ${trackIds.length} tracks, in album order (${position}): ${names}.`;
  const note = 'The listener\'s next/prev-album buttons now skip between these albums.';
  return {content: `${warning}${summary}\n${note}\n\n${describeQueue(store.getState())}`, queueChanged: true};
}

/** Local time, volume, window mode, any UI genre filter, and what this session has played. */
function describeContext(state: RootState): string {
  const now = new Date();
  const parts = [
    now.toLocaleString(undefined, {hour: 'numeric', minute: '2-digit', weekday: 'long'}),
    `volume ${Math.round(state.currentlyPlaying.volume * 100)}%`,
    activity.getWindowMode() === 'mini' ? 'mini player (music is in the background)' : 'full window',
  ];
  const filter = getSelectedGenres(state).map((id) => getGenreById(state, id))
    .filter(Boolean).map((genre) => genre.name);
  if (filter.length) {
    parts.push(`listener's genre filter: ${filter.join('/')}`);
  }
  const playlist = getPlaylist(state);
  if (playlist) {
    const played = playlist.getHistory().map((id) => getTrackById(state, id)).filter(Boolean);
    const listened = played.reduce((total, track) => total + track.duration, 0);
    parts.push(`${played.length} track(s) played this set (${humanDuration(listened)})`);
  }
  parts.push(`app open ${humanDuration(activity.getUptimeMs())}`);
  return parts.join(' · ');
}

/** Now playing, readable even when the DJ queue is not active. */
function withinDays(date: Date | undefined, days: number): boolean {
  if (!date || isNaN(date.getTime()) || date.getTime() <= 0) {
    return false;
  }
  return Date.now() - date.getTime() <= days * 24 * 60 * 60 * 1000;
}

function recentPlays(state: RootState, input: Record<string, unknown>): ToolOutcome {
  const days = num(input, 'days') || 14;
  const limit = limitOf(input);
  const played = getAllTracks(state)
    .filter((track) => track.playCount > 0 && withinDays(track.playDate, days))
    .sort((a, b) => b.playDate.getTime() - a.playDate.getTime());
  if (!played.length) {
    return {content: `Nothing has been played in the last ${days} days.`};
  }
  const shown = played.slice(0, limit);
  const header = `${played.length} track(s) played in the last ${days} days, newest first` +
    `${played.length > limit ? `, showing ${limit}` : ''}:`;
  return {content: `${header}\n${TRACK_LINE_LEGEND}\n${formatTracks(state, shown)}`};
}

function topBy(counts: Record<string, number>, names: (id: string) => string, take: number): string {
  return Object.keys(counts)
    .map((id) => ({count: counts[id], name: names(id)}))
    .filter((entry) => Boolean(entry.name))
    .sort((a, b) => b.count - a.count)
    .slice(0, take)
    .map((entry) => `${entry.name} (${entry.count})`)
    .join(', ');
}

function libraryStats(state: RootState): ToolOutcome {
  const tracks = getAllTracks(state);
  const genrePlays: Record<string, number> = {};
  const artistPlays: Record<string, number> = {};
  const favoritesByYear: Record<string, number> = {};
  let totalPlays = 0;
  let playtimeMs = 0;
  let unplayed = 0;
  let addedRecently = 0;
  tracks.forEach((track) => {
    totalPlays += track.playCount;
    playtimeMs += track.duration * track.playCount;
    if (!track.playCount) {
      unplayed++;
    }
    if (withinDays(track.dateAdded, 90)) {
      addedRecently++;
    }
    track.genreIds.forEach((id) => {
      genrePlays[id] = (genrePlays[id] || 0) + track.playCount;
    });
    track.artistIds.forEach((id) => {
      artistPlays[id] = (artistPlays[id] || 0) + track.playCount;
    });
    (track.favorites || []).forEach((year) => {
      favoritesByYear[year] = (favoritesByYear[year] || 0) + 1;
    });
  });
  const library = state.library;
  const favorites = Object.keys(favoritesByYear).sort()
    .map((year) => `${year}: ${favoritesByYear[year]}`).join(', ') || 'none';
  const pctUnplayed = tracks.length ? Math.round((unplayed / tracks.length) * 100) : 0;
  const genreNameOf = (id: string): string => {
    const genre = getGenreById(state, id);
    return genre ? genre.name : '';
  };
  const artistNameOf = (id: string): string => {
    const artist = getArtistById(state, id);
    return artist ? artist.name : '';
  };
  const size = `Library: ${tracks.length} tracks, ${Object.keys(library.albums).length} albums, ` +
    `${Object.keys(library.artists).length} artists, ${Object.keys(library.playlists).length} playlists`;
  const listening = `Listening: ${totalPlays} plays, ${humanDuration(playtimeMs)} of playtime, ` +
    `${pctUnplayed}% of tracks never played`;
  return {content: `${size}
${listening}
Top genres by plays: ${topBy(genrePlays, genreNameOf, 8) || 'none'}
Top artists by plays: ${topBy(artistPlays, artistNameOf, 10) || 'none'}
Favorites per year: ${favorites}
Added in the last 90 days: ${addedRecently} tracks`};
}

export function describeNowPlaying(state: RootState): string {
  const currentId = state.currentlyPlaying.currentlyPlayingId || undefined;
  const current = currentId ? getTrackById(state, currentId) : undefined;
  const playlist = state.currentlyPlaying.playlist;
  const djActive = playlist instanceof DJPlaylist;
  const lines = [
    current
      ? `Now playing: ${formatTrack(state, current)} [${toTime(getTime(state) * 1000)} elapsed, ` +
        `${state.currentlyPlaying.isPlaying ? 'playing' : 'paused'}]`
      : 'Now playing: nothing',
    `Context: ${describeContext(state)}`,
    `Room: ${activity.describe()}`,
    djActive
      ? 'The DJ queue is active, so set_queue/add_to_queue edit what you already built.'
      : 'The DJ queue is NOT active yet: the app is using its own shuffle. Your first queue edit ' +
        'adopts the current track and inherits what it had queued, without interrupting playback.',
  ];
  if (!djActive) {
    const inherited = playlist.getUpcoming().map((id) => getTrackById(state, id)).filter(Boolean);
    const inheritedLines = formatTracks(state, inherited) || '(none)';
    lines.push(`The app has ${inherited.length} track(s) queued that you would inherit:
${inheritedLines}`);
  }
  return lines.join('\n\n');
}

export function describeQueue(state: RootState): string {
  const playlist = getPlaylist(state);
  if (!playlist) {
    return describeNowPlaying(state);
  }
  const currentId = playlist.getCurrentTrack();
  const current = currentId ? getTrackById(state, currentId) : undefined;
  const now = current ? `${formatTrack(state, current)} [${toTime(getTime(state) * 1000)} elapsed, ` +
    `${state.currentlyPlaying.isPlaying ? 'playing' : 'paused'}]` : '(nothing — queue is empty or stopped)';
  const upcoming = playlist.getUpcoming().map((id) => getTrackById(state, id)).filter(Boolean);
  const history = playlist.getHistory().slice(0, -1).map((id) => getTrackById(state, id)).filter(Boolean);
  const historyLines = history.map((t) => `${t.id} | ${t.name} — ${artistNames(state, t.artistIds)}`);
  return `Now playing: ${now}
Room: ${activity.describe()}

Up next (${upcoming.length}):
${formatTracks(state, upcoming) || '(empty)'}

Played earlier this session (${history.length}):
${historyLines.join('\n') || '(none)'}`;
}

function validateIds(state: RootState, ids: string[]): {valid: string[]; invalid: string[]} {
  const valid: string[] = [];
  const invalid: string[] = [];
  ids.forEach((id) => (state.library.tracks[id] ? valid : invalid).push(id));
  return {valid, invalid};
}

type QueueMutation = (playlist: DJPlaylist, ids: string[]) => void;

function mutateQueue(input: Record<string, unknown>, mutate: QueueMutation): ToolOutcome {
  const state = store.getState();
  const {valid, invalid} = validateIds(state, strList(input, 'track_ids'));
  if (!valid.length && invalid.length) {
    return {content: `None of those ids exist: ${invalid.join(', ')}`, isError: true};
  }
  mutate(ensureDJPlaylist(), valid);
  store.dispatch({type: DJ_QUEUE_UPDATED});
  startIfIdle();
  const warning = invalid.length ? `Ignored unknown ids: ${invalid.join(', ')}\n` : '';
  return {content: `${warning}${describeQueue(store.getState())}`, queueChanged: true};
}

export function executeTool(name: string, input: Record<string, unknown>): ToolOutcome {
  const state = store.getState();
  switch (name) {
  case 'search_library':
    return searchLibrary(state, input);
  case 'list_artists':
    return listArtists(state, input);
  case 'list_genres':
    return listGenres(state);
  case 'get_artist':
    return getArtist(state, input);
  case 'sample_tracks':
    return sampleTracks(state, input);
  case 'search_albums':
    return searchAlbums(state, input);
  case 'queue_albums':
    return queueAlbums(input);
  case 'get_queue':
    return {content: describeQueue(state)};
  case 'now_playing':
    return {content: describeNowPlaying(state)};
  case 'recent_plays':
    return recentPlays(state, input);
  case 'library_stats':
    return libraryStats(state);
  case 'set_queue':
    return mutateQueue(input, (playlist, ids) => playlist.setUpcoming(ids));
  case 'add_to_queue':
    return mutateQueue(input, (playlist, ids) =>
      playlist.addUpcoming(ids, str(input, 'position') === 'next' ? 'next' : 'end'));
  case 'remove_from_queue':
    return mutateQueue(input, (playlist, ids) => playlist.removeUpcoming(ids));
  case 'skip_current': {
    const playlist = getPlaylist(state);
    if (!playlist) {
      return {content: 'DJ queue is not active.', isError: true};
    }
    playlist.noteDJAdvance();
    store.dispatch({type: NEXT_TRACK});
    return {content: describeQueue(store.getState()), queueChanged: true};
  }
  default:
    return {content: `Unknown tool: ${name}`, isError: true};
  }
}
