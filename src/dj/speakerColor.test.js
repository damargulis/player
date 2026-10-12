import {SPEAKER_COLORS, speakerColor, speakerIndex, speakerTint} from './speakerColor';

test('a name always gets the same colour', () => {
  expect(speakerColor('Chloe')).toBe(speakerColor('Chloe'));
  // case and padding should not change it, so clients that normalise differently still agree
  expect(speakerColor('chloe')).toBe(speakerColor('  Chloe  '));
});

test('different names generally get different colours', () => {
  expect(speakerColor('Daniel')).not.toBe(speakerColor('Chloe'));
});

test('the index is always a valid, non-negative slot', () => {
  ['', 'a', 'Daniel', 'Chloe', 'zzzzzzzzzzzzzzzzzzzzzzzz', '✨ guest'].forEach((name) => {
    const i = speakerIndex(name);
    expect(i).toBeGreaterThanOrEqual(0);
    expect(i).toBeLessThan(SPEAKER_COLORS.length);
  });
});

test('tint is the same hue at low alpha', () => {
  expect(speakerTint('Chloe')).toMatch(/^rgba\(\d+, \d+, \d+, 0\.16\)$/);
});
