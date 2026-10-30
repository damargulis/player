import {clockTime} from '../utils';

describe('clockTime', () => {
  it('renders hour and minute for a real instant', () => {
    // Built from local parts so the expectation holds in any timezone.
    const at = new Date(2026, 9, 30, 21, 22).getTime();
    const shown = clockTime(at);
    expect(shown).toContain('22');
    expect(shown.length).toBeGreaterThan(3);
  });

  it('never shows seconds — they are noise in a conversation', () => {
    const at = new Date(2026, 9, 30, 21, 22, 45).getTime();
    expect(clockTime(at)).not.toContain('45');
  });

  // Entries from before this shipped, and the status lines the DJ emits, carry no timestamp.
  // Those must render as nothing rather than "Dec 31 1969".
  it('is empty for a missing timestamp', () => {
    expect(clockTime(undefined)).toEqual('');
    expect(clockTime(0)).toEqual('');
  });

  it('agrees with itself for the same instant', () => {
    const at = Date.now();
    expect(clockTime(at)).toEqual(clockTime(at));
  });
});
