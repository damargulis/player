// Rules shared by the app's music backup (musicBackup.tsx) and scripts/backup-music.js, which
// write the same manifest and must name and judge objects identically. Plain CommonJS so the
// script can require it without a build step.
const path = require("path");

/**
 * Whether an upload's failure means the object is already in the bucket.
 *
 * The backup key is objectCreator-only. Uploads ask for `ifGenerationMatch=0` (create only), and
 * GCS answers an existing object with 412. A 403 counts as "already there" only when its message
 * is the overwrite refusal — the key lacking `storage.objects.delete`. Every 403 used to be read
 * that way, so a revoked grant, a disabled billing account or a wrong bucket name marked each file
 * in the run as safely uploaded without uploading it.
 */
function alreadyExists(status, body) {
  if (status === 412) {
    return true;
  }
  return status === 403 && /storage\.objects\.delete/.test(body || "");
}

/**
 * The object a file's bytes go to. The first upload uses the mirror name, `music/<path>`. A file
 * whose size has changed since (a re-rip or a re-tag) cannot go there — the key cannot replace an
 * object — so it gets a versioned sibling, `<name>~<size><ext>`, and the manifest records which
 * object holds the current bytes. Before this, the changed file collided with the old object,
 * the collision's 403 was recorded as success, and the new bytes were never backed up while the
 * phone kept streaming the old ones.
 */
function objectFor(baseName, size, entry) {
  if (!entry || entry.size === size) {
    return (entry && entry.object) || baseName;
  }
  const ext = path.posix.extname(baseName);
  return `${baseName.slice(0, baseName.length - ext.length)}~${size}${ext}`;
}

module.exports = {alreadyExists, objectFor};
