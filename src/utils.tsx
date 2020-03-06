import path from 'path';

/**
 * Formats a duration to a time "minutes:seconds".
 * Takes in time in milliseconds.
 */
export function toTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / (60 * 60));
  const minutes = (Math.floor(totalSeconds / 60)) % 60;
  const seconds = totalSeconds % 60;
  let secondsString = `${seconds}`;
  if (seconds < 10) {
    secondsString = '0' + seconds;
  }
  return `${hours ? hours + ':' : ''}${minutes ? minutes : '00'}:${secondsString}`;
}

export function getImgSrc(fileName: string): string {
  return fileName ? new URL('file://' + path.resolve(fileName)).toString() : '';
}

interface Nameable {
  name: string;
}

export function inverse<T extends Nameable>(record: Record<string, T>): Record<string, string> {
  const ret = {} as Record<string, string>;
  Object.keys(record).forEach((key) => {
    const newKey = record[key];
    ret[newKey.name] = key;
  });
  return ret;
}
