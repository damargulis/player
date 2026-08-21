# Ideas

Backlog of feature ideas worth building someday. Remove them as they ship.

## Name That Tune

Shipped so far: the base game (title 2pts / artist 1pt, 20s rounds), the setup
screen (mode + difficulty by play count + decade/genre/artist filters), the
Intro/Short-clip/Multiple-choice modes, speed and streak bonuses, per-settings
score history, and all-time per-genre/per-decade insights on the end screen.

- **Party mode with phones as buzzers** — the desktop already runs the
  socket.io server the mobile app connects to. Broadcast rounds over it and let
  multiple phones join as players, each answering on their own screen while the
  desktop plays audio out loud. Per-player scores, leaderboard at the end.
  Could live as a mode in MusicNative's Remote tab.
- **Hints that cost points** — escalating reveals: decade → genre → heavily
  blurred album art that sharpens over time → first letter of the title. Each
  reveal shaves a point off the round's value.
- **Playlist filter** — one more setup-screen dropdown limiting the pool to a
  playlist; the data is already in the store.
- **Daily challenge** — seed the RNG from the date so every day is the same 10
  songs; comparable across days (or with a friend who has the same library).

## Mobile

- **Favorites and edits that sync back** — plays already flow phone → desktop
  on sync; extend the protocol so favoriting on the phone (offline) is stored
  and merged into the desktop library on the next sync.
- **Selective sync + storage management** — choose which playlists to keep
  offline, show space used per playlist, Wi-Fi-only guard, "free up space".
- **Remote library browsing** — desktop-side socket actions like `playAlbum`,
  `queueTrack`, and `search` so the phone can browse and queue on the desktop
  from the couch.
