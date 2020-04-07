import React, {Component} from 'react';
import {TouchableHighlight, Image, StyleSheet, Text, View} from 'react-native';

const styles = StyleSheet.create({
  container: {
    height: 100,
    flexDirection: 'row',
    backgroundColor: 'orange',
    alignItems: 'stretch',
  },
  button: {
    flex: 1,
    height: 100,
    justifyContent: 'center',
  },
  buttonImage: {
    width: 50,
    height: 50,
  }
});

export default class Controls extends Component {
  prevAlbum() {
    alert('Prev Album');
  }

  prevSong() {
    alert('Prev Song');
  }

  playPause() {
    alert('Play Pause');
  }

  nextSong() {
    alert('Next Song');
  }

  nextAlbum() {
    alert('Next Album');
  }

  render() {
    // share images with other??
    return (
      <View style={styles.container}>
        <View style={styles.button}>
          <TouchableHighlight underlayColor="white" onPress={this.prevAlbum}>
            <Image style={styles.buttonImage} source={require('../assets/previous_album.png')} />
          </TouchableHighlight>
        </View>
        <View style={styles.button}>
          <TouchableHighlight underlayColor="white" onPress={this.prevSong}>
            <Image style={styles.buttonImage} source={require('../assets/previous_track.png')} />
          </TouchableHighlight>
        </View>
        <View style={styles.button}>
          <TouchableHighlight underlayColor="white" onPress={this.playPause}>
            <Image style={styles.buttonImage} source={require('../assets/play.png')} />
          </TouchableHighlight>
        </View>
        <View style={styles.button}>
          <TouchableHighlight underlayColor="white" onPress={this.nextSong}>
            <Image style={styles.buttonImage} source={require('../assets/next_track.png')} />
          </TouchableHighlight>
        </View>
        <View style={styles.button}>
          <TouchableHighlight underlayColor="white" onPress={this.nextAlbum}>
            <Image style={styles.buttonImage} source={require('../assets/next_album.png')} />
          </TouchableHighlight>
        </View>
      </View>
    );
  }
}
