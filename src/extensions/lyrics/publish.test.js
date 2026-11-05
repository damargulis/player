import {hashAttempt, meetsTarget, solveChallenge} from './publish';
import crypto from 'crypto';

/**
 * The publish token is a proof of work: SHA-256 of the prefix concatenated with the nonce's
 * decimal string, accepted when the digest is <= the target as unsigned big-endian bytes.
 * That rule comes from LRCGET's `challenge_solver.rs`, which LRCLIB's own docs name as the
 * reference implementation, so these tests pin it rather than the server's say-so.
 */
describe('meetsTarget', () => {
  const buf = (hex) => Buffer.from(hex, 'hex');
  const pad = (hex) => buf(hex.padEnd(64, '0'));

  it('accepts a digest below the target', () => {
    expect(meetsTarget(pad('00ff'), pad('0100'))).toEqual(true);
  });

  it('rejects a digest above the target', () => {
    expect(meetsTarget(pad('0100'), pad('00ff'))).toEqual(false);
  });

  it('accepts an exact match, since the rule is <= not <', () => {
    expect(meetsTarget(pad('00ff'), pad('00ff'))).toEqual(true);
  });

  it('compares left to right, so a later byte cannot rescue an earlier one', () => {
    // second byte is smaller, but the first is already larger
    expect(meetsTarget(pad('0200'), pad('01ff'))).toEqual(false);
  });

  it('rejects a length mismatch rather than guessing', () => {
    expect(meetsTarget(buf('00ff'), pad('00ff'))).toEqual(false);
  });
});

describe('hashAttempt', () => {
  it('hashes the prefix and the nonce with no separator', () => {
    const expected = crypto.createHash('sha256').update('abc42').digest();
    expect(hashAttempt('abc', 42).equals(expected)).toEqual(true);
  });
});

describe('solveChallenge', () => {
  /** An easy target so the test is fast; the rule exercised is the same one. */
  it('finds a nonce whose digest meets the target', async () => {
    const challenge = {prefix: 'mymusic-test', target: '0f'.padEnd(64, 'f')};
    const nonce = await solveChallenge(challenge);
    expect(typeof nonce).toEqual('string');
    const digest = hashAttempt(challenge.prefix, Number(nonce));
    expect(meetsTarget(digest, Buffer.from(challenge.target, 'hex'))).toEqual(true);
  });

  it('returns the first nonce that works, counting from zero', async () => {
    const challenge = {prefix: 'mymusic-test', target: '0f'.padEnd(64, 'f')};
    const nonce = Number(await solveChallenge(challenge));
    const target = Buffer.from(challenge.target, 'hex');
    for (let earlier = 0; earlier < nonce; earlier++) {
      expect(meetsTarget(hashAttempt(challenge.prefix, earlier), target)).toEqual(false);
    }
  });

  it('refuses a target that is not a 32-byte hash', async () => {
    await expect(solveChallenge({prefix: 'x', target: 'abcd'})).rejects.toThrow('32-byte');
  });
});
