import TrackPlayer from 'react-native-track-player';
import {AsyncStorage} from 'react-native';

/*
 * @type {!Object<TrackId, Array<duration>>}
 */
let plays = {};

AsyncStorage.getItem('storedPlays').then((storedPlays) => {
  plays = storedPlays ? JSON.parse(storedPlays) : {};
});

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
      AsyncStorage.setItem('storedPlays', JSON.stringify(plays));
    }
  });
}
