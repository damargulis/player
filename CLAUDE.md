## What this is

"MyMusic" — an Electron + React + Redux desktop mp3 player with a companion React Native mobile app (`BareController/`). The desktop app imports a library from iTunes, plays local files, and enriches album/artist metadata via Wikipedia and Genius "extensions". The mobile app discovers the desktop over bonjour/mDNS, syncs songs/playlists/play counts, and remote-controls playback.

## Commands

- `yarn electron-dev` — run the app in development (starts the CRA dev server on :3000 and Electron pointed at it)
- `yarn build` / `yarn electron-pack` — production build / package the mac app (electron-builder)
- `yarn test` — run tests with Jest. Tests run **inside Electron** (`jest-electron` runner), not plain Node
- `yarn test src/extensions/wiki/albums.test.js` — run a single test file; `yarn test -t "name"` for a single test
- `yarn lint` — tslint with `--fix` (this repo uses tslint, not eslint)
- Mobile app: `cd BareController; react-native start; react-native run-android` (excluded from Jest via `testPathIgnorePatterns`)

## Architecture

Two Electron processes plus an embedded HTTP server, communicating over IPC:

- **Main process — `public/electron.js`** (plain JS, not compiled from `src/`). Creates the frameless main window, app menu (Library → "Reset from itunes", Extensions → Wikipedia/Genius), and global shortcuts (Cmd+8/9/0 = prev/play/next). Also runs an Express + socket.io server (port 4444 dev, 4443 prod) published over bonjour as "MyMusic" — this is the mobile-app API (`/get-track/:id`, `/get-album-art/:id`, `/start-sync`, socket "state"/"action" events). The main process holds almost no state; every HTTP request is proxied to the renderer over IPC (`extEvt.reply(...)` → renderer answers with `ipcMain.once(...)`).
- **Renderer — `src/`**. `nodeIntegration` is enabled and webpack targets `electron-renderer` (via `@rescripts`, see `.rescriptsrc.js` → `.webpack.config.js`), so renderer code freely imports `fs`, `path`, and `electron`. `App.tsx` is the connected root: it owns the `<audio>` element, registers all IPC listeners (minimize/maximize, run-extension, reset-library, mobile sync/data requests), and schedules daily library backups. Two UI modes: `MaxWindow` (full library browser) and `MiniWindow` (240×120 mini-player), toggled by resizing the window via IPC.

### State & persistence

- All Redux action types **and** domain interfaces (`Track`, `Album`, `Artist`, `Genre`, `Playlist`, `LibraryState`) live in `src/redux/actionTypes.tsx`. Each entity has a partial `*Info` twin (`AlbumInfo`, etc.) used for updates; `LibraryInfo` deltas are merged into state by `UPDATE_LIBRARY`.
- Reducers: `library`, `currentlyPlaying` (playlist, time, volume), `settings` (genre filter). Entities reference each other by id string (`trackIds`, `albumIds`, `artistIds`, `genreIds`).
- The library persists as a JSON file in `DATA_DIR` (`./data` in dev, `userData/data` packaged — see `src/constants.tsx`). `src/library/main.tsx` loads/saves it (load re-hydrates `Date` fields manually); `src/library/itunes.tsx` does the initial import from an iTunes XML export. `data/` also holds downloaded album/artist art (shortid-named files).
- Playback queues are class-based: `src/playlist/EmptyPlaylist.tsx` is the base, with `RandomAlbumPlaylist` / `RandomTrackPlaylist` implementations stored directly in Redux state.

### Extensions

`src/extensions/wiki`, `src/extensions/musicbrainz`, and `src/extensions/genius` batch-fetch metadata for the whole library using `es6-promise-pool`. They're triggered from the app menu (main process → `run-extension` IPC → `App.tsx`), report per-item progress via `extension-update` IPC to a dedicated `ExtensionMonitor` window (`public/extension_monitor.html`), and resolve to a `LibraryInfo` delta dispatched through `updateLibrary`. Failures are recorded on the entity's `errors` array rather than thrown, using the shared `ExtensionError` enum in `src/extensions/errors.tsx` — an error means *no* extension could fill that data, so any extension that succeeds clears it, and `NO_MATCH` is only set when an entity has neither a `wikiPage` nor an `mbid`. Wiki parsing tests use saved HTML fixtures in `src/extensions/wiki/test_pages/`. The MusicBrainz API client (`src/extensions/musicbrainz/api.tsx`) serializes requests ~1.1s apart to respect MB's 1 req/sec rate limit.

## Gotchas

- The toolchain is old: React 16, TypeScript 3.7, Electron 13, react-scripts 2 patched through `@rescripts`. Don't modernize syntax or bump deps incidentally. The `start`/`build` scripts need `NODE_OPTIONS=--openssl-legacy-provider` (webpack 4's md4 hash vs Node 17+), and the BrowserWindows need `contextIsolation: false` + `enableRemoteModule: true` (Electron 12+ changed both defaults; the renderer uses `require` and `electron.remote` freely).
- All TypeScript files use the `.tsx` extension, including non-component modules (redux, library, extensions).
- `postinstall` runs `rn-nodeify` and `electron-builder install-app-deps`; `fs` is aliased to `react-native-level-fs` in the `browser`/`react-native` fields of package.json.
