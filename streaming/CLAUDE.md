# streaming/ — playing unsynced tracks on the phone

The bucket, its service accounts and lifecycle rules are in `src/backup/CLAUDE.md`; the phone side is in `MusicNative/CLAUDE.md`.

## Streaming

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
