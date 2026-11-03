import {isSynced, parseLyrics} from './store';

describe('parseLyrics', () => {
  it('reads [mm:ss.xx] timestamps', () => {
    const lines = parseLyrics('[00:12.50]First line\n[01:05.00]Second line');
    expect(lines.map((l) => l.text)).toStrictEqual(['First line', 'Second line']);
    expect(lines[0].at).toEqual(12500);
    expect(lines[1].at).toEqual(65000);
  });

  // LRC in the wild uses a colon before the fraction as often as a dot.
  it('reads [mm:ss:xx] with a colon before the fraction', () => {
    expect(parseLyrics('[00:30:25]Line')[0].at).toEqual(30250);
  });

  it('reads three-digit fractions', () => {
    expect(parseLyrics('[00:01.500]Line')[0].at).toEqual(1500);
  });

  it('pads a two-digit fraction as hundredths, not thousandths', () => {
    expect(parseLyrics('[00:00.05]Line')[0].at).toEqual(50);
  });

  it('handles timestamps past ten minutes', () => {
    expect(parseLyrics('[12:34.00]Line')[0].at).toEqual(754000);
  });

  it('treats plain text as unsynced lines', () => {
    const lines = parseLyrics('Just a line\nAnd another');
    expect(lines.map((l) => l.at)).toStrictEqual([undefined, undefined]);
    expect(lines).toHaveLength(2);
  });

  // [ar:...] / [ti:...] headers are file metadata, not words to display.
  it('drops LRC metadata tags', () => {
    const lines = parseLyrics('[ar:Some Artist]\n[ti:Some Song]\n[00:01.00]Real line');
    expect(lines.map((l) => l.text)).toStrictEqual(['Real line']);
  });

  it('keeps interior blank lines, which are deliberate spacing', () => {
    expect(parseLyrics('[00:01.00]A\n[00:02.00]\n[00:03.00]B')).toHaveLength(3);
  });

  it('trims trailing blank lines', () => {
    expect(parseLyrics('A line\n\n\n')).toStrictEqual([{text: 'A line'}]);
  });

  it('survives an empty file', () => {
    expect(parseLyrics('')).toStrictEqual([]);
  });

  it('handles CRLF line endings', () => {
    expect(parseLyrics('[00:01.00]A\r\n[00:02.00]B')).toHaveLength(2);
  });
});

describe('isSynced', () => {
  // This is what decides a solid L from a dimmed one.
  it('is true when any line carries a timestamp', () => {
    expect(isSynced('[00:01.00]Line')).toBe(true);
  });

  it('is false for plain text', () => {
    expect(isSynced('Line one\nLine two')).toBe(false);
  });

  it('is false for a file of metadata only', () => {
    expect(isSynced('[ar:Artist]\n[ti:Title]')).toBe(false);
  });
});
