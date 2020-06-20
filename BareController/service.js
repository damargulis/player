import TrackPlayer from 'react-native-track-player';

/*
 * @type {!Object<TrackId, Array<duration>>}
 */
let plays = {};

exports.getPlays = function() {
  return plays;
}

exports.clearPlays = function() {
  plays = {};
}

exports.service = async function() {
  TrackPlayer.addEventListener('remote-play', () => TrackPlayer.play());
  TrackPlayer.addEventListener('remote-pause', () => TrackPlayer.pause());
  TrackPlayer.addEventListener('remote-stop', () => TrackPlayer.destroy());
  TrackPlayer.addEventListener('remote-next', () => TrackPlayer.skipToNext());
  TrackPlayer.addEventListener('remote-previous', () => TrackPlayer.skipToPrevious());
  TrackPlayer.addEventListener('playback-track-changed', (data) => {
    if (data.track !== null) {
      if (plays[data.track]) {
        plays[data.track].push(data.position);
      } else {
        plays[data.track] = [data.position];
      }
    }
  });
}
