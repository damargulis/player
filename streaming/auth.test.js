const {authenticate, bearerFrom, mintToken, parseAllowlist} = require('./auth');

describe('parseAllowlist', () => {
  it('reads hash:label pairs', () => {
    const list = parseAllowlist(`${'a'.repeat(64)}:phone,${'b'.repeat(64)}:tablet`);
    expect(list).toEqual([
      {hash: 'a'.repeat(64), label: 'phone'},
      {hash: 'b'.repeat(64), label: 'tablet'},
    ]);
  });

  it('defaults a missing label rather than dropping the device', () => {
    expect(parseAllowlist('c'.repeat(64))[0].label).toEqual('unnamed');
  });

  // A malformed entry must not silently become a wildcard or crash the service at boot.
  it('discards anything that is not a sha256 hex digest', () => {
    expect(parseAllowlist('nonsense,,  ,short:phone')).toEqual([]);
  });

  it('is empty for unset config, which denies everyone', () => {
    expect(parseAllowlist(undefined)).toEqual([]);
  });
});

describe('bearerFrom', () => {
  it('accepts the standard header', () => {
    expect(bearerFrom('Bearer abc123')).toEqual('abc123');
  });

  it('is case-insensitive about the scheme', () => {
    expect(bearerFrom('bearer abc123')).toEqual('abc123');
  });

  it('rejects a bare token with no scheme', () => {
    expect(bearerFrom('abc123')).toBeNull();
  });

  it('rejects a missing header', () => {
    expect(bearerFrom(undefined)).toBeNull();
  });
});

describe('authenticate', () => {
  const minted = mintToken();
  const allowlist = parseAllowlist(`${minted.hash}:daniel-phone`);

  it('names the device for a valid token', () => {
    expect(authenticate(`Bearer ${minted.token}`, allowlist)).toEqual('daniel-phone');
  });

  it('rejects a token that is not on the list', () => {
    expect(authenticate(`Bearer ${mintToken().token}`, allowlist)).toBeNull();
  });

  it('rejects a missing header', () => {
    expect(authenticate(undefined, allowlist)).toBeNull();
  });

  // The failure mode that matters: an empty allowlist must deny, never allow.
  it('denies everyone when the allowlist is empty', () => {
    expect(authenticate(`Bearer ${minted.token}`, [])).toBeNull();
  });

  it('rejects the hash itself being presented as the token', () => {
    expect(authenticate(`Bearer ${minted.hash}`, allowlist)).toBeNull();
  });
});

describe('mintToken', () => {
  it('produces a URL-safe token and its matching hash', () => {
    const {hash, token} = mintToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(authenticate(`Bearer ${token}`, parseAllowlist(`${hash}:x`))).toEqual('x');
  });

  it('does not repeat itself', () => {
    expect(mintToken().token).not.toEqual(mintToken().token);
  });
});
