# MusicNative — the Android app

The primary mobile client (Kotlin + Jetpack Compose, package `com.example.musicnative`). It finds the
desktop over bonjour/mDNS, syncs songs, playlists and play counts, remote-controls desktop playback,
plays synced tracks locally, streams the rest from GCS, and chats with the DJ. Merged into this repo
with `git subtree` from its own repository and keeps its own `.gitignore`. `BareController/` is the
older React Native client, kept as a fallback; it shares the desktop API but no code.

## Building and checking

```
cd MusicNative && JAVA_HOME=/Library/Java/JavaVirtualMachines/zulu-11.jdk/Contents/Home ./gradlew assembleRelease
```

JDK 11, AGP 7.3.1. Release builds sign with the debug keystore for sideloading; debug builds get a
`.debug` application-id suffix so both can be installed.

**Nothing on the desktop side type-checks this code** — `tsc`, the Jest suite and lint never see it.
Before calling a Kotlin change good, compile it:

```
cd MusicNative && JAVA_HOME=/Library/Java/JavaVirtualMachines/zulu-11.jdk/Contents/Home ./gradlew compileDebugKotlin -q
```

Silence and exit 0 means it compiled. A cold Gradle start takes a few minutes.

Emulators cannot receive mDNS multicast, so test discovery on a real phone; test connection and
sync in an emulator with the manual IP `10.0.2.2`. Only arm64 AVDs run on this Apple Silicon machine.

## Things kept in step with the desktop

These are duplicated by hand in `DJChatScreen.kt`, `src/` and `public/dj-web/index.html` — change one
and change all three:

- the **speaker colour hash** (`speakerColor`; Java-style int hash so Kotlin and JS agree)
- **`clockTime`** — hour and minute in the viewer's locale; no `at` renders no time
- the **owner-naming rule** — anyone who is not the owner is always named; the owner only once
  someone else has spoken

The DJ's own name is **not** on that list: it arrives in the `dj-state` snapshot as `djName`
(`DJChatState.djName`) and is shown on every DJ message. An older APK ignores the field and shows the
DJ unnamed.

## Plays and skips (`PlayTracker.kt`)

The phone records each play as `{i, t}` — track id and the moment it happened — and each skip the
same way, held until the next LAN sync, which sends `{v: 3, plays, skips, counts}` as the JSON body
of `POST /start-sync` (`syncPayload`). In the query string it outgrew the desktop's ~16KB header
limit after a few hundred plays; a **404 means an older desktop** and falls back to the old
`GET /start-sync?plays=`. The
desktop's `src/syncedPlays.tsx` reads any numeric `v` as the structured shape and takes each field if
present, and still reads the old bare `{id: count}` map, so old and new builds interoperate. `counts`
carries plays from builds that kept no timestamps; the desktop stamps them with the sync moment and
marks them estimated. `PlayTracker` clears **exactly what it sent**, not the whole store, so a play
recorded while a sync is in flight survives — and only once a 200 has arrived and its body parsed
(`sendThenClear`). It used to clear first and then parse, so any error lost the plays. On failure
nothing is cleared and the same events go again next sync; the desktop dedupes timed events against
its own log (same id, timestamp and type), so a resend cannot double-count. Legacy `counts` cannot
be deduped, which is accepted.

## Sync (`SyncHelper2.kt`)

- **Process-scoped.** `SyncManager` (a singleton with its own `CoroutineScope`) runs at most one
  sync and owns its `syncState`/`percent`/`failure` LiveData; `Library.shared` is the one library per
  process. It used to run in `MainActivity.lifecycleScope`, so rotation or back cancelled it, and
  each new activity built a fresh `Library` the old sync was not writing into.
- **Failures are shown, not thrown.** A manifest failure ends the sync as `Steps.FAILED` and the
  main screen shows "Sync failed: <reason>" above the Sync button. A per-item failure (track, album
  or artist) is counted, the rest carry on, and the sync ends FAILED with the count. A non-200 for
  a *file* is still a silent skip, as before. `fetchText` throws `HttpStatusException` on any
  non-200 instead of returning `""`.
- **Timeouts** on every connection: 10s connect, 30s read for JSON and HEAD, 60s read (silence
  between reads) for files. Semaphore permits are taken with `withPermit`, so an exception cannot
  leak one.
- **Downloads go to `<name>.part`** and are renamed only when the byte count matches
  Content-Length (`isCompleteDownload`); stale `.part` files are deleted at sync start. An existing
  file not yet verified gets **one** `HEAD` and is re-fetched if its size differs from the
  server's (`lengthCheck`), which catches truncated files from before the fix. Verified files —
  downloaded through `.part`, or whose HEAD matched — are remembered in the `sync-verified-files`
  prefs (`VerifiedFiles`, flushed every 100 and at sync end, so an interrupted check resumes) and
  never HEADed again: each HEAD is an IPC round trip through the desktop's renderer. An unknown
  length or a failed HEAD keeps the file unverified, to be asked again next sync.

A streamed play needs no special handling: `PlayTracker` keys by track id and never asks whether the
file was local.

A skip is leaving a track that has not finished, however briefly it was heard — no minimum, the
same rule as the desktop (`src/CLAUDE.md`). `handleNextTrack` is the only place it is recorded;
`onCompletion` advances through `setTrack` directly, which is what keeps a natural finish from
counting.

## Queue persistence and Previous (`QueueStore.kt`, `QueueRestore.kt`)

The local player's queue survives the app being killed. `QueueStore` keeps two SharedPreferences
files: `player-queue` (the queue's track ids as a JSON array — written only when the queue array
itself changes, since an All Tracks queue is thousands of ids and SharedPreferences rewrites the
whole file) and `player-position` (index, current track id, position ms, repeat — written on every
track change, pause, seek, shuffle, end of queue, `onDestroy`, and every 10s while playing; never
per progress tick). Only ids are stored, **never a stream URL**: signed URLs expire after an hour.

`MediaPlaybackService.onCreate` restores off the main thread: loads `library.json` and the cached
stream catalog, then `restoreQueue` drops ids that are neither synced-with-a-file nor in the
catalog. The current track is found by id (the saved index only breaks ties); if it is gone, the
next surviving track becomes current from 0 (or the last one, at the end). The restored queue is
**paused and unprepared** — nothing is prepared or fetched until play, when `setTrack` resolves it
(local file or a fresh signed URL) and `onPrepared` seeks to the saved spot. A queue started while
the restore is in flight wins. The session sets an explicit media-button receiver and the
manifest declares `androidx.media.session.MediaButtonReceiver`, so a Bluetooth/lock-screen play
after the process died restarts the service and the play is held until the restore lands.

**Previous restarts past 3 seconds**: `shouldRestartOnPrevious` — more than 3000 ms in (or on the
first track) seeks to 0, otherwise goes back a track. Every phone route (in-app button, notification,
MediaSession `onSkipToPrevious`, media-button key events) goes through `handlePreviousTrack`, and
neither branch touches `PlayTracker`. The Remote screen's `prevTrack` goes to the desktop, which
applies its own rule. Pure logic is unit-tested in `QueueRestoreTest` (`./gradlew testDebugUnitTest -q`).

## Streaming

`Connectivity.kt` tracks *validated* internet (`NET_CAPABILITY_VALIDATED`, so a captive portal reads
as offline); `StreamingClient.kt` talks to the Cloud Run service; `MergedLibrary.kt` folds the
streaming catalog into the synced library by the desktop's own ids. Build `MergedLibrary` with
`rememberMergedLibrary` **inside each screen**, never hoisted into the NavHost builder — a value
captured there is frozen at the composition that built the graph, which is how the cloud half once
never appeared. The service URL and token are baked in from `local.properties` (`streaming.url`,
`streaming.token`; see `local.properties.example`). The player is `android.media.MediaPlayer`, not
ExoPlayer. The full design is in `streaming/CLAUDE.md`.

## Remote volume

The Remote screen can set the laptop's **system** volume. It hides the control when the desktop's
`state` carries no `systemVolume`, so an older desktop shows no dead slider.
