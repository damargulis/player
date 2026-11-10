## What this is

"MyMusic" — an Electron + React + Redux desktop mp3 player with a companion native Android app (`MusicNative/`, Kotlin + Jetpack Compose). The desktop app imports a library from iTunes, plays local files, and enriches album/artist metadata via Wikipedia and Genius "extensions". The mobile app discovers the desktop over bonjour/mDNS, syncs songs/playlists/play counts, remote-controls playback, and plays synced tracks locally. `BareController/` is the older React Native client kept as a fallback; it shares the same desktop API but no code.

## Commands

- `yarn electron-dev` — run the app in development (starts the CRA dev server on :3000 and Electron pointed at it)
- `yarn build` / `yarn electron-pack` — production build / package the mac app (electron-builder; zip target only — the DMG target needs Python 2, which modern macOS lacks). Never run these with `sudo`: a sudo'd run leaves `build/`/`dist/` root-owned and every later build fails with EACCES until they're `sudo rm -rf`'d.
- `yarn deploy-mac` — package **and** install to `/Applications` (`yarn install-mac` does just the install). Use this rather than unzipping `dist/MyMusic-0.1.0-mac.zip` by hand: the zip itself stores correct Unix modes, but GUI extractors and mode-ignoring copies strip the executable bit off `Contents/MacOS/MyMusic`, which makes macOS report "The application MyMusic can't be opened". The scripts copy the already-correct bundle from `dist/mac/` with `ditto`, preserving modes and the 14 framework symlinks. It refuses to run while the app is open (`pgrep -x MyMusic`) rather than replacing the bundle underneath it — `yarn deploy-mac` checks that *before* packaging via `predeploy-mac`, so you aren't told after a two-minute build; override with `MYMUSIC_FORCE_INSTALL=1`. The script also verifies the installed binary is executable, so a mode-losing copy fails loudly instead of at launch. If you ever do extract the zip manually, use `ditto -x -k <zip> <dest>`, not Finder.
- `yarn test` — run tests with Jest. Tests run **inside Electron** (`jest-electron` runner), not plain Node
- `yarn test src/extensions/wiki/albums.test.js` — run a single test file; `yarn test -t "name"` for a single test
- `yarn lint` — tslint with `--fix` (this repo uses tslint, not eslint)
- `npx tsc --noEmit -p tsconfig.json` — **type-check before claiming a TS change is good.** Neither `yarn test` (jest strips types via babel) nor `yarn lint` type-checks, so both pass happily on a tree that `yarn build`/`yarn deploy-mac` will reject. A missing type-only import is invisible to everything else.
- Mobile app (`MusicNative/`, the primary Android client, package `com.example.musicnative`): build a release APK with `cd MusicNative && JAVA_HOME=/Library/Java/JavaVirtualMachines/zulu-11.jdk/Contents/Home ./gradlew assembleRelease` (JDK 11, AGP 7.3.1). Release builds sign with the debug keystore for sideloading; debug builds get a `.debug` application-id suffix. It was merged in via `git subtree` from its own repo and keeps its own `.gitignore`.
- Legacy mobile app (`BareController/`, RN 0.62): build a release APK with `cd BareController/android && NODE_OPTIONS=--openssl-legacy-provider JAVA_HOME=$(/usr/libexec/java_home -v 1.8.0_292) ./gradlew assembleRelease`. Needs JDK 8 (AGP 3.5), the legacy OpenSSL provider (metro's md4 vs Node 17+), and the committed `patches/` (patch-package fixes track-player for ExoPlayer 2.13, since 2.10 died with jcenter). This machine is Apple Silicon: only arm64 AVDs run (e.g. ShowTimeTest); the old x86 AVDs don't. Emulators can't receive mDNS multicast — test discovery on a real phone; test connection/sync in-emulator via manual IP `10.0.2.2`.

## Architecture

Two Electron processes plus an embedded HTTP server, communicating over IPC:

- **Main process — `public/electron.js`** (plain JS, not compiled from `src/`). Creates the frameless main window, app menu (Library → "Reset from itunes", Extensions → Wikipedia/Genius, Games → the `GAMES` registry), and global shortcuts (Cmd+8/9/0 = prev/play/next). Also runs an Express + socket.io server (port 4444 dev, 4443 prod) published over bonjour as "MyMusic" — this is the mobile-app API (`/get-track/:id`, `/get-album-art/:id`, `/start-sync`, socket "state"/"action" events). The main process holds almost no state; every HTTP request is proxied to the renderer over IPC (`extEvt.reply(...)` → renderer answers with `ipcMain.once(...)`).
- **Renderer — `src/`**. `nodeIntegration` is enabled and webpack targets `electron-renderer` (via `@rescripts`, see `.rescriptsrc.js` → `.webpack.config.js`), so renderer code freely imports `fs`, `path`, and `electron`. `App.tsx` is the connected root: it owns the `<audio>` element, registers all IPC listeners (minimize/maximize, run-extension, reset-library, mobile sync/data requests), and schedules daily library backups. Two UI modes: `MaxWindow` (full library browser) and `MiniWindow` (240×120 mini-player), toggled by resizing the window via IPC.

### State & persistence

- Separately from the owner's `favorites`, `Track.reactions` keys per-person likes/dislikes by year (`src/reactions.tsx`); the web app's ♥/👎 write them via a `dj-react` action, they show on DJ track lines as `♥name`/`✗name`, and `getAutoPlaylists` derives a "<name>'s Likes/Dislikes of <year>" playlist for each.
- All Redux action types **and** domain interfaces (`Track`, `Album`, `Artist`, `Genre`, `Playlist`, `LibraryState`) live in `src/redux/actionTypes.tsx`. Each entity has a partial `*Info` twin (`AlbumInfo`, etc.) used for updates; `LibraryInfo` deltas are merged into state by `UPDATE_LIBRARY`.
- Reducers: `library`, `currentlyPlaying` (playlist, time, volume), `settings` (genre filter). Entities reference each other by id string (`trackIds`, `albumIds`, `artistIds`, `genreIds`).
- `save()` in `src/redux/reducers/library.tsx` refuses to overwrite a non-trivial `library.json` with an empty library (`wouldDestroyLibrary`), and `App.tsx` only auto-imports a fresh library when the file is genuinely missing (`ENOENT`) — any other read error alerts and changes nothing. Both exist because a single failed load used to silently replace the whole library with an empty one.
- **Every write of `library.json` goes through `atomicSave` (`src/library/atomicSave.tsx`)**, which writes a sibling and renames, and serialises writes per file so two never overlap. `save()` is called from the reducer on *every* mutating action, so a batching extension fires dozens in a row — a cover-art sweep is ~80 saves of 13MB, a lyrics sweep ~190. Plain `fs.writeFile` truncates on open but is **not atomic**, and 13MB is many `write` syscalls: two overlapping calls each start at offset zero with their own file position, so the shorter one's bytes land inside the longer one's length. That really happened — the file ended in `"newTracks":[]}` followed by four copies of `wTracks":[]}`, 48 bytes of an earlier write left on the end, and the app could not open at all. Recovery was to truncate at the end of the valid document; nothing was lost. The old writer reproduces it at 8 failures in 12 attempts, the new one 0 in 12, and `atomicSave.test.js` pins that. Saves also **coalesce**: the file is written whole, so an intermediate version is worthless once a newer one exists. Monthly backups go through it too — a unique name cannot race, but a crash mid-write otherwise leaves a truncated backup that looks fine until the day it is needed.
- The library persists as a JSON file in `DATA_DIR` (`./data` in dev, `userData/data` packaged — see `src/constants.tsx`). `src/library/main.tsx` loads/saves it (load re-hydrates `Date` fields manually); `src/library/itunes.tsx` does the initial import from an iTunes XML export. `data/` also holds downloaded album/artist art (shortid-named files).
- Playback queues are class-based: `src/playlist/EmptyPlaylist.tsx` is the base, with `RandomAlbumPlaylist` / `RandomTrackPlaylist` implementations stored directly in Redux state.

### Extensions

`src/extensions/wiki`, `src/extensions/musicbrainz`, and `src/extensions/genius` batch-fetch metadata for the whole library using `es6-promise-pool`. They're triggered from the app menu (main process → `run-extension` IPC → `App.tsx`), report per-item progress via `extension-update` IPC to a dedicated `ExtensionMonitor` window (`public/extension_monitor.html`), and resolve to a `LibraryInfo` delta dispatched through `updateLibrary`. A new `extensionId` is what opens a window, so each `run*Extension` takes an **optional shared id**: a Run All passes one, and the five steps report into a single window instead of opening five. The monitor **accumulates** summaries above a progress area that survives, because `done` used to clear the whole body and would otherwise have destroyed the elements the later steps needed and left only the last summary. A grouped run announces itself with `group` (which suppresses the per-step Done button — offering to close after step one of five is a lie) and finishes with `group-done`, sent whatever happened: a step that throws never sends its own summary, so counting summaries would leave the window with no way out. The palette lives in `public/theme.css`, shared by the monitor and by `game-common.css`, so the `file://` pages have one definition to keep in step with `src/App.css`. Failures are recorded on the entity's `errors` array rather than thrown, using the shared `ExtensionError` enum in `src/extensions/errors.tsx` — an error means *no* extension could fill that data, so any extension that succeeds clears it, and `NO_MATCH` is only set when an entity has neither a `wikiPage` nor an `mbid`. **`ALBUM_ART` and `PIC` are derived, not reported**: they state that the entity has no picture, which is a fact about the entity, so every writer and `loadLibrary` both put them through `setError`/`withError` keyed on whether the file is actually set. Recorded instead as "a download failed", they drifted both ways — 257 of the 267 albums flagged "No album art found" had art, 34 albums with none were flagged with nothing, and artists were wrong 56 and 78 ways. A failed request against an album that already has a cover is not a missing cover, and a successful fetch is not the only way to come to have one. Deriving it on load means a stale flag corrects itself at next launch rather than needing an extension run. Wiki parsing tests use saved HTML fixtures in `src/extensions/wiki/test_pages/`. The genre parser **skips `<style>`, `<script>`, `<noscript>` and `<template>`**: Wikipedia injects **TemplateStyles** into the infobox — a `<style>` element sitting inside the genre cell carrying the Hlist stylesheet — and walking into it read the CSS as text and split it on commas, so `.mw-parser-output .hlist dl` and 38 more like it became genres on most pages the extension touched. A second guard rejects any candidate containing braces, semicolons, angle brackets or a leading dot, because a stylesheet reaching the formatter once already cost 39 junk genres. It is structural only — there is deliberately **no length limit**: every one of those 39 carried one of those characters, so a limit rejected nothing real while standing ready to discard a long genuine genre. `loadLibrary` drops stored genres that look like CSS **and are referenced by nothing**, so the file repairs itself; a referenced one is kept, since a dangling id is worse than a visibly wrong genre. `genres.test.js` pins it against the real Radiohead infobox as served. Genius answers a rate limit with **HTML and a `Retry-After` measured in thousands of seconds** (roughly an hourly quota), so `genius/api.tsx` checks `res.ok` *before* parsing — parsing an error page as JSON and swallowing the throw is what once made a throttled track look identical to one with no match, and let a sweep run through the whole library recording nothing. Hitting the limit now short-circuits every later call (an hour is far too long to sit in a retry loop) and the summary says when to resume; a fresh run clears the flag. Matching a search hit to a track lives in `genius/match.tsx`, **not** in `main.tsx`, and it is deliberately fuzzy: exact string equality was the limiting factor on the hit rate rather than Genius's catalogue. Probing 180 of the tracks the extension had failed to link found the right song as the *first* hit for nearly all of them, thrown away over a comma — "Paint It Black" vs "Paint It, Black", "3 A.M." vs "3 AM", "Gods Dice" vs "Gods' Dice", "Deja Vu" vs "Déjà Vu" — with only 5 returning no hits at all. Folding punctuation, accents and `&`, making a leading "the" optional, allowing a trailing bracketed qualifier on either side and allowing an explicit "and <backing band>" took that sample from 49% to 73%. Both a spaced and a separator-free key are compared because neither alone is enough: the spaced key fixes "Uncle Albert/Admiral Halsey", the tight one fixes "3 A.M." and "Boxcar Racer" vs "Box Car Racer". The artist rule accepts only an explicit "and" — a bare whole-word prefix linked "Pearl" to "Pearl Jam" until a test caught it, and `match.test.js` pins the refusals (covers, the Traducciones accounts, prefixed titles) as carefully as the matches, because a wrong link is worse than none. A miss now records `Track.genius.missedBy = MATCHER_VERSION` instead of storing nothing: a bare miss was indistinguishable from "the run never got this far", which is how roughly half of 3,351 unlinked tracks came to be ones that matched *exactly*. A settled miss is skipped on re-run, so a 21k sweep converges across passes instead of re-searching everything against the hourly quota — and bumping `MATCHER_VERSION` retries every old miss, which is the whole reason the version is recorded rather than a flag. A rate-limited track is deliberately **not** marked, since it has not been checked and marking it would bake the outage into the library. The MusicBrainz API client (`src/extensions/musicbrainz/api.tsx`) serializes requests ~1.1s apart to respect MB's 1 req/sec rate limit.

### DJ mode

`src/dj/` lets Claude pick what plays. Tools over the library/queue live in `src/dj/tools.tsx` and drive a `DJPlaylist` (`src/playlist/DJPlaylist.tsx`, a history + editable `upcoming` queue; `DJ_QUEUE_UPDATED` bumps `queueVersion` so queue views re-render despite in-place mutation). Two front ends share them: the in-app **DJ** page (the primary one now that an API key is configured) (`src/DJPage.tsx` + `src/dj/session.tsx`, calls the Messages API directly with `ANTHROPIC_API_KEY` from `.env.local`; the model is pinned as `DJ_MODEL` in `src/dj/model.tsx` and selectable from a dropdown in the DJ page header. The **default never moves on its own** — a new model changing behaviour and cost unasked is a surprise, not an upgrade — but the dropdown is filled from the **Models API** (`GET /v1/models`, cached in `DATA_DIR/dj-models.json`, refreshed at most daily), so a model released after this code was written appears by itself. Choosing one writes an override to the same file; clearing it returns to `DJ_MODEL`, and `selectedModel()` is what `createMessage` actually sends. `src/dj/model.tsx` (the constant and `modelLabel`) and `src/dj/apiAuth.tsx` (key and headers) are **leaf modules with no imports**, because `api.tsx` needs the chosen model and `models.tsx` needs to call the API — importing each other directly is the cycle `owner.tsx` already exists to avoid — hand-rolled client in `src/dj/api.tsx` because the SDK doesn't compile under TS 3.7/webpack 4; streamed SSE so replies type out and the busy line shows live reasoning, adaptive thinking with summarized display, server-side `web_search`, and a Verbose toggle that shows reasoning and every tool call). `readStream` assembles the same response shape a non-streamed call returns — including `tool_use` inputs from `input_json_delta` and thinking signatures, which must be replayed intact — so the tool loop is unaware of the transport. Streaming emits on every delta, so `App.tsx` coalesces the `dj-state` pushes to the phone., and the **MCP bridge** (`dj-mcp/server.js`, zero-dep stdio server registered in `.mcp.json`; proxies to `GET /dj/tools` / `POST /dj/tool` on the Express server → renderer IPC). With the app running, `/dj <mood>` in Claude Code uses the bridge and the user's Claude subscription instead of API credits. Both mobile clients show the queue (albums folded into one row via the snapshot's `group`/`groupName`) and can drop tracks or whole albums with a `dj-remove` action; every client routes removal through `session.removeFromQueue`, which reports a dropped album as one rejection rather than a wall of tracks. The app menu's **DJ → Copy link for phone** puts the right LAN URL on the clipboard (private ranges preferred, so a VPN interface can't hand out an unreachable address). Any phone can reach the DJ with no install: `GET /dj` serves a self-contained chat page (`public/dj-web/`) off the LAN, which speaks the same socket protocol and is Add-to-Home-Screen-able on iOS. The page is served `no-cache` and the server emits a `dj-build` id (the page's mtime) on every socket connect, so an open home-screen app reloads itself after a deploy — no re-adding the bookmark. Reach it by LAN IP; the `.local` name drifts (the host is already `MacBook-Pro-3`), so pin the Mac's IP with a DHCP reservation. Messages carry a speaker: the DJ page and the Android app are always `OWNER` (`src/dj/session.tsx`), while the web app asks for a name — taken from `?who=` in the URL first (a home-screen icon keeps the URL it was added with, so that survives storage clearing), then `localStorage`. `drain()` is the only caller of `runTurn`, so it **must** forward the queued `speaker` — it once did not, and because `runTurn`'s speaker parameter is optional there was no type error. Every message from every client arrived unattributed, the DJ never knew who it was answering, and no transcript label ever appeared; `src/dj/speaker.test.js` pins it. A name is shown whenever the speaker is **not** the owner, and the owner's own name appears only once someone else has spoken — so a solo session stays clean but a guest chatting alone is never anonymous. (The earlier rule hid names until two people had spoken, which made Chloe's messages look unattributed and is the bug this replaced.) The snapshot carries `owner` so every client can apply it; the rule is duplicated in `DJPage.tsx`, `public/dj-web/index.html` and `DJChatScreen.kt` — keep the three in step, as with the colour hash. Each speaker gets a stable colour hashed from their name (`src/dj/speakerColor.tsx`, duplicated verbatim in `public/dj-web/index.html` and `DJChatScreen.kt` — keep the three hashes in step so a person looks the same everywhere). Entries carry `at` (epoch ms, stamped in `addEntry` and passed through the snapshot) and each client renders it in the viewer's own locale, hour and minute only — `clockTime` in `src/utils.tsx`, duplicated in the web page and `DJChatScreen.kt`, the third thing those three must keep in step. An entry without `at` renders no time rather than the epoch. The Android app drives the same in-app session from its DJ screen (`MusicNative/.../DJChatScreen.kt` + `DJChatState.kt`) over socket.io: `dj-message`/`dj-sync`/`dj-new-session` actions in, `dj-state` transcript out. The MCP bridge prefers the packaged app (port 4443) over the dev app (4444) when both are running; pin one with `MYMUSIC_DJ_PORT=4444 claude`. Taking over the queue is non-destructive: `ensureDJPlaylist` adopts the playing track and inherits the previous playlist's `getUpcoming()` via `SWAP_PLAYLIST`, which deliberately leaves `currentlyPlayingId`/`isPlaying`/`time` alone. `end_session` is the exact mirror — `handBackToShuffle` swaps in a `RandomAlbumPlaylist` the same non-destructive way, so what is playing finishes and the shuffle picks up at the next track. (Hence the action's name: it runs in both directions, and `DJ_TAKE_OVER` would be a lie on the way out.) There is no "session ended" flag to disagree with reality — `isActive()` just asks whether the playlist is a `DJPlaylist`, so handing it back *is* ending the set and queueing anything later starts a new one. `runTurn` deliberately does **not** call `ensureDJPlaylist`: every tool that needs the queue creates it itself, so merely chatting no longer seizes playback — without that, "thanks, goodnight" after `end_session` would grab the queue straight back. The opening message of an in-app session carries the last few days of plays (`recentlyPlayedBrief`), so avoiding just-heard tracks doesn't depend on the DJ choosing to call `recent_plays` — which matters because sessions are often one turn. `src/dj/concertInfo.tsx` lets the DJ see upcoming shows, but only via the artist lookups (`get_artist`, `list_artists`), the views of what is already playing or queued (`now_playing`, `get_queue`), and an explicit `concerts` tool — deliberately **not** `search_library`/`sample_tracks`/`search_albums`, since a tour date sitting beside a candidate is how a set ends up chosen for who happens to be touring. The low-queue refill (`maybeRefill`) has twice been reported firing on a queue the DJ had just filled, and the cause is **not yet known** — the counting is right (album tracks go into the same list `getUpcoming` reads), no album in the library has dangling track ids, the refill reads the live store, and nothing in the path mutates the queue. `src/dj/refillLog.tsx` writes every warning to `DATA_DIR/dj-refill-log.json` with the queue's internal state and how long ago it was written, flagging `suspicious` for the reported shape; read that file when it recurs rather than guessing again. It is a diagnostic and comes out once the cause is found. `src/dj/activity.tsx` tracks idle/pause time and app uptime so the DJ can tell an empty room from a bad set; skips and removals are attributed to whoever caused them (`QueueTransition.actor`, defaulting to `OWNER` for the desktop and Android; the web app names the sender, and `DJ_ACTOR` marks the DJ's own `skip_current`); the session also reports likes, hand-pruned tracks, and whole-album skips (distinct from single-track skips, via `DJPlaylist`'s recorded transitions) as playback feedback. Long-term DJ memory is Anthropic's client-side memory tool (`memory_20250818`) backed by `src/dj/memory.tsx`: a sandboxed `/memories` tree stored in `DATA_DIR/dj-memories/`, exposed natively on the API path and as a plain `memory` tool over MCP, so both front ends share one set of notes (viewable on the DJ page).

### Cover art

`src/extensions/coverart/` upgrades album art from the **Cover Art Archive** — free, keyless,
and keyed by the MusicBrainz release-group id already stored for 2,008 of 2,176 albums. It is a
separate host from the MusicBrainz API, so the 1 req/sec rule does not apply; CAA publishes no
limit but documents a 503 for exceeding one, so the client paces at 150ms and backs off anyway.

This is an **upgrade pass, not a gap fill**. Three things have written art into `data/` — the
iTunes import, the Wikipedia infobox image, and the MusicBrainz extension asking CAA for
`front-500` — leaving 17% of 2,128 readable files under 250px, 79% at exactly 500, and only 7
above 600. Just 10 albums with an mbid have no art at all. Measured over 25 real release-groups:
`front-1200` is ~206KB each (~404MB for the library), the originals ~372KB and up to 2848px
(~1855MB) for detail nothing in the app can show, so 1200 is the target.

Sizes are judged on the **longer** side, because that is the dimension CAA scales:
`front-1200` on a 1400x1160 cover returns 1200x994, so judging by the shorter side calls art
already at the Archive's maximum "too small". `Album.coverArt = {maxPx, target}` records what
the Archive could supply so a second pass asks for nothing — without it ~1,004 albums whose
original upload is under 1200px would re-download on every run, forever. It stores the
*target* rather than a flag so raising `TARGET_PX` retries everything, the same reasoning as
`Track.genius.missedBy`. A 404 is deliberately **not** marked: only ~44 albums land there and
retrying one request each is cheaper than never noticing art the community adds later.

**`src/extensions/artFile.tsx` is the only thing in the app that writes art**, and it only
writes an image that is **larger** than what is already on disk. Four downloaders feed it — the
Wikipedia infobox image and the MusicBrainz cover art, for both albums and artists — and all
four used to write unconditionally, so the extensions silently fought each other: a MusicBrainz
run after this one replaced 1200px art with its own `front-500`, and a Wikipedia run replaced
either with whatever low-resolution fair-use thumbnail the infobox carried. Whichever extension
ran last decided the resolution. It also refuses to write anything that does not parse as an
image, and checks `res.ok` before reading a body — the old `downloadImage` did neither, which
is how one album's cover became a saved HTML error page. Art is written in place at the
existing path, because nothing ever deletes an art file and a fresh shortid each run would
orphan the old one.

The album page carries a **Cover art** row showing the current resolution with a Run button for
that album alone, and a **Run All Extensions** button whose order lives in
`src/extensions/runAll.tsx`: MusicBrainz, Wikipedia, Cover art, Genius, Lyrics. MusicBrainz
is **first because it fills `Album.mbid`**, which Cover art has nothing to ask the Archive
without — 163 albums here have no mbid, which is exactly the set someone presses the button on,
and the other order makes the cover-art step silently do nothing. Each step re-reads
`reduxStore.getState()` rather than closing over one snapshot, because the extensions read the
album out of a `RootState` and a snapshot taken before MusicBrainz ran still has no mbid
whatever it dispatched; that is why the sequence lives in a module and not in the component,
whose `this.props` is precisely such a snapshot. A failing step does not stop the rest — these
are five unrelated services and a Genius rate limit is no reason to skip lyrics — and the
failures are reported together. `runAll.test.js` pins the order.

The artist page has the same pair — a **Picture** row and a **Run All Extensions** that covers
the artist, their albums' cover art and all their tracks, which for the biggest artist here is
253 tracks. Both pickers carry a **Run extensions (N)** button that sweeps whatever the list is
currently showing, over the shown items rather than a selection because those pickers have
none; the search box beside it is how the list is narrowed. It asks before starting, since the
unfiltered list is the whole library and hours of rate-limited requests, captures the ids at
that moment so a changing list cannot redirect a running sweep, and can be stopped — between
items, not between steps, because abandoning mid-album would leave one with an mbid and no
cover art, which reads as a bug rather than a cancellation.

`src/extensions/imageSize.tsx` reads PNG/JPEG/GIF dimensions from the header, since the pass
has to size 2,176 files without decoding any of them on the thread playing audio. All three
formats really are in `data/` despite every file being written with a `.png` name. The JPEG
walk **seeks** rather than reading a fixed window: one cover here carries 17KB of EXIF and
109KB of ICC profile, putting the frame header at byte 131,378, which a 64KB window read as
"not an image". It is strict about segment boundaries rather than rescanning, because
rescanning can find a false frame inside EXIF data and "unreadable" is the safe answer —
callers refetch, and one album's art file in this library really is a saved HTML error page.

### Lyrics

`src/extensions/lyrics/` fills in lyrics from **LRCLIB** (`lrclib.net`, free, no API key), run
from the Extensions menu over the whole library or from the track list's right-click menu over
a selection — the same two entry points as Genius. Genius itself can never supply the words:
it licenses from publishers and its API returns metadata and a page url only, which is why the
`G` link is all that extension can offer.

Lyrics are stored **one file per track** in `DATA_DIR/lyrics/<trackId>.lrc`, with only a small
marker (`Track.lyrics = {synced, fetchedAt, instrumental, errors}`) in `library.json`. At a few
KB each the text would add 40–80MB to a file that is parsed at launch, rewritten on every
library update and uploaded daily; album art is kept out for the same reason, and like art
these are re-fetchable so they are deliberately not in the offsite backup. The **synced LRC is
stored even though nothing highlights it yet**, so adding a follow-along later needs no second
pass over the API.

Markers are committed to the library **every 100 results**, not only when the pool finishes: a
nine-hour sweep that only commits at the end shows no `L` all night, and closing the app first
discards every marker while leaving the files on disk. A file with no marker is recovered by
`markerFromStoredFile` rather than re-fetched, so an interrupted run costs nothing. The batch
exists because the library reducer rewrites the whole 12MB file on every update. Pacing lives in
`api.tsx`, not the caller: `getPool` runs seven items at once, so the client
serialises every request through one promise chain at 800ms (~75/min, under the ~90 the docs
allow an identified client) — the same shape as the MusicBrainz client. **~40% of LRCLIB
requests return 503**, which is normal rather than exceptional, so retries are built in and
re-running the extension is the intended way to fill gaps; anything already stored is skipped.
Measured before building: among clean responses ~92% of a library-wide sample matched (~76% with
timestamps), and 100% of most-played tracks (91% synced). A full sweep is ~2 requests/track at
~75/min — roughly nine hours, an overnight job.

The `L` beside the Genius `G` in the track list opens `LyricsOverlay.tsx`, which reads the file
on demand; it is dimmed when the stored lyrics have no timestamps. The Stats page shows
per-extension coverage, with different denominators per row on purpose (Genius and Lyrics are
per-track, Wikipedia and MusicBrainz per album+artist).

### Games

Standalone `BrowserWindow`s off the **Games** menu, each one page in `public/` with
`nodeIntegration` on, loaded over `file://` with no build step. They are not part of the React
app and share nothing with it but the library.

`public/electron.js` holds a **`GAMES` registry**: the id names the html file, the saved-scores
file and the menu entry, so adding a game is one entry there plus one page. Only ids in that map
are ever accepted from a game window — that is what keeps a crafted id out of the scores and
lyrics file paths. Name That Tune's scores stay in `tune_scores.json` because it shipped before
games had ids; everything else is `scores_<id>.json`.

The chrome is shared, not copied. `public/game-common.css` is the theme and the card / button /
round-header / end-screen styling; `public/game-common.js` is the behaviour behind a `Game`
global — fuzzy answer matching (`normalize` folds case, punctuation and **accents**, and treats
"the" as optional; `artistMatches` accepts any one artist of a `", "` credit), the setup-screen
`Filters` and difficulty slicing, the countdown
`Timer`, the shared speed/streak `bonuses`, multiple-choice building, per-game `Scores` with the
history line and the all-time insights fold, and `parseLrc`. A game's own `<style>` holds only
what is specific to it. Name That Tune went from 1,059 self-contained lines to 511 by consuming
both; the point is that a fourth game does not mean a fourth copy of the theme, which is the
shape of problem the speaker-colour hash and the concert date filter both became.

The accent fold is not cosmetic: the key strips every non-ASCII letter, so without folding first
"Björk" keys as `bjrk` and a correctly typed "Bjork" is marked wrong. 14 artists and 15 albums in
this library were unguessable that way. Anything matching **single words** needs its own key
rather than `normalize`, because the "the" rule turns "there" into "re" and makes "the" itself
unmatchable — both lyric games say so in place.

All-time insight accuracy is `base / (rounds * maxPoints)`, computed at render rather than
stored. An earlier version kept a running `max`, but accumulated it only for the rounds of the
game being folded while `base` already carried the whole history — Name That Tune's saved
insights then reported accuracies of 633%, 817% and 1283%. Every game passes a constant for
`maxPoints`, so the stored total was redundant as well as wrong; a stale `max` is now deleted
on the next fold and ignored on render, which repairs the file in place.

`src/gameCommon.test.js` pins the `Game` surface, because the export list is hand-written and an
omission is invisible: the function is defined, the file parses, every page loads, and the call
throws only when a game actually runs. `loadTracks` was once left out exactly that way and broke
the library fetch on all six pages at once while `node --check`, tsc, lint and the tests all
passed.

`parseLrc` is a **port** of `parseLyrics` in `src/extensions/lyrics/store.tsx` — the TS copy
pulls in Electron and cannot be required from a `file://` page. Keep the two in step.

Games get the library through the renderer, which owns it: `game-get-tracks` →
`extEvt.reply("get-game-tracks")` → `App.tsx` → `game-tracks`, the same proxy shape as the mobile
API. Requests **queue by sender**, because the renderer answers on one channel and a second
window asking while a request is in flight would otherwise wait for a reply that never comes. The
payload carries `album`, `artFile`, `artist`, `duration`, `filePath`, `genres`, `hasLyrics`, `id`,
`name`, `playCount`, `syncedLyrics` and `year` — the lyrics **markers**, not the words, so a game
filters 21,000 tracks and then reads only the few files it needs. `game-get-lyrics` reads a stored
`.lrc` straight off disk in the main process (`path.basename` on the id is what stops a walk out
of the directory); `game-dj-clue` goes to the renderer instead, because the API key is there.

`src/dj/clue.tsx` asks the DJ to describe a track without naming it. It **redacts** the artist,
title and album out of the reply rather than re-requesting: a leaked answer costs the round, and a
second call costs as much as the first. One Messages API call per round, which is why the clue game
has few rounds, says so in its rules, and pre-fetches the next clue while the player works.

### Event log

`src/eventLog.tsx` appends one line per event to `DATA_DIR/plays.jsonl`. `Track.playCount` and
`Track.playDate` record how many times a song has been played and when it was played **last**,
which makes the listening history one date per song — "what did I listen to in March", "what
have I rediscovered", and any view of listening over time are all unanswerable from it. This is
the missing half, and the Stats page's last-28-days and by-hour charts are the first thing to
read it.

Deliberately **not** in `library.json`: that file is 13MB, parsed at launch, rewritten on every
library update and uploaded daily, and a log that grows forever has no business in it. JSONL so
an append is a single write with nothing to re-serialise, and so a line torn by a crash costs
that line rather than the file — `parseEntry` skips unparseable lines. Appends are
**synchronous**: tens of bytes every few minutes costs nothing and sidesteps the interleaving
that corrupted `library.json` rather than guarding against it. Losing an entry is silent on
purpose; a play log must never interrupt playback.

Phone plays carry **their own** timestamp, taken on the phone where it is known.
`PlayTracker.kt` used to keep a bare count per track, so a day of listening arrived as "three
plays" with no idea when; it now stores `{i, t}` records and `/start-sync` sends
`{v: 2, plays: [...], counts: {...}}`. `src/syncedPlays.tsx` reads **both** shapes, because an
older phone against a newer desktop must keep syncing; `v` is the discriminator, not the
presence of `plays` — keying off `plays` read an empty `{v: 2}` payload as a play of a track
called "v", and an empty sync is the common case. `counts` carries whatever a pre-timestamp
build was still holding: those have no time to give, so they are stamped with the sync moment
and marked `est`, which keeps them out of the by-hour chart (they would pile a day onto the
hour the phone came home) while still counting toward days and totals. A sync only ever moves
`playDate` forward, so a late sync cannot rewind it. `PlayTracker` also now clears **exactly
what it sent** rather than the whole preferences file, so a play recorded while a sync is in
flight is no longer thrown away.

Plays were the first event and for a while the only one, which is why the file is still
`plays.jsonl` and why **a line with no `type` is a play** — renaming would orphan the history
already in it. Skips, favourites and reactions had the same problem plays did: `Track.skipCount`
is a total, `Track.favorites` is a list of *years*, and un-favouriting removes the year and
leaves no trace at all. `EventType` is `play | skip | favorite | unfavorite | react`, with
`subject` (track or album) and, for a reaction, `who` and `value`. Everything is omitted at its
default, so a play is the same short line it always was. `onlyPlays` is what the listening
charts use — a skip is not listening and would inflate every bar.

**`Track.skipCount` had been frozen since the iTunes import**: `library/itunes.tsx` reads
"Skip Count" from the XML and nothing in the app ever incremented it, so all 17,140 skips across
5,658 tracks are history from another program and the Stats "Most Skipped" list has shown the
same answer for years. `src/skips.tsx` now records them. A skip is advancing away from a track
that has not finished — the `ended` handler is the only natural finish, so every other way
forward counts — and it ignores the first two seconds, which is a mis-click rather than a
verdict. Going *back* is not a skip: abandoning a song to replay the previous one says nothing
about the song. `recordSkip` returns the delta instead of dispatching, so both callers (the
transport button and the remote handlers) apply it identically.

Phone skips come over the same protocol: `PlayTracker` keeps a second list, `/start-sync` sends
`{v: 3, plays, skips, counts}`, and `syncedPlays.tsx` reads any numeric `v` as the structured
shape and takes each field if present — so adding `skips` needed nothing of an older desktop
beyond ignoring it. The phone applies the same two-second floor, so a phone skip and a desktop
skip mean the same thing.

Deliberately **not** logged: pausing, seeking and volume are moment-to-moment controls rather
than opinions about music, and would bury the events that mean something; the DJ's queue churn
is already tracked by `src/dj/activity.tsx` for the session it belongs to.

The Stats page reads the log for by-period and by-hour plays, plays by weekday, most skipped
and most played in the window, and **first heard** — tracks whose earliest logged play falls
inside it, which `playCount` cannot answer at all. The window is chosen with chips — 7, 28, 90
days, a year, or everything the log covers, worked out from the earliest entry — and **every
section follows it**, including the hour and weekday breakdowns, since a visible range selector
that some charts ignored would be worse than none. Column charts **re-bucket** as the range
grows: a day per column past about a month is a grey smear, so 36-180 days groups by week
(Monday) and longer by month, which keeps every range between 7 and 34 columns with 7-10 ticks.
Empty buckets are kept because a gap is information. The recent skip list uses the log's own ratio
rather than `skipCount`/`playCount`, whose totals are dominated by what iTunes imported years
ago.

The DJ's **`recent_plays`** is log-backed rather than reading `Track.playDate`, which holds one
date per track and so cannot tell a song played once from one played four times — the difference
that decides whether queueing it again is a repeat. It also now reports **skips** in the window,
which is the only durable negative signal there is: in-session skips reach `activity.tsx` but
are forgotten when the session ends. No new tool was added; the existing one gives better
answers. It falls back to `playDate` when the log does not reach back far enough, which it will
not for a while. `readPlaysCached` keys on mtime *and* size, since two appends in the same
millisecond would otherwise look like no change.

### Concert tracker

`src/concerts/` tracks upcoming shows near the listener by artists in the library. Data comes from the **JamBase Data API** (`api.data.jambase.com/v3`, `Authorization: Bearer` with `JAMBASE_API_KEY` from the usual env files) — Songkick is partner-only now and Bandsintown's keys are scoped to a single artist, so neither can serve a whole library. The design is one cheap **location sweep** (`/events?geoLatitude&geoLongitude&geoRadiusAmount&geoRadiusUnits&eventDateFrom&eventDateTo&perPage=100&expandExternalIdentifiers=true`) rather than a lookup per artist: `expandExternalIdentifiers` puts a MusicBrainz id on every performer, which matches **exactly** against the ~90% of library artists that have an `mbid`, so two bands sharing a name can't be confused. The free Developer tier allows **1000 calls/month**, so `store.tsx` tracks usage, refuses to sweep when spent, and only refreshes when the cache is older than **24h** — a dense metro is ~24 pages a sweep, so twice-daily would cost ~1500/month. Radius barely affects cost (15mi is 23 pages, 40mi is 26), so prefer a generous radius over a tight one. **Use my location** tries the OS first and falls back to IP. `navigator.geolocation` in Electron on macOS does reach CoreLocation (an unprivileged attempt fails with *"User has not allowed access to system location"*, which is macOS talking, not Chromium) — but only from a secure origin and only once the bundle declares `NSLocationWhenInUseUsageDescription` (set via electron-builder `mac.extendInfo`) **and** Location Services has been granted to MyMusic in System Settings. `session.setPermissionRequestHandler` must also allow it, or Electron denies the request before macOS sees it. The IP fallback uses `ipapi.co` (JamBase's own `geoIp` reports its servers, not the caller) and is ISP-accurate to a few miles, hence the "(approx.)" label. Results live in `DATA_DIR/concerts.json` — deliberately *not* in `library.json`, which is large, backed up daily, and must not churn with volatile data. A 🎟️ appears beside the now-playing artist whenever they have a show coming up — in `InfoPanel.tsx`, which both the full header and the mini player render, so one badge covers both; it reads the cache via `concertsForArtists` (a memoised artist→shows index dropped inside `saveCache`, the only writer) and never fetches, so it costs no API calls. `ConcertsPage.tsx` is the tab — a date-ordered list (sortable by play count) or a month calendar whose dots are sized by plays and coloured for favourites, filterable, with a city picker backed by `/geographies/cities?geoCityName=`. **`isUpcoming` in `concerts/store.tsx` is the only definition of "not in the past" — every view must go through it** (the tab, `ArtistConcerts`, the badge, and the DJ's `concertInfo`). The cache keeps a show until the next sweep and sweeps are daily at best, so anything filtering the raw cache will eventually present a finished gig as upcoming; three separate copies of the logic existed and only one checked the date. Parse show dates with `localDate` from `src/utils.tsx`, never `new Date(iso)`: a date-only value like `2027-01-14` is read as UTC midnight and renders as the 13th anywhere west of Greenwich; `ArtistConcerts.tsx` shows the same cached data on an artist page and renders nothing when there's nothing. Newly announced shows are diffed on each refresh (`findUnseen`) and carried forward across refreshes until the tab is opened, so nothing is lost between visits; the "N newly announced" badge is a **toggle** that filters the list and calendar to just those, and keeps working after the sidebar badge clears because `highlighted` outlives `markSeen`. `matchesFilter` lives in `concerts/store.tsx` beside `isUpcoming` so the list and calendar cannot disagree about what is shown; the count reaches the sidebar through `concerts/alerts.tsx`, a tiny subscribable store rather than Redux, since it derives from a file on disk and only two components care. JamBase requires visible attribution, which is in the tab footer.

### Offsite backup

`src/backup/` copies the irreplaceable files to Google Cloud Storage once a day (and once at launch): `library.json` and the DJ memory notes. Art and thumbnails are deliberately excluded — the extensions refetch those and they are ~200x the bytes — and music is not handled here at all. `gcs.tsx` is a hand-rolled uploader (service-account JWT → OAuth token → `POST /upload/storage/v1/b/<bucket>/o`) rather than `@google-cloud/storage`, which is large and assumes a Node server.

The service account is **objectCreator only**, so it can create but not read, replace or delete — verified: overwrite, delete and read all return 403. Combined with timestamped object names the backup set is append-only, and neither a bug here nor ransomware on the laptop can destroy it. Restore is therefore a deliberate human act via the console, not something the app can do, and the steps are written down in `RESTORE.md` — **rehearsed 2026-11-05**: a real 13MB snapshot was downloaded-equivalent, placed in a scratch `DATA_DIR` and loaded by `loadLibrary` with every count matching. The half that cannot be rehearsed from this machine is getting the object at all; that was re-verified too, with `GET`, metadata and `LIST` all returning 403 under the backup key. Restoring loses the enrichment added since the snapshot — the 14-hour-old one used was already short ~1,450 lyrics markers and every cover-art marker — but none of it is lost work, since the files are on disk and the extensions are marker-driven. Music and DJ memories are **still unrehearsed**.

`readLibraryForBackup` refuses to upload an empty, corrupt or missing library. That guard exists because this app once wrote an 80-byte empty `library.json` over a good one after a failed read; faithfully copying that offsite would turn a recoverable glitch into a destroyed backup set.

`scripts/backup-music.js` pushes the ~163GB music library to the same bucket as `music/<path relative to home>`, mirroring the filesystem so it can be restored by hand without this app or `library.json`. It lives outside the app on purpose — roughly a day of wall-clock at ~18Mbps — and is restartable via a manifest in `DATA_DIR`; a 403 means the object is already there (the key cannot replace), so it records it and moves on. Run it with `--limit`/`--concurrency`/`--dry-run`. `src/backup/musicBackup.tsx` then keeps it current from inside the app on a 14-day cadence, hanging off the same daily `BACKUP_TIME` timer as the library backup: it shares the script's manifest and object naming (a test pins that contract, and it was checked against the live manifest), so the two are interchangeable. Runs are bounded (`MAX_FILES_PER_RUN`/`MAX_BYTES_PER_RUN`) and a run that hits a ceiling deliberately does *not* advance `lastSuccessAt`, so the daily timer keeps chipping away until the backlog clears and only then drops back to fortnightly. Its fs calls are async on purpose — the renderer is the thread playing audio, and 21k synchronous `stat`s froze it. Bookkeeping lives in `DATA_DIR`: `cloud-backup.json` (library/memories), `music-backup-manifest.json` (what is in the bucket, shared with the script) and `music-backup-state.json` (the fortnightly clock). None of it is precious — losing the manifest costs re-POSTing files to collect 403s, not data. Bucket settings, the service account and the lifecycle rules are in **Cloud infrastructure** below.

### Cloud infrastructure (GCP)

Created by hand in the console. **This repo is public, so no identifiers live here**: the
project id, billing account, bucket name and service-account email are in
`infrastructure.local.md` at the repo root, which is gitignored. Keep it that way — what follows
is the reasoning, which is the part worth version-controlling.

- **The bucket** is `us-central1`, **Standard**, regional, not public, with Soft Delete and
  Object versioning on. Regional/Standard is not incidental: the multi-region default is pricier
  *and* free-tier ineligible, and Standard means a future streaming reader pays no retrieval fee.
  It holds `library/`, `dj-memories/` and `music/`.
- **The service account** has **`roles/storage.objectCreator` only**, verified empirically:
  upload 200, overwrite 403, delete 403, read 403. That is the whole safety model, so do not
  widen it. Streaming will need a *separate* reader identity rather than read added here.
- **Three lifecycle rules.** Two are stock versioning cleanup (delete noncurrent with 2+ newer
  versions; delete 7+ days after becoming noncurrent). The third deletes objects 180+ days after
  creation, **scoped to prefixes `library/` and `dj-memories/`**. `music/` is deliberately
  matched by nothing — those are not snapshots, they are the only copy. Any rule added later
  must be prefix-scoped for the same reason.
- **Config** is `GCS_BACKUP_BUCKET` in the usual env files, plus a key at
  `DATA_DIR/gcs-backup-key.json` (gitignored twice over). The script reads the same key.

`gcloud` is **not installed** on this machine, so verify bucket state through the console
(Bucket details → Lifecycle / Permissions) rather than reaching for `gsutil`.

**IaC policy:** Terraform is for resources that are cheap to recreate. `terraform/` manages the
streaming stack (Cloud Run, its service account, IAM, Artifact Registry) with state in its own
bucket, so nothing new is ever click-ops. The music bucket stays out: importing existing
resources is the error-prone part, an `apply` on a botched import can propose *replacing* a
bucket, and this one holds the only offsite copy of 163GB. It is referenced as a `data` source
instead, so the config itself denies Terraform the power to touch it. The single grant it does
make on the bucket uses `google_storage_bucket_iam_member` — the **additive** form; `_binding`
and `_policy` are authoritative and would strip the backup writer's `objectCreator` grant.
Neither `terraform` nor `gcloud` is installed on this machine (Homebrew here is an Intel prefix
on Apple Silicon and has no `terraform` formula) — see `terraform/README.md`.

### Streaming

Lets the phone play tracks it has not synced. **Live since 2026-10-24** — deployed on Cloud Run
and verified end to end (real audio fetched through a minted signed URL, `206` on a Range
request). The laptop is **not** in the playback path — it is a publisher only, and everything
works with it asleep.

Laptop uploads `music/` plus a slim `catalog/latest.json` (id, title, artist, album, duration,
object name) built from `library.json` intersected with the **music backup manifest**, so a
track only appears as streamable once its bytes are confirmed uploaded. A small always-on
**Cloud Run** service authenticates the phone, serves that catalog, and mints a **~1h V4 signed
URL** per track; the phone then streams **directly from GCS**, which keeps Cloud Run free (it
never touches audio bytes) and gives HTTP Range seeking for free in Media3/ExoPlayer.

Minting on demand is the point: an earlier design pre-minted URLs during LAN sync, which capped
validity at the 7-day signed-URL maximum and put the laptop back in the loop. Cloud Run should
sign via IAM `signBlob` using its own attached service account, so **no key material exists**
anywhere — no reader key on the laptop, no secret in the APK.

`streaming/` is the service (zero-dep Node, deployed from `streaming/Dockerfile`); `terraform/`
manages its infrastructure. `src/backup/catalog.tsx` publishes the catalog on the app's daily
timer — it runs even when the music backup itself is skipped, so the index stays fresh — and
`scripts/publish-catalog.js` does it immediately, which matters while the bulk upload is still
adding thousands of tracks a day. That script **duplicates** `buildCatalog()` because the TS
module pulls in Electron and cannot be required from plain node; keep the two in step.

Cloud tracks are **inline, not a separate screen**: the catalog carries the desktop's own
album/artist ids plus slim `albums`/`artists` sections, so `MergedLibrary.kt` folds them into the
synced library by id — a part-synced album is one album in running order, not two. Album
`trackIds` ship in full running order including unuploaded tracks, which is the only way to order
a mixed album correctly; unplayable entries are then dropped rather than shown as dead rows.
Offline the merge collapses to exactly the synced library. `MergedLibrary` lists the tracks
directory **once** rather than stat-ing per track — All Tracks asks about every id, and 21k stats
during composition stalls the UI. Build it with `rememberMergedLibrary` **inside each screen**,
never hoisted and passed down: a NavHost graph comes from a plain non-composable builder lambda
whose destinations are remembered, so a captured value is frozen at the composition that built
the graph. Hoisting it meant every screen kept the launch-time copy — made before any catalog
had been fetched — and the cloud half never appeared no matter how often the catalog refreshed.

On the phone (`MusicNative/`), `Connectivity.kt` tracks real internet — `NET_CAPABILITY_VALIDATED`,
not merely "a network is attached", so a captive portal reads as offline rather than hanging every
request — and `StreamingClient.kt` talks to the service. **Everything streaming-related is gated on
it**: the Streaming browse screen only appears while online, and offline the app behaves exactly as
before. `MediaPlaybackService.setTrack` is local-first and falls back to a signed URL, which also
means a synced track whose file went missing now recovers instead of failing silently. Note the
player is `android.media.MediaPlayer`, **not** ExoPlayer/Media3 — it handles HTTP range and seeking
for streamed URLs itself. Catalog entries become `TrackData` via `streamTrackToData`, synthesising
`stream-artist:`/`stream-album:` ids that are never written to the library, so they cannot collide
with synced entities.

The phone's service URL and token are baked in at build time from `streaming.url` /
`streaming.token` in `MusicNative/local.properties` (gitignored; `local.properties.example`
documents it), or same-named env vars for a one-off build — so a fresh install needs no typing.
The in-app settings screen is an **override**: clearing a field removes it and falls back to the
built-in values rather than persisting an empty string, which would otherwise break streaming
with no way back short of reinstalling.

Auth is a long random **per-device token** held in app prefs, with the service keeping token
hashes; revocable per device, no OAuth plumbing, and enrollment needs no laptop. Google Sign-In
with a two-account allowlist is the upgrade if that chafes. Play counts need **no new protocol**:
`PlayTracker` keys by track id and never asks whether the file was local, so a streamed play
syncs on the next LAN `/start-sync` like any other — just lagged until the phone is next home.
Do not transcode; originals are ~8MB and 2h/day of listening is ~$1/month of egress.


### System volume from the phone

`public/systemVolume.js` lets the Remote screen turn the **laptop** up and down, not just the
app. `osascript` rather than a native module: no dependency, and no permission prompt (`set
volume` runs inside osascript rather than scripting another app, so it is untouched by the TCC
rules that govern automation). The cost is **~150ms per call**, so a slider drag is coalesced —
only the latest level is applied, at most every 200ms.

The level arrives from an **unauthenticated LAN socket**, so `clampVolume` is a security
boundary, not input tidying: it type-checks *before* coercing (`Number(null)`, `Number("")`,
`Number([])` and `Number(true)` are all numbers, so `null` would otherwise mute the laptop) and
the result goes to `execFile` as an argument, never interpolated into a shell string.
`src/systemVolume.test.js` covers both.

The cached level is merged into the `state` broadcast by the main process rather than read per
update — `controller-state` fires on every `timeupdate`, and a 150ms call on each would be
absurd — and refreshed every 5s only while a client is connected, so an unattended app spawns
nothing. The phone hides the control entirely when the desktop reports no `systemVolume`, so an
older build shows no dead slider.

Note this is **system-wide**: it moves notifications and every other app too. Whether it reaches
an AirPlay receiver is **unverified** — some configurations keep the receiver's volume separate,
in which case `set volume` succeeds and changes nothing audible.

## Gotchas

- The toolchain is old: React 16, TypeScript 3.7, Electron 13, react-scripts 2 patched through `@rescripts`. Don't modernize syntax or bump deps incidentally. The `start`/`build` scripts need `NODE_OPTIONS=--openssl-legacy-provider` (webpack 4's md4 hash vs Node 17+), and the BrowserWindows need `contextIsolation: false` + `enableRemoteModule: true` (Electron 12+ changed both defaults; the renderer uses `require` and `electron.remote` freely).
- All TypeScript files use the `.tsx` extension, including non-component modules (redux, library, extensions).
- **`loadLibrary` in `src/library/main.tsx` rebuilds every entity field by field**, so a field added to `Track`/`Album`/`Artist` and not added there is silently discarded — the entity loads, the app runs, and the next save writes the library back without it. `lyrics` was missing, so every restart erased the lyrics markers for the whole library (18,949 of them) while leaving the `.lrc` files on disk; the only symptom was the `L` quietly vanishing. `src/library/libraryRoundTrip.test.js` fails if any field is dropped again, using fully-populated fixtures so an omission cannot pass because the test data never set that field. Recovery needed no API calls — `markerFromStoredFile` rebuilds a marker from the stored file — which is the whole reason that function exists.
- `src/mediaSession.tsx` feeds the OS **Now Playing** card (menu bar, media keys, and what an AirPlay receiver shows on a TV). Without it the card falls back to the page title and blank art — which is how a TV ended up displaying "React App". Artwork must be a **data URL**, not `file://`: in dev the page is served from localhost and Chromium will not load a `file://` image into it. The MediaSession API postdates TS 3.7's DOM lib, so its types are declared locally; Chromium 91 implements it fine at runtime.
- `App.tsx` tracks `loadedPath` (the file in the audio element) instead of comparing the current track's path against the previous render's. When the same file plays twice in a row the path does not change, so a path comparison never reloads it — and `ended` has already blanked `src`, so playback stops dead with nothing left to restart it. That, plus `DJPlaylist.setEntries` dropping a **leading** duplicate of the playing track (the DJ reads the queue, thinks, and the song ends before its write lands, so its list leads with a track that is now playing), is the "queued twice and stuck" bug; `src/playlist/djQueueRace.test.js` covers the queue half.
- `new Date(someString)` reads a date-only value (`2027-01-14`) as UTC midnight, so it lands on the previous day in any negative-offset timezone. Use `localDate`/`dayKey` from `src/utils.tsx` for dates that are already local to whatever they describe. Full timestamps rehydrated from the library JSON are unaffected.
- **`mapStateToProps` must not build fresh closures or arrays**, or `connect` can never bail out and every connected component re-renders on every action — `timeupdate` dispatches about four times a second throughout playback. Measured on this library the selector work alone was ~2.9ms per action (the 21,078-track genre filter 2.47ms of it, the 2,176-album one 0.34ms), so ~11ms per second of playback before counting the React reconciliation it forced. `src/redux/memo.tsx` fixes it: `boundTo(slice, store, fn)` reuses one wrapper while the slice is unchanged, and `memoize` caches a derived array on argument identity. After it, a playback second costs 0.01ms and `connect` skips the re-render on 100% of those actions. **`boundTo` is only valid for a selector that reads nothing but the slice it is keyed on** — the wrapper closes over the store it was built with, so a selector touching another slice would answer from a stale one; every selector used this way reads only `store.library`, which was checked rather than assumed, while `getTime` and `getCurrentTrackId` read `currentlyPlaying` and are passed as values.
- `readEnvValue` (`src/envFile.tsx`) caches a **miss** for the lifetime of the process, so adding a key to an env file always needs an app restart — with no hint that that is why it is still "not found". This has already cost one round of confusion with `JAMBASE_API_KEY`.
- `postinstall` runs `rn-nodeify` and `electron-builder install-app-deps`; `fs` is aliased to `react-native-level-fs` in the `browser`/`react-native` fields of package.json.
