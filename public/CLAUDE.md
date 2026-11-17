# public/

Everything here loads without a build step: `electron.js` is the **main process** (plain JS, not
compiled from `src/`), and the `.html` pages are standalone windows loaded over `file://`. Plain
modules beside `electron.js` (`watchdog.js`, `windowSize.js`, `systemVolume.js`) are pulled out of it
so their logic can be tested — `electron.js` itself has top-level side effects and is not.

## The watchdog (`watchdog.js`)

The app once froze mid-album with no crash and no message: the renderer's `AudioOutputDevice`
thread spun at 99% while its main thread waited forever on the lock it held. Window, playback and
every IPC reply went at once, and changing the output device did nothing, because the thread that
would process the change was the blocked one. It had been wedged fourteen minutes before anyone
noticed. The trigger was very likely an AirPlay output stalling as the next track loaded.

**Nothing in the renderer can detect that**, since the check would run on the stuck thread. The main
process stayed at 0% CPU throughout, so it pings the renderer every 10s (`watchdog-ping` /
`watchdog-pong`) and, after three misses (~30s), shows a native dialog offering a reload. It
**asks** rather than infers: `controller-state` arrives on every `timeupdate` and looks like a free
heartbeat, but `timeupdate` stops while paused, so its silence means "wedged" or "paused". One miss
is tolerated because a long synchronous task (the library reducer writes 13MB per mutating action)
swallows a ping. The dialog is latched and asks before reloading, since a reload drops the DJ's
in-memory conversation; recovery uses `forcefullyCrashRenderer`, because `reload` is itself a task
for the blocked thread, and `render-process-gone` brings the window back.

If it happens again, grab a symbolised stack before clicking Reload:
`sudo spindump <renderer pid> 5 -file ~/Desktop/hang.txt`. `sample` gives garbage symbols here — the
installed build is x86_64 running under Rosetta.

## Window size (`windowSize.js`)

The full-size window keeps its size across a trip to the mini player. The care is in *who calls
`maximize()`*: coming back from the mini player, but also the mini player's "jump to this
track/album/artist" links, which fire whether or not the window is small. So the remembered size is
applied only when leaving mini mode; at any other moment the window keeps the size it has. Size
only, not position.

## Extension monitor windows

`extension-update` messages are keyed by `extensionId`, and **a new id opens a new
`ExtensionMonitor` window**. `group` suppresses the per-step Done button; `group-done` adds the
final summary and shows it. A batch must therefore share one id and send exactly one `group-done`
— see "Run All, batches and the monitor window" in `src/extensions/CLAUDE.md`.

## Games

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


## System volume from the phone

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
