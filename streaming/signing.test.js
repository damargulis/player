const crypto = require('crypto');
const {
  canonicalRequestFor,
  encodeObjectPath,
  localSigner,
  signedUrl,
  uriEncode,
} = require('./signing');

// A fixed instant so every expectation below is exact rather than approximate.
const NOW = Date.UTC(2026, 9, 24, 18, 42, 34);
const BASE = {
  bucket: 'test-bucket',
  clientEmail: 'signer@example.iam.gserviceaccount.com',
  expiresSeconds: 3600,
  now: NOW,
  objectName: 'music/Music/Artist/Album/01 Song.m4a',
};

describe('uriEncode', () => {
  // encodeURIComponent leaves !'()* alone; Google's V4 spec does not. Tracks with brackets or
  // apostrophes in the title are common enough that getting this wrong breaks real playback.
  it('encodes the characters encodeURIComponent leaves behind', () => {
    expect(uriEncode("!'()*")).toEqual('%21%27%28%29%2A');
  });

  it('leaves the unreserved set alone', () => {
    expect(uriEncode('AZaz09-._~')).toEqual('AZaz09-._~');
  });

  it('encodes spaces as %20, not +', () => {
    expect(uriEncode('a b')).toEqual('a%20b');
  });
});

describe('encodeObjectPath', () => {
  it('keeps separators but encodes each segment', () => {
    expect(encodeObjectPath('music/My Album/01 Song.mp3'))
      .toEqual('music/My%20Album/01%20Song.mp3');
  });

  it('encodes non-ascii, which this library has plenty of', () => {
    expect(encodeObjectPath('music/Sigur Rós/( )/02.mp3'))
      .toEqual('music/Sigur%20R%C3%B3s/%28%20%29/02.mp3');
  });
});

describe('canonicalRequestFor', () => {
  const built = canonicalRequestFor(BASE);

  it('builds the seven-line canonical request GCS expects', () => {
    const lines = built.canonicalRequest.split('\n');
    expect(lines[0]).toEqual('GET');
    expect(lines[1]).toEqual('/test-bucket/music/Music/Artist/Album/01%20Song.m4a');
    expect(lines[3]).toEqual('host:storage.googleapis.com');
    expect(lines[4]).toEqual('');
    expect(lines[5]).toEqual('host');
    expect(lines[6]).toEqual('UNSIGNED-PAYLOAD');
  });

  it('sorts the query string by encoded key, which the signature depends on', () => {
    const keys = built.canonicalQuery.split('&').map((pair) => pair.split('=')[0]);
    expect(keys).toEqual([...keys].sort());
  });

  it('scopes the credential to the signing date', () => {
    expect(built.credentialScope).toEqual('20261024/auto/storage/goog4_request');
    expect(built.timestamp).toEqual('20261024T184234Z');
  });

  it('carries the requested lifetime', () => {
    expect(built.canonicalQuery).toContain('X-Goog-Expires=3600');
  });

  it('string-to-sign is the algorithm, timestamp, scope and request hash', () => {
    const lines = built.stringToSign.split('\n');
    expect(lines[0]).toEqual('GOOG4-RSA-SHA256');
    expect(lines[1]).toEqual(built.timestamp);
    expect(lines[2]).toEqual(built.credentialScope);
    expect(lines[3]).toEqual(
      crypto.createHash('sha256').update(built.canonicalRequest).digest('hex'));
  });

  it('is deterministic for a given instant', () => {
    expect(canonicalRequestFor(BASE).stringToSign).toEqual(built.stringToSign);
  });

  it('changes when the object changes, so one URL cannot serve another track', () => {
    const other = canonicalRequestFor(Object.assign({}, BASE, {objectName: 'music/Other.mp3'}));
    expect(other.stringToSign).not.toEqual(built.stringToSign);
  });
});

describe('signedUrl', () => {
  // A real keypair, so this asserts the signature actually verifies rather than merely existing.
  const {privateKey, publicKey} = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    privateKeyEncoding: {format: 'pem', type: 'pkcs8'},
    publicKeyEncoding: {format: 'pem', type: 'spki'},
  });

  it('produces a signature that verifies against the public key', async () => {
    const url = await signedUrl(BASE, localSigner(privateKey));
    const signature = url.split('X-Goog-Signature=')[1];
    const {stringToSign} = canonicalRequestFor(BASE);
    const ok = crypto.createVerify('RSA-SHA256').update(stringToSign)
      .verify(publicKey, Buffer.from(signature, 'hex'));
    expect(ok).toBe(true);
  });

  it('points at the object on the storage host', async () => {
    const url = await signedUrl(BASE, localSigner(privateKey));
    expect(url.startsWith(
      'https://storage.googleapis.com/test-bucket/music/Music/Artist/Album/01%20Song.m4a?'))
      .toBe(true);
  });

  it('carries every parameter GCS needs to validate it', async () => {
    const url = await signedUrl(BASE, localSigner(privateKey));
    ['X-Goog-Algorithm', 'X-Goog-Credential', 'X-Goog-Date', 'X-Goog-Expires',
      'X-Goog-SignedHeaders', 'X-Goog-Signature'].forEach((param) => {
      expect(url).toContain(param);
    });
  });
});
