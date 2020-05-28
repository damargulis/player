import path from 'path';

function capitalize(word: string): string {
  if (word === 'and') {
    return word;
  }
  return word.charAt(0).toUpperCase() + word.slice(1);
}

export function formatGenre(genre: string): string {
  const genreString = genre.trim().split(' ').map(
    (word) => capitalize(word)).join(' ');
  return genreString.split('-').map((word) => capitalize(word)).join('-');
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
  const minutesString = (hours && minutes < 10) ? `0${minutes}` : minutes;
  return `${hours ? hours + ':' : ''}${minutesString}:${secondsString}`;
}
