# src/extensions/ — metadata, art and lyrics

## Extensions

`src/extensions/wiki`, `src/extensions/musicbrainz`, and `src/extensions/genius` batch-fetch metadata for the whole library using `es6-promise-pool`. They're triggered from the app menu (main process → `run-extension` IPC → `App.tsx`), report per-item progress via `extension-update` IPC to a dedicated `ExtensionMonitor` window (`public/extension_monitor.html`), and resolve to a `LibraryInfo` delta dispatched through `updateLibrary`. A new `extensionId` is what opens a window, so each `run*Extension` takes an **optional shared id**: a Run All passes one, and the five steps report into a single window instead of opening five. The monitor **accumulates** summaries above a progress area that survives, because `done` used to clear the whole body and would otherwise have destroyed the elements the later steps needed and left only the last summary. A grouped run announces itself with `group` (which suppresses the per-step Done button — offering to close after step one of five is a lie) and finishes with `group-done`, sent whatever happened: a step that throws never sends its own summary, so counting summaries would leave the window with no way out. The palette lives in `public/theme.css`, shared by the monitor and by `game-common.css`, so the `file://` pages have one definition to keep in step with `src/App.css`. Failures are recorded on the entity's `errors` array rather than thrown, using the shared `ExtensionError` enum in `src/extensions/errors.tsx` — an error means *no* extension could fill that data, so any extension that succeeds clears it, and `NO_MATCH` is only set when an entity has neither a `wikiPage` nor an `mbid`. **`ALBUM_ART` and `PIC` are derived, not reported**: they state that the entity has no picture, which is a fact about the entity, so every writer and `loadLibrary` both put them through `setError`/`withError` keyed on whether the file is actually set. Recorded instead as "a download failed", they drifted both ways — 257 of the 267 albums flagged "No album art found" had art, 34 albums with none were flagged with nothing, and artists were wrong 56 and 78 ways. A failed request against an album that already has a cover is not a missing cover, and a successful fetch is not the only way to come to have one. Deriving it on load means a stale flag corrects itself at next launch rather than needing an extension run. Wiki parsing tests use saved HTML fixtures in `src/extensions/wiki/test_pages/`. The genre parser **skips `<style>`, `<script>`, `<noscript>` and `<template>`**: Wikipedia injects **TemplateStyles** into the infobox — a `<style>` element sitting inside the genre cell carrying the Hlist stylesheet — and walking into it read the CSS as text and split it on commas, so `.mw-parser-output .hlist dl` and 38 more like it became genres on most pages the extension touched. A second guard rejects any candidate containing braces, semicolons, angle brackets or a leading dot, because a stylesheet reaching the formatter once already cost 39 junk genres. It is structural only — there is deliberately **no length limit**: every one of those 39 carried one of those characters, so a limit rejected nothing real while standing ready to discard a long genuine genre. `loadLibrary` drops stored genres that look like CSS **and are referenced by nothing**, so the file repairs itself; a referenced one is kept, since a dangling id is worse than a visibly wrong genre. `genres.test.js` pins it against the real Radiohead infobox as served. Genius answers a rate limit with **HTML and a `Retry-After` measured in thousands of seconds** (roughly an hourly quota), so `genius/api.tsx` checks `res.ok` *before* parsing — parsing an error page as JSON and swallowing the throw is what once made a throttled track look identical to one with no match, and let a sweep run through the whole library recording nothing. Hitting the limit now short-circuits every later call (an hour is far too long to sit in a retry loop) and the summary says when to resume; a fresh run clears the flag. Matching a search hit to a track lives in `genius/match.tsx`, **not** in `main.tsx`, and it is deliberately fuzzy: exact string equality was the limiting factor on the hit rate rather than Genius's catalogue. Probing 180 of the tracks the extension had failed to link found the right song as the *first* hit for nearly all of them, thrown away over a comma — "Paint It Black" vs "Paint It, Black", "3 A.M." vs "3 AM", "Gods Dice" vs "Gods' Dice", "Deja Vu" vs "Déjà Vu" — with only 5 returning no hits at all. Folding punctuation, accents and `&`, making a leading "the" optional, allowing a trailing bracketed qualifier on either side and allowing an explicit "and <backing band>" took that sample from 49% to 73%. Both a spaced and a separator-free key are compared because neither alone is enough: the spaced key fixes "Uncle Albert/Admiral Halsey", the tight one fixes "3 A.M." and "Boxcar Racer" vs "Box Car Racer". The artist rule accepts only an explicit "and" — a bare whole-word prefix linked "Pearl" to "Pearl Jam" until a test caught it, and `match.test.js` pins the refusals (covers, the Traducciones accounts, prefixed titles) as carefully as the matches, because a wrong link is worse than none. A miss now records `Track.genius.missedBy = MATCHER_VERSION` instead of storing nothing: a bare miss was indistinguishable from "the run never got this far", which is how roughly half of 3,351 unlinked tracks came to be ones that matched *exactly*. A settled miss is skipped on re-run, so a 21k sweep converges across passes instead of re-searching everything against the hourly quota — and bumping `MATCHER_VERSION` retries every old miss, which is the whole reason the version is recorded rather than a flag. A rate-limited track is deliberately **not** marked, since it has not been checked and marking it would bake the outage into the library. The MusicBrainz API client (`src/extensions/musicbrainz/api.tsx`) serializes requests ~1.1s apart to respect MB's 1 req/sec rate limit.


## Cover art

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

The album page has a **Get Cover Art** button under **Run All Extensions** — the resolution, a per-album Run, and a **Remove** live in the art zoom (`src/ArtZoom.tsx`), where the picture can actually be seen. Run All's order lives in
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

The artist page has a **Run All Extensions** that covers
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


## Lyrics

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

## Errors: facts about the entity, and who stands behind them

`entity.errors` is a list of **gaps**, not failures, and each kind is kept honest a different way:

- **`ALBUM_ART` / `PIC` are derived** from whether the file is set — every writer and `loadLibrary`
  go through `setError`/`withError`. Having a picture is a fact about the entity.
- **`GENRE` / `YEAR` come from provenance**, because the iTunes import writes both and an imported
  value is not one any source stands behind. `Album.metaSources` / `Artist.metaSources` record what
  each real source (MusicBrainz, Wikipedia) last found; the error means *every source that has
  reported came up empty*. A source only records when it actually answered — a failed lookup is not
  a statement about the data. Before this, the extension that ran **last** decided, and MusicBrainz
  runs first, so a Wikipedia page with no genre row erased a good MusicBrainz answer: 57 of the 82
  albums flagged "No genres found" had genres. `loadLibrary` re-derives both, but leaves a field no
  source has reported on exactly as stored rather than asserting either way.
- **Genres are the union of the sources**, not whichever spoke last. `metaSources.genres` keeps each
  source's names separately and `applyGenres` (`genreSources.tsx`, the single definition, four
  callers) sets `genreIds` to their case-folded union — which is also what drops an imported genre
  no source mentions. It only replaces when there is something to replace *with*: an album whose
  sources both came up empty keeps its imported genre, because a coarse genre beats none and a Run
  All whose Wikipedia step throws must not leave the album genreless. A genre set by hand in an
  editor is replaced on the next run; there is no `manual` source.
- **`TRACK` vs `TRACKLIST`**: `TRACKLIST` means *the tracklist could not be read*; `TRACK` means
  *the count does not match*. They used to be one error, so an unreadable page reported "wrong
  number of tracks" — on every album with a Wikipedia page, because the parser had stopped working
  (below). When a page cannot be read, `TRACK` is left as it is, since MusicBrainz may have a real
  verdict on it. Wikipedia still overwrites MusicBrainz's `TRACK` verdict when it can read the page,
  because it runs second; nobody owns the track check yet.

## Wikipedia tracklists

`src/extensions/wiki/tracklist.tsx`. Wikipedia serves **Parsoid HTML** now, where a heading is
wrapped in `<section><div class="mw-heading">…</div>`, so the old walk down `nextElementSibling`
from the `<h2>` found the edit-section link and nothing else — across 60 live album pages it
returned tracks for **0**, and the suite passed throughout because every saved fixture predated the
change. The parser now selects `table.tracklist` (the `{{Track listing}}` template; 58 of 60 pages)
and falls back to the older `<ol>` form with a wrapper-aware walk.

**Captions** separate the album from its editions: `Side one`, `Disc 1: Big Steppers`,
`<album> track listing` are the album; `Japanese edition bonus track`, `Rhino reissue bonus tracks`
are not; `standard` is checked first so `Franz Ferdinand (standard edition)` is the album. Only the
**first run** of album tables counts — Wikipedia lists the original first, and summing every
non-edition table added up *My Aim Is True*'s whole release history to 95 tracks. For `<ol>` pages
only a subheading or a wholly bold paragraph is a label; prose like "All tracks are written by…"
fell through to the "unrecognised caption ⇒ edition" rule and filed an entire album as bonus tracks.

`contentText` (`wiki/utils.tsx`) strips `<style>` and `<sup>` before reading any text: captions carry
the same TemplateStyles the genre cell does, and footnote markers render inside title cells.

Bonus tracks listed on a page are **not** an error — matching the main release exactly is complete.
Comparison is still **by count**; titles are where the remaining accuracy is (`genius/match.tsx`
already has the folding), and notes rendered outside the quotes make some titles ambiguous
(`"Savior" (Interlude)` and `"Savior"` both parse as `Savior`).

**Fixtures in `wiki/test_pages/` are real current pages**, trimmed to a prefix ending at the close
of the Track listing section so the Parsoid wrappers are intact. Refresh them when Wikipedia's
markup changes; stale fixtures are exactly how this broke unnoticed.

## Name matching

MusicBrainz's `normalize` **folds** accents before stripping non-alphanumerics, through
`foldForSearch` (`src/utils.tsx`, the fold every search box uses). It used to strip them, so
"Sigur Rós" keyed as `sigurrs` and never matched a library holding "Sigur Ros" — the same bug the
games already had. 14 artists here carry a non-ASCII letter.

## Run All, batches and the monitor window

`runAll.tsx`. **A new `extensionId` is what opens a monitor window**, and `group-done` is what puts
its Done button up. So a batch owns one window: `runBatch` (behind `runAllForAlbums`,
`runAllForArtists` and `runAllForTargets`) opens it, passes a `SharedRun` to every entity, and is the
only thing that sends `group-done`. It used to mint an id per entity — a sweep over 50 albums would
have opened 50 windows, each offering Done after its own five steps.

`runAllForTargets` is the New Tracks page's mixed run over `album:<id>` / `artist:<id>` targets.
Albums run first and artists get only `ARTIST_META_STEPS` (MusicBrainz, Wikipedia): the albums
already cover their own cover art and tracks, and the full artist pass ran Genius and Lyrics a
second time over them — and on an artist already in the library would sweep their whole catalogue.
`ARTIST_STEPS` is composed from `ARTIST_META_STEPS`, not a second copy of it.

**Art deletion.** `artFile.tsx` is the only thing that writes art and `src/artRemoval.tsx` is the only
thing that deletes it (the zoom's Remove). Removing clears the reference and `coverArt`, sets the
error, and unlinks the file only when no other entity points at it. Removing a picture does not stop
the next MusicBrainz run re-matching the same wrong artist; there is no "this match is wrong" marker.
`longerSide` lives in `imageSize.tsx` beside the reader it uses.

The art zoom's "largest the Archive has" note shows only when `coverArt.maxPx < coverArt.target`.
At the target it is untrue — CAA scaled down a bigger original — and it showed on 1,192 albums.

## Which release group, and per-track genres and years

**Album year is the original release's, track year is the song's.** They may differ in the library,
and that is fine; each should match its own thing on MusicBrainz.

- `pickBestReleaseGroup` ranks exact-title candidates: a primary-type Album first, then fewest
  *unexplained* secondary types (`unexplainedTypes` — Live, Compilation, Remix… are only fine when
  the album's own name asks for them, "Live at Leeds", "Greatest Hits"), then the earliest
  `first-release-date`. It used to take the first primary-type Album, which put "Hotel
  California" on a 1992 **live** record and the library has said 1992 since. A reissue the library
  *does* name ("… (20th Anniversary Edition)") still matches its own group through exact titles.
- An album already matched to a group with unexplained secondary types is **re-searched once**
  during a MusicBrainz run and moved if a better group exists. This also overrides an mbid set by
  hand in the editor if the album's name does not justify it.
- After the tracklist matches one-to-one, `browseRecordings` (one request per album) gives every
  recording's genres and `first-release-date`, and `recordingUpdate` turns them into a track's
  genres (top five by votes) and year. Only what a source supplies replaces anything. ~90% of
  recordings on a sampled set carry genres; compilations are the exception. This adds one
  rate-limited request per album to every MusicBrainz run.
