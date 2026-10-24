import {buildCatalog} from './catalog';
import {objectNameForTrack} from './musicBackup';
import os from 'os';

const HOME = os.homedir();
const pathFor = (name) => `${HOME}/Music/${name}`;
const objFor = (name) => objectNameForTrack(pathFor(name));

const library = {
  albums: {al1: {name: 'Stadium Arcadium'}},
  artists: {ar1: {name: 'Red Hot Chili Peppers'}},
  tracks: {
    t1: {
      albumIds: ['al1'], artistIds: ['ar1'], duration: 282000,
      filePath: pathFor('a.mp3'), id: 't1', name: 'Dani California', year: 2006,
    },
    t2: {
      albumIds: ['al1'], artistIds: ['ar1'], duration: 268000,
      filePath: pathFor('b.mp3'), id: 't2', name: 'Snow', year: 2006,
    },
  },
};

describe('buildCatalog', () => {
  // The whole point of intersecting with the manifest: during the bulk upload the library
  // describes 21,000 tracks and the bucket holds a few hundred. Listing the rest would give
  // the phone thousands of entries that 404.
  it('lists only tracks the manifest confirms are uploaded', () => {
    const catalog = buildCatalog(library, {[objFor('a.mp3')]: {size: 5}});
    expect(catalog.tracks.map((t) => t.id)).toEqual(['t1']);
    expect(catalog.count).toEqual(1);
  });

  it('lists nothing when nothing has been uploaded yet', () => {
    expect(buildCatalog(library, {}).tracks).toEqual([]);
  });

  it('resolves artist and album names, since ids mean nothing on the phone', () => {
    const [track] = buildCatalog(library, {[objFor('a.mp3')]: {size: 5}}).tracks;
    expect(track.artist).toEqual('Red Hot Chili Peppers');
    expect(track.album).toEqual('Stadium Arcadium');
    expect(track.name).toEqual('Dani California');
    expect(track.duration).toEqual(282000);
  });

  it('carries the object name so the service can resolve id to bytes', () => {
    const [track] = buildCatalog(library, {[objFor('a.mp3')]: {size: 5}}).tracks;
    expect(track.object).toEqual(objFor('a.mp3'));
  });

  it('honours a 403-derived manifest entry, which means the bytes are there', () => {
    const catalog = buildCatalog(library, {[objFor('a.mp3')]: {already: true, size: 5}});
    expect(catalog.count).toEqual(1);
  });

  it('survives a track with no artist or album without inventing one', () => {
    const orphan = {tracks: {t9: {filePath: pathFor('c.mp3'), id: 't9', name: 'Untitled'}}};
    const [track] = buildCatalog(orphan, {[objFor('c.mp3')]: {size: 1}}).tracks;
    expect(track.artist).toEqual('');
    expect(track.album).toEqual('');
  });

  it('skips tracks with no file path rather than emitting a bad object name', () => {
    const broken = {tracks: {t9: {filePath: '', id: 't9', name: 'Ghost'}}};
    expect(buildCatalog(broken, {}).tracks).toEqual([]);
  });

  it('de-duplicates two tracks pointing at one file', () => {
    const dupe = {
      tracks: {
        t1: {filePath: pathFor('a.mp3'), id: 't1', name: 'One'},
        t2: {filePath: pathFor('a.mp3'), id: 't2', name: 'Two'},
      },
    };
    expect(buildCatalog(dupe, {[objFor('a.mp3')]: {size: 5}}).count).toEqual(1);
  });

  it('stamps a generation time so the service can tell staleness', () => {
    const at = new Date('2026-10-24T18:42:34.000Z');
    expect(buildCatalog(library, {}, at).generatedAt).toEqual('2026-10-24T18:42:34.000Z');
  });
});
