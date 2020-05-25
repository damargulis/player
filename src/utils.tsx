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
