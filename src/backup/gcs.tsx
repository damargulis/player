import {DATA_DIR} from '../constants';
import crypto from 'crypto';
import {readEnvValue} from '../envFile';
import fs from 'fs';

/**
 * Minimal Google Cloud Storage uploader.
 *
 * Hand-rolled rather than pulling in @google-cloud/storage: that package is large, assumes a
 * Node server, and we need exactly one call — upload an object. The service account behind it
 * is deliberately objectCreator-only, so this can create but never read, replace or delete.
 */

const TOKEN_SCOPE = 'https://www.googleapis.com/auth/devstorage.read_write';
const BUCKET_KEY = 'GCS_BACKUP_BUCKET';
const KEY_FILE_KEY = 'GCS_BACKUP_KEY_FILE';

interface ServiceAccountKey {
  client_email: string;
  private_key: string;
  token_uri: string;
  project_id: string;
}

export class GcsError extends Error {
  public status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function bucketName(): string | undefined {
  return readEnvValue(BUCKET_KEY);
}

export function keyFilePath(): string {
  return readEnvValue(KEY_FILE_KEY) || `${DATA_DIR}/gcs-backup-key.json`;
}

export function loadKey(): ServiceAccountKey | undefined {
  try {
    const key = JSON.parse(fs.readFileSync(keyFilePath(), 'utf8')) as ServiceAccountKey;
    return key.client_email && key.private_key ? key : undefined;
  } catch (err) {
    return undefined;
  }
}

export function isConfigured(): boolean {
  return Boolean(bucketName() && loadKey());
}

export function setupHelp(): string {
  return `Set ${BUCKET_KEY}=<bucket> in .env.local (dev) or data/.env (packaged), and put the ` +
    `service account key at ${keyFilePath()}.`;
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Tokens last an hour; keep one rather than re-signing for every object. */
let token: {value: string; expires: number} | undefined;

export function resetToken(): void {
  token = undefined;
}

async function accessToken(key: ServiceAccountKey): Promise<string> {
  if (token && Date.now() < token.expires - 60 * 1000) {
    return token.value;
  }
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({alg: 'RS256', typ: 'JWT'}));
  const claim = base64url(JSON.stringify({
    aud: key.token_uri,
    exp: now + 3600,
    iat: now,
    iss: key.client_email,
    scope: TOKEN_SCOPE,
  }));
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(`${header}.${claim}`);
  const assertion = `${header}.${claim}.${base64url(signer.sign(key.private_key))}`;
  const res = await fetch(key.token_uri, {
    body: new URLSearchParams({
      assertion,
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    }).toString(),
    headers: {'content-type': 'application/x-www-form-urlencoded'},
    method: 'POST',
  });
  const text = await res.text();
  if (!res.ok) {
    throw new GcsError(res.status, `Could not authenticate with Google Cloud: ${text.slice(0, 200)}`);
  }
  const body = JSON.parse(text) as {access_token: string; expires_in: number};
  token = {expires: Date.now() + body.expires_in * 1000, value: body.access_token};
  return body.access_token;
}

export interface UploadResult {
  name: string;
  size: number;
}

/**
 * Uploads one object. Names must be unique: the service account cannot replace an existing
 * object, so a repeated name fails with 403 rather than quietly overwriting a good backup.
 */
export async function uploadObject(
  objectName: string, contents: string, contentType: string = 'application/json',
): Promise<UploadResult> {
  const bucket = bucketName();
  const key = loadKey();
  if (!bucket || !key) {
    throw new GcsError(0, `Cloud backup is not set up. ${setupHelp()}`);
  }
  const url = `https://storage.googleapis.com/upload/storage/v1/b/${encodeURIComponent(bucket)}` +
    `/o?uploadType=media&name=${encodeURIComponent(objectName)}`;
  const res = await fetch(url, {
    body: contents,
    headers: {
      'Authorization': `Bearer ${await accessToken(key)}`,
      'Content-Type': contentType,
    },
    method: 'POST',
  });
  const text = await res.text();
  if (!res.ok) {
    throw new GcsError(res.status, `Upload of ${objectName} failed (${res.status}): ${text.slice(0, 200)}`);
  }
  const body = JSON.parse(text) as {name: string; size: string};
  return {name: body.name, size: Number(body.size)};
}
