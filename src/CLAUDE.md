# src/ — the renderer: playback, skips, the event log and stats

The app overview, commands, testing notes and cross-cutting gotchas are in the root `CLAUDE.md`.

## Event log

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
`playDate` forward, so a late sync cannot rewind it. The whole sync is applied as **one** `updateLibrary` delta
(`syncedTrackUpdates`): it was one `updateTrack` per track, and every mutating action saves the
whole library, so 150 synced tracks froze the window for about five seconds. `PlayTracker` also now clears **exactly
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

**`Track.skipCount` had been frozen since the iTunes import**: `library/itunes.tsx` reads "Skip
Count" from the XML and for years nothing in the app incremented it, so the 17,140 skips across
5,658 tracks it carries are history from another program. `Album.skipCount` was worse — present
since the import, 0 on every album, never written by anything. Both are written now, by the rules
in "Skips" below.

Phone skips come over the same protocol: `PlayTracker` keeps a second list, `/start-sync` sends
`{v: 3, plays, skips, counts}`, and `syncedPlays.tsx` reads any numeric `v` as the structured
shape and takes each field if present — so adding `skips` needed nothing of an older desktop
beyond ignoring it. Neither side applies a minimum listening time, so a phone skip and a desktop skip mean the same
thing. The phone had a two-second floor for a while after the desktop dropped its own; it is gone
too, and an APK older than that still discards skips under two seconds.

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

## Skips: what counts, and where it is recorded

A skip is **leaving a track that has not finished**, however briefly it was heard and however late
you leave. There is deliberately no minimum listening time — a two-second floor discarded every
quick rejection and made the feature impossible to observe, since skipping through a few tracks to
see it work recorded nothing — and no upper bound.

It is recorded at **one choke point**: `App.componentDidUpdate`, when the playing track's **id**
changes, through `recordTrackChange` in `src/skips.tsx`. That is a statement about the track
changing rather than about which control was pressed, so it covers every route — the transport
button, Cmd+0, either phone, the next-album button, the DJ's `skip_current`, and anything added
later. It replaced a single call in `ControlPanel`, which left five routes recording nothing: the
log held 388 plays and zero skips over five days before anyone noticed. **Do not add skip
recording at a call site**; if a route needs different treatment, give the choke point a marker.

The choke point cannot see *why* the track changed, so three markers tell it:

| Marker | Set by | Means |
|---|---|---|
| `noteNaturalFinish(trackId)` | the `ended` handler, **before** it dispatches anything | not a skip |
| `noteRewind()` | the `prevTrack` / `prevAlbum` action creators | not a skip — going back says nothing about the song |
| `noteAlbumSkip()` | the `nextAlbum` action creator | one **album** skip, and *no* track skip for whatever was playing |

They live on the action creators because those are the single funnel for every route that does the
thing, and each is consumed by the next change. The finish marker is keyed on the track id rather
than being a boolean: `ended` bumps the play count before it advances, and a boolean was read and
cleared by that update instead of by the real change. Three markers is about the limit for this
shape; a fourth probably wants a small state machine.

Two more sources, both in `session.noteListenerRemoval`, which every DJ client routes through:

- **X-ing tracks out of the DJ queue** skips each of them — the same judgement as pressing next,
  made before hearing it. `recordRemovals` batches them into one log write and one dispatch, and
  counts duplicates: a queue can hold a track twice, and removing both is two rejections.
- **Dropping a whole album from the DJ queue** is one album skip, like the next-album button.

Why an album rejection goes against the album: skipping the rest of a record is a verdict on the
record, not on each unheard track. Logged per track it would slowly fill "most skipped" with songs
the listener never formed an opinion about — whatever sits late on albums they often bail out of.
Album skips are entries with `subject: 'album'`; `skipRate` and the other per-track helpers ignore
them (an album id in the track rates would describe a track that does not exist), and
`aboutAlbums` / `aboutTracks` / `countsById` exist to read them.

The DJ's own `remove_from_queue` tool records **nothing**: it calls `playlist.removeUpcoming`
directly, and the DJ reshuffling its own queue is not a listener rejecting anything.

## The Stats page and the range chips

**Every section derived from listening follows the range chips.** A visible range selector that some
charts ignored was worse than none; the two that used to sit outside it have moved in.

One rule for "All time", everywhere: **all time reads the entity's running totals; any shorter
range reads the log.** The log only reaches back to when it was first written, so an all-time
figure built from it would quietly mean "since the log started", while the totals carry the iTunes
history plus everything since.

- **Most Skipped** — the only skip list; an all-time "Most Skipped Tracks" used to sit beside it and
  was the same list with the range on All time. A count/rate toggle, and the encounter floor applies
  to the **rate** view only (3 in a window, 10 for lifetime counts), because one skip and no plays
  reads as "100% skipped". Ranking by count needs no floor.
- **Top Genres by Time Listened** — `duration × plays`, with plays from the window or from `playCount`.
- **Albums Skipped** — count only: nothing logs an album *play*, so there is no denominator.

## Playback failures

The audio element has an `error` listener: a file that will not load names the track, shows a
notice, and advances the queue. There was none before, and `play()`'s rejection was swallowed, so a
moved file — 55 of them exist — stopped playback dead with nothing on screen. A *deadlocked*
renderer produces no `error` event at all; that case is the watchdog's, in `public/CLAUDE.md`.

## Previous, and the queue across restarts

**Previous restarts a track more than three seconds in** (`shouldRestart` in `redux/actions.tsx`)
and only goes back within the first three seconds — or restarts when there is nothing behind.
`prevTrack` is a thunk because it needs the position; every route goes through it. Restarting sets
no rewind marker, and going back clears the marker again when the track did not change in the end:
an unconsumed marker used to swallow the next real skip.

**The queue survives a restart.** `playlist/queueStore.tsx` writes `DATA_DIR/queue.json` when the
track, the queue or play/pause changes, at most every 10s for the position alone, and
synchronously on quit; each playlist class has `save()` and a static `fromSaved()`
(`playlist/savedQueue.tsx` has the shapes). Everything is saved **by id** and rebuilt against the
library at launch, so deleted tracks and empty albums drop out, and a queue whose current track is
gone starts a fresh shuffle instead. It comes back **paused** at the saved position
(`RESTORE_PLAYBACK`) — a launch never starts the music. Saving starts only after the restore, and
an unstarted queue saves nothing, so a launch cannot clobber the file. A restored DJ queue is a DJ
queue: when it runs low the DJ is asked to refill it as usual, with a fresh conversation, since
the conversation itself is not saved. The phone does the same for its own player
(`MusicNative/CLAUDE.md`).

