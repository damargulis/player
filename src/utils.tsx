import path from 'path';

/**
 * Formats a duration to a time "minutes:seconds".
 * Takes in time in milliseconds.
 */
export function toTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  let secondsString = `${seconds}`;
  if (seconds < 10) {
    secondsString = '0' + seconds;
  }
  return `${minutes}:${secondsString}`;
}

export function getImgSrc(fileName: string): string {
  return fileName ? new URL('file://' + path.resolve(fileName)).toString() : '';
}

export function setMemberIds(
  idOfThis: number,
  ids: number[],
  prevIds: number[],
  getter: (id: number) => number[]
): void {
  ids.forEach((id) => {
    if (!prevIds.includes(id)) {
      // prevIds does not include id, need to add to all others
      const other = getter(id);
      other.push(idOfThis);
    }
  });
  prevIds.forEach((id) => {
    if (!ids.includes(id)) {
      // new does not include id, need to remove it
      const other = getter(id);
      other.splice(other.indexOf(idOfThis), 1);
    }
  });
}
