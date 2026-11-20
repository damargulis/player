## What this is

"MyMusic" — an Electron + React + Redux desktop mp3 player with a companion native Android app (`MusicNative/`, Kotlin + Jetpack Compose). The desktop app imports a library from iTunes, plays local files, and enriches album/artist metadata via Wikipedia and Genius "extensions". The mobile app discovers the desktop over bonjour/mDNS, syncs songs/playlists/play counts, remote-controls playback, and plays synced tracks locally. `BareController/` is the older React Native client kept as a fallback; it shares the same desktop API but no code.

## Where the rest of this lives

Detail is kept beside the code it describes, in nested `CLAUDE.md` files that Claude Code loads
when you work in that directory. **Read the relevant one before changing anything in that area** —
most of what they record is a bug that already happened once.

| File | Covers |
|---|---|
| `src/CLAUDE.md` | Playback and skips, the event log, the Stats page |
| `src/extensions/CLAUDE.md` | Every extension, the error/provenance model, cover art, lyrics, Wikipedia tracklists, Run All and batches |
| `src/dj/CLAUDE.md` | DJ mode: session, tools, prompt rules, the three clients, memory |
| `src/concerts/CLAUDE.md` | The JamBase concert tracker |
| `src/backup/CLAUDE.md` | Offsite backup and the GCP setup |
| `streaming/CLAUDE.md` | Streaming to the phone from GCS via Cloud Run |
| `public/CLAUDE.md` | The main process (`electron.js`, watchdog, window size, system volume) and the game windows |
| `MusicNative/CLAUDE.md` | The Android app |

## Commands

- `yarn electron-dev` — run the app in development (starts the CRA dev server on :3000 and Electron pointed at it). **A dev copy does nothing to the outside world on its own**: the offsite backups and stream catalog, the automatic concerts refresh, the bonjour advertisement and the global Cmd+8/9/0 are all off unless `MYMUSIC_DEV_EFFECTS` names them (`backup`, `concerts`, `bonjour`, `shortcuts`, comma-separated, or `all`) — `src/devSafety.tsx` and `public/devSafety.js`. Before that, a dev launch uploaded its own library to the real backup bucket, spent JamBase calls, and advertised itself to the phone as "MyMusic". Anything you click (Refresh, an extension) still runs, since that is intentional. Stop a dev copy by quitting it; `pkill` skips `will-quit` and used to leave its `dns-sd` advertiser running.
- `yarn build` / `yarn electron-pack` — production build / package the mac app (electron-builder; zip target only — the DMG target needs Python 2, which modern macOS lacks). Never run these with `sudo`: a sudo'd run leaves `build/`/`dist/` root-owned and every later build fails with EACCES until they're `sudo rm -rf`'d.
- `yarn deploy-mac` — package **and** install to `/Applications` (`yarn install-mac` does just the install). Use this rather than unzipping `dist/MyMusic-0.1.0-mac.zip` by hand: the zip itself stores correct Unix modes, but GUI extractors and mode-ignoring copies strip the executable bit off `Contents/MacOS/MyMusic`, which makes macOS report "The application MyMusic can't be opened". The scripts copy the already-correct bundle from `dist/mac/` with `ditto`, preserving modes and the 14 framework symlinks. It refuses to run while the app is open (`pgrep -x MyMusic`) rather than replacing the bundle underneath it — `yarn deploy-mac` checks that *before* packaging via `predeploy-mac`, so you aren't told after a two-minute build; override with `MYMUSIC_FORCE_INSTALL=1`. The script also verifies the installed binary is executable, so a mode-losing copy fails loudly instead of at launch. If you ever do extract the zip manually, use `ditto -x -k <zip> <dest>`, not Finder.
- `yarn test` — run tests with Jest. Tests run **inside Electron** (`jest-electron` runner), not plain Node
- `yarn test src/extensions/wiki/tracklist.test.js` — run a single test file; `yarn test -t "name"` for a single test
- `yarn lint` — tslint with `--fix` (this repo uses tslint, not eslint). It **rewrites files** (quotes, key order), so re-read anything you are mid-edit on afterwards. Three errors are pre-existing and not yours: two `contextIsolation` key-order complaints in `public/electron.js` and one long line in `src/TrackPicker.tsx`.
- `npx tsc --noEmit -p tsconfig.json` — **type-check before claiming a TS change is good.** Neither `yarn test` (jest strips types via babel) nor `yarn lint` type-checks, so both pass happily on a tree that `yarn build`/`yarn deploy-mac` will reject. A missing type-only import is invisible to everything else.
- Mobile app (`MusicNative/`, the primary Android client, package `com.example.musicnative`): build a release APK with `cd MusicNative && JAVA_HOME=/Library/Java/JavaVirtualMachines/zulu-11.jdk/Contents/Home ./gradlew assembleRelease` (JDK 11, AGP 7.3.1). Release builds sign with the debug keystore for sideloading; debug builds get a `.debug` application-id suffix. It was merged in via `git subtree` from its own repo and keeps its own `.gitignore`.
- Legacy mobile app (`BareController/`, RN 0.62): build a release APK with `cd BareController/android && NODE_OPTIONS=--openssl-legacy-provider JAVA_HOME=$(/usr/libexec/java_home -v 1.8.0_292) ./gradlew assembleRelease`. Needs JDK 8 (AGP 3.5), the legacy OpenSSL provider (metro's md4 vs Node 17+), and the committed `patches/` (patch-package fixes track-player for ExoPlayer 2.13, since 2.10 died with jcenter). This machine is Apple Silicon: only arm64 AVDs run (e.g. ShowTimeTest); the old x86 AVDs don't. Emulators can't receive mDNS multicast — test discovery on a real phone; test connection/sync in-emulator via manual IP `10.0.2.2`.

## Testing

The tests run **inside an Electron renderer** (`jest-electron`), which shapes what is possible:

- **`jest.mock` is unusable.** Stub at a seam instead: replace `global.fetch`, write fixtures to
  disk, or pull the logic into a pure function the test can call. Most of the `*.tsx` modules
  that export a small pure helper beside their I/O do so for exactly this reason.
- **`ipcRenderer` is `undefined`.** `require('electron')` resolves to a path string under the
  runner, so any code path that reaches `ipcRenderer.send` throws. Test the logic around it, not
  the messages.
- **A module containing JSX can be imported** — but only since `babel.config.js` gained
  `@babel/preset-react`. Before that the first `<` was a syntax error and no component could be
  tested at all. `babel.config.js` is for the tests only; the production build has its own config.
- **`alert()` blocks the whole run.** It opens a modal in the renderer the tests are running in, and
  the suite waits until someone dismisses it — which looks exactly like an intermittent failure.
  Anything that alerts must check `IS_TEST` from `src/constants.tsx` (the empty-library guard in
  the library reducer does).
- `DATA_DIR` resolves to a per-process temp dir under test, never the real library, because the
  library reducer persists on every mutating action. It is shared by every suite in a run, so a
  test that dispatches a library with **no tracks** walks into the empty-library guard; give a
  fixture at least one track.
- **Never hardcode a date a test depends on the distance to.** A concert fixture pinned to
  `2026-11-14` passed for weeks and then failed twice in a day as the real date drifted into its
  window. Build such dates relative to `new Date()`.
- **Prove a new test can fail.** Revert the fix and run it. Two tests written this way passed
  regardless at first — one stubbed `global.alert` where the code calls `window.alert`, another
  used a fixture under the guard's 1024-byte threshold — and were testing nothing.
- Expect each run to log redux actions to the console (`src/redux/middleware/logger.tsx`); that
  noise is normal.

## Architecture

Two Electron processes plus an embedded HTTP server, communicating over IPC:

- **Main process — `public/electron.js`** (plain JS, not compiled from `src/`). Creates the frameless main window, app menu (Library → "Reset from itunes", which asks first, Extensions → Wikipedia/Genius, Games → the `GAMES` registry), and global shortcuts (Cmd+8/9/0 = prev/play/next). Also runs an Express + socket.io server (port 4444 dev, 4443 prod) published over bonjour as "MyMusic" — this is the mobile-app API (`/get-track/:id`, `/get-album-art/:id`, `/start-sync`, socket "state"/"action" events). It is **unauthenticated**; socket actions pass an allowlist and an origin check in `public/lanGuard.js`, and a new client action must be added there (see `public/CLAUDE.md`). The main process holds almost no state; every HTTP request is proxied to the renderer over IPC (`extEvt.reply(...)` → renderer answers with `ipcMain.once(...)`).
- **Renderer — `src/`**. `nodeIntegration` is enabled and webpack targets `electron-renderer` (via `@rescripts`, see `.rescriptsrc.js` → `.webpack.config.js`), so renderer code freely imports `fs`, `path`, and `electron`. `App.tsx` is the connected root: it owns the `<audio>` element, registers all IPC listeners (minimize/maximize, run-extension, reset-library, mobile sync/data requests), and schedules daily library backups. Two UI modes: `MaxWindow` (full library browser) and `MiniWindow` (240×120 mini-player), toggled by resizing the window via IPC (`public/windowSize.js` remembers the full-size window across the round trip). The main process also runs a **watchdog** that pings the renderer and offers a reload when it stops answering — a renderer that has deadlocked cannot detect that about itself; see `public/CLAUDE.md`.

### State & persistence

- Separately from the owner's `favorites`, `Track.reactions` keys per-person likes/dislikes by year (`src/reactions.tsx`); the web app's ♥/👎 write them via a `dj-react` action, they show on DJ track lines as `♥name`/`✗name`, and `getAutoPlaylists` derives a "<name>'s Likes/Dislikes of <year>" playlist for each.
- All Redux action types **and** domain interfaces (`Track`, `Album`, `Artist`, `Genre`, `Playlist`, `LibraryState`) live in `src/redux/actionTypes.tsx`. Each entity has a partial `*Info` twin used for updates — **derived**, as `Partial<Omit<Entity, 'id'>>`, so a field added to an entity is automatically updatable. They used to be hand-written copies, where a field missing from the twin was silently unupdatable. `TrackInfo` keeps one override so `genius` can be partial inside. `LibraryInfo` deltas are merged into state by `UPDATE_LIBRARY`; the reducer **spreads** an update over the entity, so a key that is present and `undefined` or `null` overwrites the field — omit a key you do not mean to change.
- Reducers: `library`, `currentlyPlaying` (playlist, time, volume), `settings` (genre filter). Entities reference each other by id string (`trackIds`, `albumIds`, `artistIds`, `genreIds`).
- `save()` in `src/redux/reducers/library.tsx` refuses to overwrite a non-trivial `library.json` with an empty library (`wouldDestroyLibrary`), and `App.tsx` only auto-imports a fresh library when the file is genuinely missing (`ENOENT`) — any other read error alerts and changes nothing. Both exist because a single failed load used to silently replace the whole library with an empty one.
- **Every write of `library.json` goes through `atomicSave` (`src/library/atomicSave.tsx`)**, which writes a sibling and renames, and serialises writes per file so two never overlap. `save()` is called from the reducer on *every* mutating action, so a batching extension fires dozens in a row — a cover-art sweep is ~80 saves of 13MB, a lyrics sweep ~190. Plain `fs.writeFile` truncates on open but is **not atomic**, and 13MB is many `write` syscalls: two overlapping calls each start at offset zero with their own file position, so the shorter one's bytes land inside the longer one's length. That really happened — the file ended in `"newTracks":[]}` followed by four copies of `wTracks":[]}`, 48 bytes of an earlier write left on the end, and the app could not open at all. Recovery was to truncate at the end of the valid document; nothing was lost. The old writer reproduces it at 8 failures in 12 attempts, the new one 0 in 12, and `atomicSave.test.js` pins that. Saves also **coalesce**: the file is written whole, so an intermediate version is worthless once a newer one exists. Monthly backups go through it too — a unique name cannot race, but a crash mid-write otherwise leaves a truncated backup that looks fine until the day it is needed.
- The library persists as a JSON file in `DATA_DIR` (`./data` in dev, `userData/data` packaged — see `src/constants.tsx`). `src/library/main.tsx` loads/saves it (load re-hydrates `Date` fields manually); `src/library/itunes.tsx` does the initial import from an iTunes XML export. `data/` also holds downloaded album/artist art (shortid-named files).
- Playback queues are class-based: `src/playlist/EmptyPlaylist.tsx` is the base, with `RandomAlbumPlaylist` / `RandomTrackPlaylist` implementations stored directly in Redux state.

## Gotchas

- The toolchain is old: React 16, TypeScript 3.7, Electron 13, react-scripts 2 patched through `@rescripts`. Don't modernize syntax or bump deps incidentally. The `start`/`build` scripts need `NODE_OPTIONS=--openssl-legacy-provider` (webpack 4's md4 hash vs Node 17+), and the BrowserWindows need `contextIsolation: false` + `enableRemoteModule: true` (Electron 12+ changed both defaults; the renderer uses `require` and `electron.remote` freely).
- All TypeScript files use the `.tsx` extension, including non-component modules (redux, library, extensions).
- **`loadLibrary` in `src/library/main.tsx` rebuilds every entity field by field**, so a field added to `Track`/`Album`/`Artist` and not added there is silently discarded — the entity loads, the app runs, and the next save writes the library back without it. `lyrics` was missing, so every restart erased the lyrics markers for the whole library (18,949 of them) while leaving the `.lrc` files on disk; the only symptom was the `L` quietly vanishing. `src/library/libraryRoundTrip.test.js` fails if any field is dropped again, using fully-populated fixtures so an omission cannot pass because the test data never set that field. Recovery needed no API calls — `markerFromStoredFile` rebuilds a marker from the stored file — which is the whole reason that function exists.
- `src/mediaSession.tsx` feeds the OS **Now Playing** card (menu bar, media keys, and what an AirPlay receiver shows on a TV). Without it the card falls back to the page title and blank art — which is how a TV ended up displaying "React App". Artwork must be a **data URL**, not `file://`: in dev the page is served from localhost and Chromium will not load a `file://` image into it. The MediaSession API postdates TS 3.7's DOM lib, so its types are declared locally; Chromium 91 implements it fine at runtime.
- `App.tsx` tracks `loadedPath` (the file in the audio element) instead of comparing the current track's path against the previous render's. When the same file plays twice in a row the path does not change, so a path comparison never reloads it — and `ended` has already blanked `src`, so playback stops dead with nothing left to restart it. That, plus `DJPlaylist.setEntries` dropping a **leading** duplicate of the playing track (the DJ reads the queue, thinks, and the song ends before its write lands, so its list leads with a track that is now playing), is the "queued twice and stuck" bug; `src/playlist/djQueueRace.test.js` covers the queue half.
- `new Date(someString)` reads a date-only value (`2027-01-14`) as UTC midnight, so it lands on the previous day in any negative-offset timezone. Use `localDate`/`dayKey` from `src/utils.tsx` for dates that are already local to whatever they describe. Full timestamps rehydrated from the library JSON are unaffected.
- The mirror image: **`date.toISOString().slice(0, 10)` is the UTC day, not the local one** — west of Greenwich it is already tomorrow for the last hours of every evening. Use `localDayKey(date)` from `src/utils.tsx`. It was live in three places at once: the DJ's concert window returned two days of shows for "the next day", the concerts calendar highlighted tomorrow as today, and the JamBase sweep dropped tonight's shows. `toISOString()` is still right for a genuine instant (log timestamps, object names).
- **`mapStateToProps` must not build fresh closures or arrays**, or `connect` can never bail out and every connected component re-renders on every action — `timeupdate` dispatches about four times a second throughout playback. Measured on this library the selector work alone was ~2.9ms per action (the 21,078-track genre filter 2.47ms of it, the 2,176-album one 0.34ms), so ~11ms per second of playback before counting the React reconciliation it forced. `src/redux/memo.tsx` fixes it: `boundTo(slice, store, fn)` reuses one wrapper while the slice is unchanged, and `memoize` caches a derived array on argument identity. After it, a playback second costs 0.01ms and `connect` skips the re-render on 100% of those actions. **`boundTo` is only valid for a selector that reads nothing but the slice it is keyed on** — the wrapper closes over the store it was built with, so a selector touching another slice would answer from a stale one; every selector used this way reads only `store.library`, which was checked rather than assumed, while `getTime` and `getCurrentTrackId` read `currentlyPlaying` and are passed as values. Three more were found later and fixed the same way — `ConcertsPage` walked all ~21k tracks per call (5.25ms, 21ms/sec of playback), `AlbumInfo` rebuilt all 2,181 albums **per grid cell** (12ms/sec), and `DJPage` rebuilt three closures. The editor modals still build closures and are deliberately left alone: they only exist while open, so they are never on the playback path. A quick check for new offenders is a `mapStateToProps` that builds arrays or closures without `boundTo`/`memoize`. **`memoize` must never be keyed on the root state**, which is a new object on every action — that is how AlbumPage, ArtistPage, PlaylistPage, NewTracksPage, AlbumInfo, ArtistInfo, InfoPanel and the three pickers all went on re-rendering through playback after this fix. A selector that reads only the library uses `libraryMemo` (`src/redux/memo.tsx`), made **once per component instance** in a `connect` factory (`connect(() => { const sel = libraryMemo(...); return (state) => ... })`), because a module-level cache is one slot that every mounted copy evicts. App's lookups are module-level functions that read the live store when called. Measured afterwards: over five seconds of playback, 120 mounted album cells rendered 0 times and App twice (play, pause).
- `readEnvValue` (`src/envFile.tsx`) caches a **miss** for the lifetime of the process, so adding a key to an env file always needs an app restart — with no hint that that is why it is still "not found". This has already cost one round of confusion with `JAMBASE_API_KEY`.
- **Adding a dependency: `yarn add --ignore-scripts <pkg>`, then `node node_modules/electron/install.js`
  and the same in `node_modules/jest-electron/node_modules/electron`.** A plain `yarn add` dies
  compiling `libxmljs` (unused, and it does not build on this Node), and yarn re-extracts packages
  on any add, so both Electron copies lose their `dist/` binary — the app and the test runner then
  fail with "Electron failed to install correctly". The install scripts restore them from
  `~/Library/Caches/electron` without a download. Do not run the `postinstall` (`rn-nodeify --hack`)
  by hand to "finish" an install: it rewrote the `browser` field of ~3,300 packages, which broke
  webpack's resolution of `musicmetadata` and `supports-color`, and the working tree has never had
  it applied. If that happens, `yarn install --force --ignore-scripts --frozen-lockfile` and the two
  Electron install scripts put everything back.
- `postinstall` runs `rn-nodeify` and `electron-builder install-app-deps`; `fs` is aliased to `react-native-level-fs` in the `browser`/`react-native` fields of package.json. In practice it never runs — see the previous point.
- **Skip detection compares track ids, never track objects.** `App.componentDidUpdate` records a
  skip when the playing track changes, and any update to the track — a play count, a favourite —
  replaces its object without the track changing. Comparing objects recorded a skip for every song
  that played to the end (`ended` bumps the play count before it advances), and the skip's own
  update triggered the next one. See `src/CLAUDE.md`.
- `MaxWindow` keeps a **stack of scenes** and hides the inactive ones with `display: none` rather
  than unmounting them, so every page you navigated through stays mounted and connected until the
  sidebar resets the stack (`setType`). Cost that matters on one page matters on all of them.
- The genre filter (`settings.genres`) is read by each picker through its own memoised filter;
  `MaxWindow` hands them the whole library. There used to be a `genres` list in `MaxWindow`'s state
  and three genre-filtering selectors fed from it — it was always empty and they are gone.
