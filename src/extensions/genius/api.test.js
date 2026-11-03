import {clearRateLimit, describeWait, isRateLimited} from './api';

beforeEach(() => clearRateLimit());

describe('describeWait', () => {
  // Genius answers a 429 with Retry-After in thousands of seconds; "3506 seconds" is not a
  // useful thing to show someone.
  it('reads short waits in seconds', () => {
    expect(describeWait(30)).toEqual('30 seconds');
  });

  it('reads an hour-ish wait in minutes', () => {
    expect(describeWait(3506)).toEqual('58 minutes');
  });

  it('reads a long wait in hours', () => {
    expect(describeWait(7200)).toEqual('2.0 hours');
  });

  it('rounds up a fractional second rather than saying 0', () => {
    expect(describeWait(0.4)).toEqual('1 seconds');
  });
});

describe('rate limit state', () => {
  it('starts clear', () => {
    expect(isRateLimited()).toBe(false);
  });

  // A limit recorded in one run has usually expired by the next, so a fresh run resets it
  // rather than refusing to start.
  it('clears so a later run can try again', () => {
    clearRateLimit();
    expect(isRateLimited()).toBe(false);
  });
});
