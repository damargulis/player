# Streaming service

Lets the phone play tracks it has not synced, with this laptop asleep.

The laptop is a **publisher only**: it uploads audio to `music/` and an index to `catalog/`.
This service answers *what exists?* and *where is track X?* — it never touches audio bytes.
A request gets back a short-lived V4 signed URL and the phone streams straight from GCS, which
is what keeps the service inside the Cloud Run free tier and what gives ExoPlayer HTTP Range
seeking for free.

```
GET /health      unauthenticated liveness
GET /catalog     the track list (object names stripped)
GET /track/:id   {url, expiresAt}
```

## Files

| | |
|---|---|
| `server.js` | routing, auth gate, catalog cache |
| `signing.js` | V4 signed URLs; `localSigner` for a key file, `iamSigner` for Cloud Run |
| `auth.js` | per-device bearer tokens, compared as hashes |
| `gcs.js` | credentials (metadata server or key file), catalog listing and fetch |
| `mint-token.js` | one-off device enrolment |

## Config

| Variable | |
|---|---|
| `GCS_BACKUP_BUCKET` | required; same bucket as the backups |
| `STREAM_DEVICE_TOKENS` | required; `<sha256hex>:<label>,…`. Empty means nobody can authenticate, and the service refuses to start rather than pretending to work |
| `GCS_KEY_FILE` | local runs only; on Cloud Run the attached service account is used instead and **no key exists** |
| `STREAM_URL_TTL_SECONDS` | default 3600 |
| `STREAM_CATALOG_TTL_SECONDS` | default 600 |

## Deploying

The service needs an identity that can read the bucket and sign as itself:

1. Create a service account for the service — **separate** from the backup writer, which stays
   `objectCreator`-only so a compromise here cannot touch backup integrity.
2. Grant it `roles/storage.objectViewer` on the bucket.
3. Grant it `roles/iam.serviceAccountTokenCreator` **on itself**, so it can call `signBlob`.
   Without this every `/track/:id` fails and `/catalog` still works, which is a confusing
   half-broken state worth recognising.
4. Deploy with `--service-account` set to it and `--no-allow-unauthenticated` **off** (the
   service does its own auth; Cloud Run IAM would block the phone).

Per the IaC policy in `CLAUDE.md`, this stack should be Terraform from the start — it is all
cheap to recreate. The bucket is not, and stays out.

## Enrolling a device

```
node streaming/mint-token.js daniel-phone
```

Put the token in the app; append the `hash:label` to `STREAM_DEVICE_TOKENS` and redeploy.
Revoking is removing one entry.

## Testing

`yarn test streaming/` — runs with the rest of the suite, inside Electron. Note Electron 13
bundles Node 14 while this service runs on Node 18+, so avoid anything newer than Node 14 in
code the tests touch (this already bit `base64url`).

Full end-to-end cannot be exercised locally until the reader service account exists: the backup
key is `objectCreator`-only and can neither list nor read. The signing is verified against live
GCS another way — sign with the backup key and GCS answers `AccessDenied` rather than
`SignatureDoesNotMatch`, which proves the signature itself validated.
