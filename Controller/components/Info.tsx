import React, {Component} from 'react';
import {StyleSheet, Text, View} from 'react-native';

const styles = StyleSheet.create({
  info: {
    flex: 1,
    backgroundColor: 'blue',
  },
});

export default class Info extends Component {
  render(): JSX.Element {
    return (
      <View style={styles.info}>
        <Text>{this.props.track.name}</Text>
        <Text>{this.props.track.year}</Text>
      </View>
    );
  }
}
