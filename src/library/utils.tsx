import path from 'path';

/**
 * Returns the file path levels up from the path given.
 */
export function upLevels(filePath: string, levels: number = 1): string {
  const parts = filePath.split(path.sep);
  const newparts = parts.slice(0, -1 * levels);
  return path.join(...newparts);
}

/**
 * combines into unique array
 * returns new, doesn't modify either
 */
export function combineArray<T>(arr1: T[], arr2: T[]): T[] {
  return [...(new Set([...arr1, ...arr2]))];
}
