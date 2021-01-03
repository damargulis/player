import React, {Component} from 'react';
import {Slider} from 'react-native';
import {StyleSheet, Text, View} from 'react-native';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
});

export default class Progress extends Component {
  onValueChange(value: number): void {
    this.props.sendMessage('setTime', value / 1000);
  }

  render(): JSX.Element {
    return (
      <View style={styles.container}>
        <Text>{this.props.currentTime}</Text>
        <Slider
          style={{flex: 1, height: 40}}
          minimumValue={0}
          maximumValue={this.props.duration}
          value={this.props.currentTime * 1000}
          onValueChange={this.onValueChange.bind(this)}
        />
        <Text>{this.props.duration}</Text>
      </View>
    );
  }
}
