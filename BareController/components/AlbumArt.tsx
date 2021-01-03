import React, {Component} from 'react';
import {StyleSheet, Text, Image, View} from 'react-native';

const styles = StyleSheet.create({
  albumCover: {
    flex: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: 200,
    height: 200,
  },
});

export default class AlbumArt extends React.Component {

  render(): JSX.Element {
    return (
      <View style={styles.albumCover}>
        <Image
          style={styles.image}
          source={{
            uri: this.props.artFile,
          }}
        />
      </View>
    );
  }
}
