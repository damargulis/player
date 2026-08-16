import React, {Component} from 'react';
import {Slider} from 'react-native';
import {StyleSheet, Text, View} from 'react-native';

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  time: {
    fontVariant: ['tabular-nums'],
    width: 45,
    textAlign: 'center',
  },
});

function toTime(seconds: number): string {
  if (!seconds && seconds !== 0) {
    return '-:--';
  }
  const total = Math.max(0, Math.round(seconds));
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

export default class Progress extends Component {
  constructor(props) {
    super(props);
    this.state = {
      dragging: false,
      dragValue: 0,
    };
  }

  onValueChange(value: number): void {
    // only track locally while dragging; the seek is sent on release
    this.setState({dragging: true, dragValue: value});
  }

  onSlidingComplete(value: number): void {
    this.props.sendMessage('setTime', value / 1000);
    // hold the thumb briefly so a stale broadcast doesn't snap it back
    setTimeout(() => this.setState({dragging: false}), 800);
  }

  render(): JSX.Element {
    const positionMs = this.state.dragging ? this.state.dragValue : this.props.currentTime * 1000;
    return (
      <View style={styles.container}>
        <Text style={styles.time}>{toTime(positionMs / 1000)}</Text>
        <Slider
          style={{flex: 1, height: 40}}
          minimumValue={0}
          maximumValue={this.props.duration}
          value={this.state.dragging ? undefined : this.props.currentTime * 1000}
          onValueChange={this.onValueChange.bind(this)}
          onSlidingComplete={this.onSlidingComplete.bind(this)}
        />
        <Text style={styles.time}>{toTime(this.props.duration / 1000)}</Text>
      </View>
    );
  }
}
