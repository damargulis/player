
function toTime(ms) {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60);
  let seconds = totalSeconds % 60;
  if (seconds < 10) {
    seconds = '0' + seconds;
  }
  return `${minutes}:${seconds}`;
}

export default {
  toTime,
}
