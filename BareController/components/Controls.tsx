import favoriteImg from '../assets/favorite.png';
import nextAlbumImg from '../assets/next_album.png';
import nextTrackImg from '../assets/next_track.png';
import pauseButton from '../assets/pause.png';
import playButton from '../assets/play.png';
import prevAlbumImg from '../assets/previous_album.png';
import prevTrackImg from '../assets/previous_track.png';
import React, {Component} from 'react';
import {Image, StyleSheet, Text, TouchableHighlight, View} from 'react-native';

const styles = StyleSheet.create({
  container: {
    height: 100,
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  button: {
    flex: 1,
    height: 80,
    width: 80,
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 10,
    margin: 2,
  },
  buttonImage: {
    width: 60,
    height: 60,
  },
  fadeButton: {
    width: 60,
    height: 60,
    opacity: .5,
  },
});

export default class Controls extends Component {
  prevAlbum(): void {
    this.props.sendMessage('prevAlbum');
  }

  prevTrack(): void {
    this.props.sendMessage('prevTrack');
  }

  playPause(): void {
    this.props.sendMessage('playTrack');
  }

  nextTrack(): void {
    this.props.sendMessage('nextTrack');
  }

  nextAlbum(): void {
    this.props.sendMessage('nextAlbum');
  }

  favoriteTrack(): void {
    this.props.sendMessage('favoriteTrack');
  }

  render(): JSX.Element {
    // TODO: share images with other
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
        <View style={styles.button}>
          <TouchableHighlight underlayColor="white" onPress={this.favoriteTrack.bind(this)}>
            <Image style={this.props.isFavorite ? styles.buttonImage : styles.fadeButton} source={favoriteImg} />
          </TouchableHighlight>
        </View>
      </View>
    );
  }
}
