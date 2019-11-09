const path = require('path');

/**
 * Formats a duration to a time "minutes:seconds"
 * @param {number} ms Time in milliseconds.
 * @return {string} The formatted time
 */
export function toTime(ms) {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60);
  let seconds = totalSeconds % 60;
  if (seconds < 10) {
    seconds = '0' + seconds;
  }
  return `${minutes}:${seconds}`;
}

export function getImgSrc(fileName) {
  return fileName ? new URL('file://' + path.resolve(fileName)) : null;
}
