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

- **Main process — `public/electron.js`** (plain JS, not compiled from `src/`). Creates the frameless main window, app menu (Library → "Reset from itunes", Extensions → Wikipedia/Genius), and global shortcuts (Cmd+8/9/0 = prev/play/next). Also runs an Express + socket.io server (port 4444 dev, 4443 prod) published over bonjour as "MyMusic" — this is the mobile-app API (`/get-track/:id`, `/get-album-art/:id`, `/start-sync`, socket "state"/"action" events). The main process holds almost no state; every HTTP request is proxied to the renderer over IPC (`extEvt.reply(...)` → renderer answers with `ipcMain.once(...)`).
- **Renderer — `src/`**. `nodeIntegration` is enabled and webpack targets `electron-renderer` (via `@rescripts`, see `.rescriptsrc.js` → `.webpack.config.js`), so renderer code freely imports `fs`, `path`, and `electron`. `App.tsx` is the connected root: it owns the `<audio>` element, registers all IPC listeners (minimize/maximize, run-extension, reset-library, mobile sync/data requests), and schedules daily library backups. Two UI modes: `MaxWindow` (full library browser) and `MiniWindow` (240×120 mini-player), toggled by resizing the window via IPC.

### State & persistence

- Separately from the owner's `favorites`, `Track.reactions` keys per-person likes/dislikes by year (`src/reactions.tsx`); the web app's ♥/👎 write them via a `dj-react` action, they show on DJ track lines as `♥name`/`✗name`, and `getAutoPlaylists` derives a "<name>'s Likes/Dislikes of <year>" playlist for each.
- All Redux action types **and** domain interfaces (`Track`, `Album`, `Artist`, `Genre`, `Playlist`, `LibraryState`) live in `src/redux/actionTypes.tsx`. Each entity has a partial `*Info` twin (`AlbumInfo`, etc.) used for updates; `LibraryInfo` deltas are merged into state by `UPDATE_LIBRARY`.
- Reducers: `library`, `currentlyPlaying` (playlist, time, volume), `settings` (genre filter). Entities reference each other by id string (`trackIds`, `albumIds`, `artistIds`, `genreIds`).
- `save()` in `src/redux/reducers/library.tsx` refuses to overwrite a non-trivial `library.json` with an empty library (`wouldDestroyLibrary`), and `App.tsx` only auto-imports a fresh library when the file is genuinely missing (`ENOENT`) — any other read error alerts and changes nothing. Both exist because a single failed load used to silently replace the whole library with an empty one.
- The library persists as a JSON file in `DATA_DIR` (`./data` in dev, `userData/data` packaged — see `src/constants.tsx`). `src/library/main.tsx` loads/saves it (load re-hydrates `Date` fields manually); `src/library/itunes.tsx` does the initial import from an iTunes XML export. `data/` also holds downloaded album/artist art (shortid-named files).
- Playback queues are class-based: `src/playlist/EmptyPlaylist.tsx` is the base, with `RandomAlbumPlaylist` / `RandomTrackPlaylist` implementations stored directly in Redux state.

### Extensions

`src/extensions/wiki`, `src/extensions/musicbrainz`, and `src/extensions/genius` batch-fetch metadata for the whole library using `es6-promise-pool`. They're triggered from the app menu (main process → `run-extension` IPC → `App.tsx`), report per-item progress via `extension-update` IPC to a dedicated `ExtensionMonitor` window (`public/extension_monitor.html`), and resolve to a `LibraryInfo` delta dispatched through `updateLibrary`. Failures are recorded on the entity's `errors` array rather than thrown, using the shared `ExtensionError` enum in `src/extensions/errors.tsx` — an error means *no* extension could fill that data, so any extension that succeeds clears it, and `NO_MATCH` is only set when an entity has neither a `wikiPage` nor an `mbid`. Wiki parsing tests use saved HTML fixtures in `src/extensions/wiki/test_pages/`. The MusicBrainz API client (`src/extensions/musicbrainz/api.tsx`) serializes requests ~1.1s apart to respect MB's 1 req/sec rate limit.

### DJ mode

`src/dj/` lets Claude pick what plays. Tools over the library/queue live in `src/dj/tools.tsx` and drive a `DJPlaylist` (`src/playlist/DJPlaylist.tsx`, a history + editable `upcoming` queue; `DJ_QUEUE_UPDATED` bumps `queueVersion` so queue views re-render despite in-place mutation). Two front ends share them: the in-app **DJ** page (the primary one now that an API key is configured) (`src/DJPage.tsx` + `src/dj/session.tsx`, calls the Messages API directly with `ANTHROPIC_API_KEY` from `.env.local`; the model is **hard-coded** as `DJ_MODEL` in `src/dj/api.tsx` and shown in the DJ page header via `modelLabel()`, which derives the display name from the id so changing one cannot leave the UI naming the other — hand-rolled client in `src/dj/api.tsx` because the SDK doesn't compile under TS 3.7/webpack 4; streamed SSE so replies type out and the busy line shows live reasoning, adaptive thinking with summarized display, server-side `web_search`, and a Verbose toggle that shows reasoning and every tool call). `readStream` assembles the same response shape a non-streamed call returns — including `tool_use` inputs from `input_json_delta` and thinking signatures, which must be replayed intact — so the tool loop is unaware of the transport. Streaming emits on every delta, so `App.tsx` coalesces the `dj-state` pushes to the phone., and the **MCP bridge** (`dj-mcp/server.js`, zero-dep stdio server registered in `.mcp.json`; proxies to `GET /dj/tools` / `POST /dj/tool` on the Express server → renderer IPC). With the app running, `/dj <mood>` in Claude Code uses the bridge and the user's Claude subscription instead of API credits. Both mobile clients show the queue (albums folded into one row via the snapshot's `group`/`groupName`) and can drop tracks or whole albums with a `dj-remove` action; every client routes removal through `session.removeFromQueue`, which reports a dropped album as one rejection rather than a wall of tracks. The app menu's **DJ → Copy link for phone** puts the right LAN URL on the clipboard (private ranges preferred, so a VPN interface can't hand out an unreachable address). Any phone can reach the DJ with no install: `GET /dj` serves a self-contained chat page (`public/dj-web/`) off the LAN, which speaks the same socket protocol and is Add-to-Home-Screen-able on iOS. The page is served `no-cache` and the server emits a `dj-build` id (the page's mtime) on every socket connect, so an open home-screen app reloads itself after a deploy — no re-adding the bookmark. Reach it by LAN IP; the `.local` name drifts (the host is already `MacBook-Pro-3`), so pin the Mac's IP with a DHCP reservation. Messages carry a speaker: the DJ page and the Android app are always `OWNER` (`src/dj/session.tsx`), while the web app asks for a name — taken from `?who=` in the URL first (a home-screen icon keeps the URL it was added with, so that survives storage clearing), then `localStorage`. `drain()` is the only caller of `runTurn`, so it **must** forward the queued `speaker` — it once did not, and because `runTurn`'s speaker parameter is optional there was no type error. Every message from every client arrived unattributed, the DJ never knew who it was answering, and no transcript label ever appeared; `src/dj/speaker.test.js` pins it. A name is shown whenever the speaker is **not** the owner, and the owner's own name appears only once someone else has spoken — so a solo session stays clean but a guest chatting alone is never anonymous. (The earlier rule hid names until two people had spoken, which made Chloe's messages look unattributed and is the bug this replaced.) The snapshot carries `owner` so every client can apply it; the rule is duplicated in `DJPage.tsx`, `public/dj-web/index.html` and `DJChatScreen.kt` — keep the three in step, as with the colour hash. Each speaker gets a stable colour hashed from their name (`src/dj/speakerColor.tsx`, duplicated verbatim in `public/dj-web/index.html` and `DJChatScreen.kt` — keep the three hashes in step so a person looks the same everywhere). The Android app drives the same in-app session from its DJ screen (`MusicNative/.../DJChatScreen.kt` + `DJChatState.kt`) over socket.io: `dj-message`/`dj-sync`/`dj-new-session` actions in, `dj-state` transcript out. The MCP bridge prefers the packaged app (port 4443) over the dev app (4444) when both are running; pin one with `MYMUSIC_DJ_PORT=4444 claude`. Taking over the queue is non-destructive: `ensureDJPlaylist` adopts the playing track and inherits the previous playlist's `getUpcoming()` via `SWAP_PLAYLIST`, which deliberately leaves `currentlyPlayingId`/`isPlaying`/`time` alone. `end_session` is the exact mirror — `handBackToShuffle` swaps in a `RandomAlbumPlaylist` the same non-destructive way, so what is playing finishes and the shuffle picks up at the next track. (Hence the action's name: it runs in both directions, and `DJ_TAKE_OVER` would be a lie on the way out.) There is no "session ended" flag to disagree with reality — `isActive()` just asks whether the playlist is a `DJPlaylist`, so handing it back *is* ending the set and queueing anything later starts a new one. `runTurn` deliberately does **not** call `ensureDJPlaylist`: every tool that needs the queue creates it itself, so merely chatting no longer seizes playback — without that, "thanks, goodnight" after `end_session` would grab the queue straight back. The opening message of an in-app session carries the last few days of plays (`recentlyPlayedBrief`), so avoiding just-heard tracks doesn't depend on the DJ choosing to call `recent_plays` — which matters because sessions are often one turn. `src/dj/concertInfo.tsx` lets the DJ see upcoming shows, but only via the artist lookups (`get_artist`, `list_artists`), the views of what is already playing or queued (`now_playing`, `get_queue`), and an explicit `concerts` tool — deliberately **not** `search_library`/`sample_tracks`/`search_albums`, since a tour date sitting beside a candidate is how a set ends up chosen for who happens to be touring. `src/dj/activity.tsx` tracks idle/pause time and app uptime so the DJ can tell an empty room from a bad set; skips and removals are attributed to whoever caused them (`QueueTransition.actor`, defaulting to `OWNER` for the desktop and Android; the web app names the sender, and `DJ_ACTOR` marks the DJ's own `skip_current`); the session also reports likes, hand-pruned tracks, and whole-album skips (distinct from single-track skips, via `DJPlaylist`'s recorded transitions) as playback feedback. Long-term DJ memory is Anthropic's client-side memory tool (`memory_20250818`) backed by `src/dj/memory.tsx`: a sandboxed `/memories` tree stored in `DATA_DIR/dj-memories/`, exposed natively on the API path and as a plain `memory` tool over MCP, so both front ends share one set of notes (viewable on the DJ page).

### Concert tracker

`src/concerts/` tracks upcoming shows near the listener by artists in the library. Data comes from the **JamBase Data API** (`api.data.jambase.com/v3`, `Authorization: Bearer` with `JAMBASE_API_KEY` from the usual env files) — Songkick is partner-only now and Bandsintown's keys are scoped to a single artist, so neither can serve a whole library. The design is one cheap **location sweep** (`/events?geoLatitude&geoLongitude&geoRadiusAmount&geoRadiusUnits&eventDateFrom&eventDateTo&perPage=100&expandExternalIdentifiers=true`) rather than a lookup per artist: `expandExternalIdentifiers` puts a MusicBrainz id on every performer, which matches **exactly** against the ~90% of library artists that have an `mbid`, so two bands sharing a name can't be confused. The free Developer tier allows **1000 calls/month**, so `store.tsx` tracks usage, refuses to sweep when spent, and only refreshes when the cache is older than **24h** — a dense metro is ~24 pages a sweep, so twice-daily would cost ~1500/month. Radius barely affects cost (15mi is 23 pages, 40mi is 26), so prefer a generous radius over a tight one. **Use my location** tries the OS first and falls back to IP. `navigator.geolocation` in Electron on macOS does reach CoreLocation (an unprivileged attempt fails with *"User has not allowed access to system location"*, which is macOS talking, not Chromium) — but only from a secure origin and only once the bundle declares `NSLocationWhenInUseUsageDescription` (set via electron-builder `mac.extendInfo`) **and** Location Services has been granted to MyMusic in System Settings. `session.setPermissionRequestHandler` must also allow it, or Electron denies the request before macOS sees it. The IP fallback uses `ipapi.co` (JamBase's own `geoIp` reports its servers, not the caller) and is ISP-accurate to a few miles, hence the "(approx.)" label. Results live in `DATA_DIR/concerts.json` — deliberately *not* in `library.json`, which is large, backed up daily, and must not churn with volatile data. A 🎟️ appears beside the now-playing artist whenever they have a show coming up — in `InfoPanel.tsx`, which both the full header and the mini player render, so one badge covers both; it reads the cache via `concertsForArtists` (a memoised artist→shows index dropped inside `saveCache`, the only writer) and never fetches, so it costs no API calls. `ConcertsPage.tsx` is the tab — a date-ordered list (sortable by play count) or a month calendar whose dots are sized by plays and coloured for favourites, filterable, with a city picker backed by `/geographies/cities?geoCityName=`. Parse show dates with `localDate` from `src/utils.tsx`, never `new Date(iso)`: a date-only value like `2027-01-14` is read as UTC midnight and renders as the 13th anywhere west of Greenwich; `ArtistConcerts.tsx` shows the same cached data on an artist page and renders nothing when there's nothing. Newly announced shows are diffed on each refresh (`findUnseen`) and carried forward across refreshes until the tab is opened, so nothing is lost between visits; the count reaches the sidebar through `concerts/alerts.tsx`, a tiny subscribable store rather than Redux, since it derives from a file on disk and only two components care. JamBase requires visible attribution, which is in the tab footer.

### Offsite backup

`src/backup/` copies the irreplaceable files to Google Cloud Storage once a day (and once at launch): `library.json` and the DJ memory notes. Art and thumbnails are deliberately excluded — the extensions refetch those and they are ~200x the bytes — and music is not handled here at all. `gcs.tsx` is a hand-rolled uploader (service-account JWT → OAuth token → `POST /upload/storage/v1/b/<bucket>/o`) rather than `@google-cloud/storage`, which is large and assumes a Node server.

The service account is **objectCreator only**, so it can create but not read, replace or delete — verified: overwrite, delete and read all return 403. Combined with timestamped object names the backup set is append-only, and neither a bug here nor ransomware on the laptop can destroy it. Restore is therefore a deliberate human act via the console, not something the app can do — and note it has **never actually been exercised**, so the first real restore will also be the first test of it.

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


## Gotchas

- The toolchain is old: React 16, TypeScript 3.7, Electron 13, react-scripts 2 patched through `@rescripts`. Don't modernize syntax or bump deps incidentally. The `start`/`build` scripts need `NODE_OPTIONS=--openssl-legacy-provider` (webpack 4's md4 hash vs Node 17+), and the BrowserWindows need `contextIsolation: false` + `enableRemoteModule: true` (Electron 12+ changed both defaults; the renderer uses `require` and `electron.remote` freely).
- All TypeScript files use the `.tsx` extension, including non-component modules (redux, library, extensions).
- `src/mediaSession.tsx` feeds the OS **Now Playing** card (menu bar, media keys, and what an AirPlay receiver shows on a TV). Without it the card falls back to the page title and blank art — which is how a TV ended up displaying "React App". Artwork must be a **data URL**, not `file://`: in dev the page is served from localhost and Chromium will not load a `file://` image into it. The MediaSession API postdates TS 3.7's DOM lib, so its types are declared locally; Chromium 91 implements it fine at runtime.
- `new Date(someString)` reads a date-only value (`2027-01-14`) as UTC midnight, so it lands on the previous day in any negative-offset timezone. Use `localDate`/`dayKey` from `src/utils.tsx` for dates that are already local to whatever they describe. Full timestamps rehydrated from the library JSON are unaffected.
- `readEnvValue` (`src/envFile.tsx`) caches a **miss** for the lifetime of the process, so adding a key to an env file always needs an app restart — with no hint that that is why it is still "not found". This has already cost one round of confusion with `JAMBASE_API_KEY`.
- `postinstall` runs `rn-nodeify` and `electron-builder install-app-deps`; `fs` is aliased to `react-native-level-fs` in the `browser`/`react-native` fields of package.json.
