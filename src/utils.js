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

/**
 * Turns a file path into a URL object that can be used as a src attr in an img
 * tag.
 * @param {string} fileName The relative path to the file.
 * @return {!URL} A URL object pointing to the file.
 */
export function getImgSrc(fileName) {
  return fileName ? new URL('file://' + path.resolve(fileName)) : null;
}
