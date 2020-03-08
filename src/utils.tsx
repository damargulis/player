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
  const minutesString = (hours && minutes < 10) ? `0${minutes}` : minutes;
  return `${hours ? hours + ':' : ''}${minutesString}:${secondsString}`;
}

export function getImgSrc(fileName: string): string {
  return fileName ? new URL('file://' + path.resolve(fileName)).toString() : '';
}
