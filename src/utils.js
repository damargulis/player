
function toTime(ms) {
  const total_seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(total_seconds / 60);
  let seconds = total_seconds % 60;
  if (seconds < 10) {
    seconds = '0' + seconds;
  }
  return `${minutes}:${seconds}`;
}

export default {
  toTime,
}
