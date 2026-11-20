# src/backup/ — offsite backup and the GCP setup

The streaming service that reads this bucket is documented in `streaming/CLAUDE.md`.

## Offsite backup

`src/backup/` copies the irreplaceable files to Google Cloud Storage once a day (and once at launch): `library.json` and the DJ memory notes. Art and thumbnails are deliberately excluded — the extensions refetch those and they are ~200x the bytes — and music is not handled here at all. `gcs.tsx` is a hand-rolled uploader (service-account JWT → OAuth token → `POST /upload/storage/v1/b/<bucket>/o`) rather than `@google-cloud/storage`, which is large and assumes a Node server.

The service account is **objectCreator only**, so it can create but not read, replace or delete — verified: overwrite, delete and read all return 403. Combined with timestamped object names the backup set is append-only, and neither a bug here nor ransomware on the laptop can destroy it. Restore is therefore a deliberate human act via the console, not something the app can do, and the steps are written down in `RESTORE.md` — **rehearsed 2026-11-05**: a real 13MB snapshot was downloaded-equivalent, placed in a scratch `DATA_DIR` and loaded by `loadLibrary` with every count matching. The half that cannot be rehearsed from this machine is getting the object at all; that was re-verified too, with `GET`, metadata and `LIST` all returning 403 under the backup key. Restoring loses the enrichment added since the snapshot — the 14-hour-old one used was already short ~1,450 lyrics markers and every cover-art marker — but none of it is lost work, since the files are on disk and the extensions are marker-driven. Music and DJ memories are **still unrehearsed**.

`readLibraryForBackup` refuses to upload an empty, corrupt or missing library. That guard exists because this app once wrote an 80-byte empty `library.json` over a good one after a failed read; faithfully copying that offsite would turn a recoverable glitch into a destroyed backup set.

`scripts/backup-music.js` pushes the ~163GB music library to the same bucket as `music/<path relative to home>`, mirroring the filesystem so it can be restored by hand without this app or `library.json`. It lives outside the app on purpose — roughly a day of wall-clock at ~18Mbps — and is restartable via a manifest in `DATA_DIR`; an object that is already there is recorded and skipped (see "What counts as already there" below). Run it with `--limit`/`--concurrency`/`--dry-run`. `src/backup/musicBackup.tsx` then keeps it current from inside the app on a 14-day cadence, hanging off the same daily `BACKUP_TIME` timer as the library backup: it shares the script's manifest and object naming (a test pins that contract, and it was checked against the live manifest), so the two are interchangeable. Runs are bounded (`MAX_FILES_PER_RUN`/`MAX_BYTES_PER_RUN`) and a run that hits a ceiling deliberately does *not* advance `lastSuccessAt`, so the daily timer keeps chipping away until the backlog clears and only then drops back to fortnightly. Its fs calls are async on purpose — the renderer is the thread playing audio, and 21k synchronous `stat`s froze it. Bookkeeping lives in `DATA_DIR`: `cloud-backup.json` (library/memories), `music-backup-manifest.json` (what is in the bucket, shared with the script) and `music-backup-state.json` (the fortnightly clock). None of it is precious — losing the manifest costs re-POSTing files to collect 403s, not data.

**What counts as "already there"** (`uploadRules.js`, shared by the app and the script, plain
CommonJS so the script can `require` it). Uploads are create-only (`ifGenerationMatch=0`); a 412,
or a 403 whose message is the overwrite refusal (`storage.objects.delete`), means the object
exists. **Any other 403 is a failure.** Every 403 used to count as success, so a revoked grant, a
disabled billing account or a wrong bucket name would have marked whole runs as backed up.
**A changed file gets its own object**, `<name>~<size><ext>`: the key cannot replace the original,
so a re-rip used to collide with it, the collision was recorded as success, and the new bytes were
never backed up while the phone streamed the old ones. The manifest stays keyed by the mirror name
and records the current object in `object`; `buildCatalog` streams from that.

**Monthly snapshots** go to `library-monthly/YYYY-MM_<timestamp>.json`, one a month by `lastMonthly`
rather than by a fixed name — a bare `YYYY-MM.json` let whoever wrote first own the month, and a
dev copy's library took `2026-11.json` before development was gated (that object is a dev
library, 21,078 tracks; delete it from the console if it is in the way). The 180-day expiry rule covers only
`library/` and `dj-memories/`, so these outlive it with no bucket change — without them, backups
that quietly stopped would let every snapshot age out. **The Stats page shows both backups' last
success and last error** (`backup/status.tsx`), flagged when overdue or failing; failures used to
reach only the console. Bookkeeping files are written through `atomicSave`. Bucket settings, the service account and the lifecycle rules are in **Cloud infrastructure** below.


## Cloud infrastructure (GCP)

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
