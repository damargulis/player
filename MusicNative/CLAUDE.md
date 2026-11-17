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
same way, held until the next LAN `/start-sync`, which sends `{v: 3, plays, skips, counts}`. The
desktop's `src/syncedPlays.tsx` reads any numeric `v` as the structured shape and takes each field if
present, and still reads the old bare `{id: count}` map, so old and new builds interoperate. `counts`
carries plays from builds that kept no timestamps; the desktop stamps them with the sync moment and
marks them estimated. `PlayTracker` clears **exactly what it sent**, not the whole store, so a play
recorded while a sync is in flight survives.

A streamed play needs no special handling: `PlayTracker` keys by track id and never asks whether the
file was local.

**Known divergence:** `PlayTracker` still ignores skips under two seconds (`MIN_HEARD_MS = 2000`).
The desktop dropped that floor and now counts every skip, so the two no longer mean quite the same
thing. See `src/CLAUDE.md`.

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
