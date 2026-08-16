import React, {Component} from 'react';
import {Slider} from 'react-native';
import {StyleSheet, Text, View} from 'react-native';

const LIVE_UPDATE_MS = 150;

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  label: {
    width: 45,
    textAlign: 'center',
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
        <Text style={styles.label}>Vol</Text>
        <Slider
          style={{flex: 1, height: 40}}
          minimumValue={0}
          maximumValue={1}
          value={this.state.dragging ? undefined : this.props.volume}
          onValueChange={this.onValueChange.bind(this)}
          onSlidingComplete={this.onSlidingComplete.bind(this)}
        />
        <Text style={styles.label} />
      </View>
    );
  }
}
