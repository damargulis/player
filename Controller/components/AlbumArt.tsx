import React, {Component} from 'react';
import {StyleSheet, Text, View} from 'react-native';

const styles = StyleSheet.create({
  albumCover: {
    flex: 5,
    backgroundColor: 'green',
  },
  text: {
    fontSize: 32,
  },
});

export default class AlbumArt extends React.Component {

  render(): JSX.Element {
    return (
        <View style={styles.albumCover}><Text style={styles.text}>{this.props.artFile}</Text></View>
    );
  }
}
