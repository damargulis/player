import React, {Component} from 'react';
import {TouchableHighlight, Image, StyleSheet, Text, View} from 'react-native';
import nextAlbumImg from '../assets/next_album.png';
import nextTrackImg from '../assets/next_track.png';
import pauseButton from '../assets/pause.png';
import playButton from '../assets/play.png';
import prevAlbumImg from '../assets/previous_album.png';
import prevTrackImg from '../assets/previous_track.png';

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
    this.props.sendMessage('action', 'prevAlbum');
  }

  prevTrack() {
    this.props.sendMessage('action', 'prevTrack');
  }

  playPause() {
    this.props.sendMessage('action', 'playTrack');
  }

  nextTrack() {
    this.props.sendMessage('action', 'nextTrack');
  }

  nextAlbum() {
    this.props.sendMessage('action', 'nextAlbum');
  }

  render() {
    // share images with other??
    return (
      <View style={styles.container}>
        <View style={styles.button}>
          <TouchableHighlight underlayColor="white" onPress={this.prevAlbum.bind(this)}>
            <Image style={styles.buttonImage} source={prevAlbumImg} />
          </TouchableHighlight>
        </View>
        <View style={styles.button}>
          <TouchableHighlight underlayColor="white" onPress={this.prevTrack.bind(this)}>
            <Image style={styles.buttonImage} source={prevTrackImg} />
          </TouchableHighlight>
        </View>
        <View style={styles.button}>
          <TouchableHighlight underlayColor="white" onPress={this.playPause.bind(this)}>
            <Image style={styles.buttonImage} source={this.props.paused ? playButton : pauseButton} />
          </TouchableHighlight>
        </View>
        <View style={styles.button}>
          <TouchableHighlight underlayColor="white" onPress={this.nextTrack.bind(this)}>
            <Image style={styles.buttonImage} source={nextTrackImg} />
          </TouchableHighlight>
        </View>
        <View style={styles.button}>
          <TouchableHighlight underlayColor="white" onPress={this.nextAlbum.bind(this)}>
            <Image style={styles.buttonImage} source={nextAlbumImg} />
          </TouchableHighlight>
        </View>
      </View>
    );
  }
}
