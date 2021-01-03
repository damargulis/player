import TrackPlayer from 'react-native-track-player';
import {AsyncStorage} from 'react-native';

/*
 * storedPlays = {!Object<TrackId, Array<stopped playing at time>>}
 */

exports.service = async function() {
  TrackPlayer.addEventListener('remote-play', () => TrackPlayer.play());
  TrackPlayer.addEventListener('remote-pause', () => TrackPlayer.pause());
  TrackPlayer.addEventListener('remote-stop', () => TrackPlayer.destroy());
  TrackPlayer.addEventListener('remote-next', () => TrackPlayer.skipToNext());
  TrackPlayer.addEventListener('remote-previous', () =>
    TrackPlayer.skipToPrevious(),
  );
  TrackPlayer.addEventListener('playback-track-changed', data => {
    if (data.track !== null) {
      AsyncStorage.getItem('storedPlays').then(storedPlays => {
        const plays = storedPlays ? JSON.parse(storedPlays) : {};
        if (plays[data.track]) {
          plays[data.track].push(data.position);
        } else {
          plays[data.track] = [data.position];
        }
        AsyncStorage.setItem('storedPlays', JSON.stringify(plays));
      });
    }
  });
};
