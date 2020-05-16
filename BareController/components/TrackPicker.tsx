import React from 'react';
import {FlatList, StyleSheet, Text, TouchableHighlight, View } from 'react-native';
import TrackPlayer from 'react-native-track-player';

export default class TrackPicker extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      shuffling: false,
    }

  }

  shuffle(): void {
    this.setState({shuffling: true});
    const trackIds = this.props.route.params.playlist.trackIds;
    let trackId = null;
    while (!this.props.tracks[trackId]) {
      trackId = trackIds[Math.floor(Math.random() * trackIds.length)];
    }
    this.playTrack(trackId);
  }

  async play(trackId): void {
    this.setState({shuffling: false});
    await this.playTrack(trackId);
  }

  async playTrack(trackId) {
    console.log("Play Track");
    await TrackPlayer.setupPlayer();
    const options = {
      capabilities: [
        TrackPlayer.CAPABILITY_PLAY,
        TrackPlayer.CAPABILITY_PAUSE,
        TrackPlayer.CAPABILITY_STOP,
        TrackPlayer.CAPABILITY_SKIP_TO_NEXT,
        TrackPlayer.CAPABILITY_SKIP_TO_PREVIOUS,
      ],

      compactCapabilities: [
        TrackPlayer.CAPABILITY_PLAY,
        TrackPlayer.CAPABILITY_PAUSE,
      ],

    }
    await TrackPlayer.updateOptions(options);
    const track = this.props.tracks[trackId];
    const playerData = {
      id: track.id,
      url: track.filePath,
      title: track.name,
    }
    console.log("Adding");
    await TrackPlayer.add([playerData]);
    console.log("playing");
    await TrackPlayer.play();
  }

  render() {
    return (
      <View>
        <Text>{this.props.route.params.playlist.name}</Text>
        <TouchableHighlight onPress={this.shuffle.bind(this)}>
          <Text>Shuffle</Text>
        </TouchableHighlight>
        <FlatList
          data={this.props.route.params.playlist.trackIds}
          renderItem={({item}) => {
            const track = this.props.tracks[item];
            if (!track) {
              return null;
            }
            return (
              <TouchableHighlight onPress={() => this.play(item)}>
                <Text>{track.name}</Text>
              </TouchableHighlight>
            );
          }}
          keyExtractor={trackId => trackId}
        />
      </View>
    )
  }
}
