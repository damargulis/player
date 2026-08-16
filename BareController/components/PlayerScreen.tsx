import defaultAlbumArt from '../assets/missing_album.png';
import nextTrackImg from '../assets/next_track.png';
import pauseImg from '../assets/pause.png';
import playImg from '../assets/play.png';
import prevTrackImg from '../assets/previous_track.png';
import repeatImg from '../assets/repeat.png';
import shuffleImg from '../assets/shuffle.png';
import {isRepeatEnabled, setRepeatEnabled, shuffleUpcoming} from './playback';
import {toTime} from './Progress';
import {COLORS, SPACING} from './theme';
import React from 'react';
import {Slider} from 'react-native';
import {Dimensions, FlatList, Image, StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import TrackPlayer from 'react-native-track-player';

const ART_SIZE = Math.min(Dimensions.get('window').width * 0.55, 260);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: COLORS.textSecondary,
    fontSize: 16,
  },
  header: {
    alignItems: 'center',
    paddingHorizontal: SPACING.screen,
    paddingTop: 18,
  },
  artWrap: {
    borderRadius: 14,
    backgroundColor: COLORS.surface,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 10},
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 14,
  },
  art: {
    width: ART_SIZE,
    height: ART_SIZE,
    borderRadius: 14,
  },
  title: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: '700',
    marginTop: 16,
    textAlign: 'center',
  },
  artist: {
    color: COLORS.textSecondary,
    fontSize: 15,
    marginTop: 4,
    textAlign: 'center',
  },
  seekRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    marginTop: 6,
  },
  time: {
    fontVariant: ['tabular-nums'],
    color: COLORS.textSecondary,
    fontSize: 12,
    width: 44,
    textAlign: 'center',
  },
  slider: {
    flex: 1,
    height: 36,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
    paddingBottom: 8,
  },
  modeButton: {
    padding: 10,
    marginHorizontal: 8,
  },
  modeIcon: {
    width: 22,
    height: 22,
    tintColor: COLORS.textSecondary,
  },
  modeIconActive: {
    width: 22,
    height: 22,
    tintColor: COLORS.accent,
  },
  trackButton: {
    padding: 10,
    marginHorizontal: 6,
  },
  trackIcon: {
    width: 30,
    height: 30,
    tintColor: COLORS.text,
  },
  playButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 10,
  },
  playIcon: {
    width: 26,
    height: 26,
    tintColor: '#FFFFFF',
    marginLeft: 2,
  },
  pauseIcon: {
    width: 26,
    height: 26,
    tintColor: '#FFFFFF',
  },
  upNextLabel: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 2,
    marginTop: 10,
    marginBottom: 4,
    marginLeft: SPACING.screen,
    alignSelf: 'flex-start',
  },
  upNextRow: {
    paddingVertical: 10,
    paddingHorizontal: SPACING.screen,
  },
  upNextName: {
    color: COLORS.text,
    fontSize: 15,
  },
  upNextArtist: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 1,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: COLORS.border,
    marginLeft: SPACING.screen,
  },
});

/**
 * Full-screen local player: art, seek bar, transport, shuffle/repeat, and the
 * upcoming queue. Extends ProgressComponent for auto-updating position state.
 */
export default class PlayerScreen extends TrackPlayer.ProgressComponent {
  constructor(props) {
    super(props);
    this.state = {
      ...this.state,
      currentTrack: null,
      queue: [],
      playerState: null,
      repeat: isRepeatEnabled(),
      dragging: false,
      dragValue: 0,
    };
  }

  componentDidMount(): void {
    super.componentDidMount();
    this.stateSub = TrackPlayer.addEventListener('playback-state', ({state}) => {
      this.setState({playerState: state});
    });
    this.trackSub = TrackPlayer.addEventListener('playback-track-changed', () => {
      this.refreshQueue();
    });
    this.refreshQueue();
    TrackPlayer.getState()
      .then((state) => this.setState({playerState: state}))
      .catch(() => {});
  }

  componentWillUnmount(): void {
    super.componentWillUnmount();
    this.stateSub.remove();
    this.trackSub.remove();
  }

  refreshQueue(): void {
    Promise.all([TrackPlayer.getCurrentTrack(), TrackPlayer.getQueue()])
      .then(([currentId, queue]) => {
        const currentTrack = queue.find((t) => t.id === currentId) || null;
        this.setState({currentTrack, queue});
      })
      .catch(() => {});
  }

  togglePlayback(): void {
    if (this.state.playerState === TrackPlayer.STATE_PLAYING) {
      TrackPlayer.pause();
    } else {
      TrackPlayer.play();
    }
  }

  toggleRepeat(): void {
    const repeat = !this.state.repeat;
    setRepeatEnabled(repeat);
    this.setState({repeat});
  }

  shuffle(): void {
    shuffleUpcoming().then(() => this.refreshQueue()).catch(() => {});
  }

  playFromQueue(trackId: string): void {
    TrackPlayer.skip(trackId).then(() => TrackPlayer.play()).catch(() => {});
  }

  onSeekChange(value: number): void {
    this.setState({dragging: true, dragValue: value});
  }

  onSeekComplete(value: number): void {
    TrackPlayer.seekTo(value);
    // hold the thumb briefly so the next poll doesn't snap it back
    setTimeout(() => this.setState({dragging: false}), 1200);
  }

  getUpcoming() {
    const index = this.state.queue.findIndex(
      (t) => this.state.currentTrack && t.id === this.state.currentTrack.id);
    return this.state.queue.slice(index + 1);
  }

  renderHeader(): JSX.Element {
    const track = this.state.currentTrack;
    const art = typeof track.artwork === 'string' ? {uri: track.artwork} : (track.artwork || defaultAlbumArt);
    const playing = this.state.playerState === TrackPlayer.STATE_PLAYING;
    const position = this.state.dragging ? this.state.dragValue : this.state.position;
    const upcoming = this.getUpcoming();
    return (
      <View style={styles.header}>
        <View style={styles.artWrap}>
          <Image style={styles.art} source={art} />
        </View>
        <Text style={styles.title} numberOfLines={2}>{track.title}</Text>
        <Text style={styles.artist} numberOfLines={1}>{track.artist}</Text>
        <View style={styles.seekRow}>
          <Text style={styles.time}>{toTime(position)}</Text>
          <Slider
            style={styles.slider}
            minimumValue={0}
            maximumValue={this.state.duration}
            minimumTrackTintColor={COLORS.accent}
            maximumTrackTintColor={COLORS.border}
            thumbTintColor={COLORS.text}
            value={this.state.dragging ? undefined : this.state.position}
            onValueChange={this.onSeekChange.bind(this)}
            onSlidingComplete={this.onSeekComplete.bind(this)}
          />
          <Text style={styles.time}>{toTime(this.state.duration)}</Text>
        </View>
        <View style={styles.controls}>
          <TouchableOpacity style={styles.modeButton} onPress={this.shuffle.bind(this)}>
            <Image style={styles.modeIcon} source={shuffleImg} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.trackButton}
            onPress={() => TrackPlayer.skipToPrevious().catch(() => {})}>
            <Image style={styles.trackIcon} source={prevTrackImg} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.playButton} onPress={this.togglePlayback.bind(this)}>
            <Image style={playing ? styles.pauseIcon : styles.playIcon} source={playing ? pauseImg : playImg} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.trackButton}
            onPress={() => TrackPlayer.skipToNext().catch(() => {})}>
            <Image style={styles.trackIcon} source={nextTrackImg} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.modeButton} onPress={this.toggleRepeat.bind(this)}>
            <Image style={this.state.repeat ? styles.modeIconActive : styles.modeIcon} source={repeatImg} />
          </TouchableOpacity>
        </View>
        {upcoming.length ? <Text style={styles.upNextLabel}>UP NEXT</Text> : null}
      </View>
    );
  }

  render(): JSX.Element {
    if (!this.state.currentTrack) {
      return (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>Nothing playing</Text>
        </View>
      );
    }
    return (
      <View style={styles.container}>
        <FlatList
          data={this.getUpcoming()}
          ListHeaderComponent={this.renderHeader()}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          renderItem={({item}) => (
            <TouchableOpacity style={styles.upNextRow} onPress={() => this.playFromQueue(item.id)}>
              <Text style={styles.upNextName} numberOfLines={1}>{item.title}</Text>
              <Text style={styles.upNextArtist} numberOfLines={1}>{item.artist}</Text>
            </TouchableOpacity>
          )}
          keyExtractor={(item) => item.id}
        />
      </View>
    );
  }
}
