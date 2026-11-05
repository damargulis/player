# Restoring the library from the offsite backup

**Rehearsed 2026-11-05.** Steps 3–6 were run end to end against a real 13MB snapshot; steps 1–2
cannot be run from this machine and the reason is below. Identifiers (project, bucket, service
accounts) are in `infrastructure.local.md`, which is gitignored because this repo is public.

## What is in the bucket

`src/backup/cloudBackup.tsx` uploads the **verbatim bytes of `library.json`** to
`library/<ISO timestamp>.json`, and the DJ notes to `dj-memories/<ISO timestamp>.json`, once a
day and once at launch. So a restore is a file copy — there is no format to convert and no tool
required.

Nothing else is up there that matters: album art, thumbnails and lyrics are deliberately
excluded because they are re-fetchable and ~200x the bytes. Music is a separate `music/` prefix
pushed by `scripts/backup-music.js`.

The last object uploaded is recorded locally in `DATA_DIR/cloud-backup.json` as `lastObject`,
with `lastTrackCount`. Read that first — it tells you what you are looking for and how many
tracks it should have.

## Step 1 — get the object (needs a browser; cannot be done from the app)

**The app's own key cannot read the bucket.** Verified again during the rehearsal: with the
backup service account, `GET` on the object, `GET` on its metadata, and `LIST` of the
`library/` prefix all return **403**. That is the safety model working as designed — the
account is `objectCreator` only, so neither a bug here nor ransomware on this laptop can
destroy or even see the backup set.

It also means a restore is **a deliberate human act**, and there is no credential on this
machine that shortcuts it:

1. Open the bucket in the Google Cloud console (Storage → Buckets → the bucket named in
   `infrastructure.local.md`).
2. Open the `library/` prefix. Objects sort by name, which is an ISO timestamp, so the newest
   is last.
3. **Pick the newest object from before whatever went wrong.** Object versioning and Soft
   Delete are on, and a lifecycle rule deletes `library/` objects 180+ days old, so there is
   roughly six months of history.
4. Download it.

`gcloud` and `gsutil` are **not installed** on this machine, so the console is the way.

## Step 2 — check it before you trust it

Do this before overwriting anything:

```sh
node -e 'const l=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));
console.log("tracks",Object.keys(l.tracks||{}).length,"albums",Object.keys(l.albums||{}).length,
"artists",Object.keys(l.artists||{}).length,"playlists",Object.keys(l.playlists||{}).length)' <downloaded file>
```

It should parse, and the track count should match `lastTrackCount` from `cloud-backup.json`.
A file that does not parse is the wrong object or a truncated download — go back to step 1.

## Step 3 — put the current library aside

**Quit MyMusic first.** Then, in `DATA_DIR` (`~/Library/Application Support/electron-react/data`
on this machine — `./data` in dev):

```sh
mv library.json library.json.before-restore-$(date +%Y%m%d-%H%M%S)
```

Rename rather than delete. The broken file is often still partly usable — this morning's
corruption was a complete library with 48 junk bytes on the end, and truncating it lost
nothing — and you cannot get a second copy of it.

## Step 4 — put the downloaded object in place

```sh
cp <downloaded file> "$DATA_DIR/library.json"
```

The bytes go in unchanged. Do not reformat or re-serialise it.

## Step 5 — start the app

`App.tsx` only re-imports from iTunes when `library.json` is genuinely **missing** (`ENOENT`);
any other read error alerts and changes nothing. So a file that is present and parseable is
loaded, and a bad one will not silently trigger a fresh import.

## Step 6 — expect to lose the enrichment made since that snapshot, and re-run it

The snapshot is a point in time, so markers added later are gone. The rehearsal snapshot, 14
hours old, was already missing ~1,450 lyrics markers and **all** of the cover-art markers.

None of it is lost work, because the files are still on disk and the extensions are
marker-driven:

- **Extensions → Lyrics** rebuilds markers from the stored `.lrc` files with no API calls
  (`markerFromStoredFile`).
- **Extensions → Cover Art** re-marks albums; art already at 1200px is skipped.
- **Extensions → Genius** skips anything already linked and converges across runs.

## What this does not cover

- **Music files.** `music/` in the same bucket mirrors the filesystem under the home directory,
  so it can be restored by hand without this app or `library.json`. That has **not** been
  rehearsed — only the library has.
- **DJ memories.** Same shape as the library: download the newest `dj-memories/` object and
  unpack it into `DATA_DIR/dj-memories/`. Also not rehearsed.
