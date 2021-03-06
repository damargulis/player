import React, {Component} from 'react';
import {StyleSheet, Text, View} from 'react-native';

const styles = StyleSheet.create({
  info: {
    flex: 1,
    alignItems: 'center',
  },
});

export default class Info extends Component {
  render(): JSX.Element {
    return (
      <View style={styles.info}>
        <Text>{this.props.track.name}</Text>
        <Text>{this.props.track.year}</Text>
        <Text>{this.props.artists.map((a) => a.name).join(', ')}</Text>
        <Text>{this.props.albums.map((a) => a.name).join(', ')}</Text>
      </View>
    );
  }
}
