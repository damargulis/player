import nextAlbumImg from '../assets/next_album.png';
import nextTrackImg from '../assets/next_track.png';
import pauseButton from '../assets/pause.png';
import playButton from '../assets/play.png';
import prevAlbumImg from '../assets/previous_album.png';
import prevTrackImg from '../assets/previous_track.png';
import {COLORS} from './theme';
import React, {Component} from 'react';
import {Image, StyleSheet, TouchableOpacity, View} from 'react-native';

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 8,
  },
  albumIcon: {
    width: 26,
    height: 26,
    tintColor: COLORS.textSecondary,
  },
  trackIcon: {
    width: 32,
    height: 32,
    tintColor: COLORS.text,
  },
  sideButton: {
    padding: 10,
  },
  playButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.accent,
    shadowOffset: {width: 0, height: 6},
    shadowOpacity: 0.45,
    shadowRadius: 12,
    elevation: 8,
  },
  playIcon: {
    width: 32,
    height: 32,
    tintColor: '#FFFFFF',
    // the triangle reads better nudged toward center
    marginLeft: 3,
  },
  pauseIcon: {
    width: 32,
    height: 32,
    tintColor: '#FFFFFF',
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

  render(): JSX.Element {
    return (
      <View style={styles.container}>
        <TouchableOpacity style={styles.sideButton} onPress={this.prevAlbum.bind(this)}>
          <Image style={styles.albumIcon} source={prevAlbumImg} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.sideButton} onPress={this.prevTrack.bind(this)}>
          <Image style={styles.trackIcon} source={prevTrackImg} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.playButton} onPress={this.playPause.bind(this)}>
          <Image
            style={this.props.paused ? styles.playIcon : styles.pauseIcon}
            source={this.props.paused ? playButton : pauseButton}
          />
        </TouchableOpacity>
        <TouchableOpacity style={styles.sideButton} onPress={this.nextTrack.bind(this)}>
          <Image style={styles.trackIcon} source={nextTrackImg} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.sideButton} onPress={this.nextAlbum.bind(this)}>
          <Image style={styles.albumIcon} source={nextAlbumImg} />
        </TouchableOpacity>
      </View>
    );
  }
}
