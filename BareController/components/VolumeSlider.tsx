import volumeHighImg from '../assets/volume_high.png';
import volumeLowImg from '../assets/volume_low.png';
import {COLORS} from './theme';
import React, {Component} from 'react';
import {Slider} from 'react-native';
import {Image, StyleSheet, View} from 'react-native';

const LIVE_UPDATE_MS = 150;

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  icon: {
    width: 18,
    height: 18,
    tintColor: COLORS.textSecondary,
  },
  slider: {
    flex: 1,
    height: 36,
    marginHorizontal: 6,
  },
});

export default class VolumeSlider extends Component {
  constructor(props) {
    super(props);
    this.state = {
      dragging: false,
    };
    this.lastSent = 0;
  }

  onValueChange(value: number): void {
    this.setState({dragging: true});
    // throttled live updates so the desktop volume follows the drag
    const now = Date.now();
    if (now - this.lastSent > LIVE_UPDATE_MS) {
      this.lastSent = now;
      this.props.sendMessage('setVolume', value);
    }
  }

  onSlidingComplete(value: number): void {
    this.props.sendMessage('setVolume', value);
    setTimeout(() => this.setState({dragging: false}), 800);
  }

  render(): JSX.Element {
    return (
      <View style={styles.container}>
        <Image style={styles.icon} source={volumeLowImg} />
        <Slider
          style={styles.slider}
          minimumValue={0}
          maximumValue={1}
          minimumTrackTintColor={COLORS.accent}
          maximumTrackTintColor={COLORS.border}
          thumbTintColor={COLORS.text}
          value={this.state.dragging ? undefined : this.props.volume}
          onValueChange={this.onValueChange.bind(this)}
          onSlidingComplete={this.onSlidingComplete.bind(this)}
        />
        <Image style={styles.icon} source={volumeHighImg} />
      </View>
    );
  }
}
