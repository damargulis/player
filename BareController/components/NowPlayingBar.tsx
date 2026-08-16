import defaultAlbumArt from '../assets/missing_album.png';
import nextTrackImg from '../assets/next_track.png';
import pauseImg from '../assets/pause.png';
import playImg from '../assets/play.png';
import {COLORS, SPACING} from './theme';
import React from 'react';
import {Image, StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import TrackPlayer from 'react-native-track-player';

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderTopColor: COLORS.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingVertical: 10,
    paddingHorizontal: SPACING.card,
  },
  touchArea: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  art: {
    width: 40,
    height: 40,
    borderRadius: 5,
    marginRight: 12,
  },
  text: {
    flex: 1,
  },
  name: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '600',
  },
  artist: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 1,
  },
  button: {
    padding: 8,
  },
  icon: {
    width: 24,
    height: 24,
    tintColor: COLORS.text,
  },
});

/**
 * A slim bar showing local playback state, rendered above the tab area of the
 * library screens. Tapping the track info opens the full player via onOpen.
 */
export default class NowPlayingBar extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      track: null,
      playerState: null,
    };
  }

  componentDidMount(): void {
    this.stateSub = TrackPlayer.addEventListener('playback-state', ({state}) => {
      this.setState({playerState: state});
    });
    this.trackSub = TrackPlayer.addEventListener('playback-track-changed', () => {
      this.refreshTrack();
    });
    this.refreshTrack();
    TrackPlayer.getState()
      .then((state) => this.setState({playerState: state}))
      .catch(() => {});
  }

  componentWillUnmount(): void {
    this.stateSub.remove();
    this.trackSub.remove();
  }

  refreshTrack(): void {
    TrackPlayer.getCurrentTrack()
      .then((trackId) => trackId != null ? TrackPlayer.getTrack(trackId) : null)
      .then((track) => this.setState({track}))
      .catch(() => {});
  }

  togglePlayback(): void {
    if (this.state.playerState === TrackPlayer.STATE_PLAYING) {
      TrackPlayer.pause();
    } else {
      TrackPlayer.play();
    }
  }

  skipToNext(): void {
    TrackPlayer.skipToNext().catch(() => {});
  }

  render(): JSX.Element | null {
    const track = this.state.track;
    if (!track) {
      return null;
    }
    const art = typeof track.artwork === 'string' ? {uri: track.artwork} : (track.artwork || defaultAlbumArt);
    const playing = this.state.playerState === TrackPlayer.STATE_PLAYING;
    return (
      <View style={styles.bar}>
        <TouchableOpacity style={styles.touchArea} onPress={this.props.onOpen}>
          <Image style={styles.art} source={art} />
          <View style={styles.text}>
            <Text style={styles.name} numberOfLines={1}>{track.title}</Text>
            <Text style={styles.artist} numberOfLines={1}>{track.artist}</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity style={styles.button} onPress={this.togglePlayback.bind(this)}>
          <Image style={styles.icon} source={playing ? pauseImg : playImg} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.button} onPress={this.skipToNext.bind(this)}>
          <Image style={styles.icon} source={nextTrackImg} />
        </TouchableOpacity>
      </View>
    );
  }
}
