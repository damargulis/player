import React from 'react';
import {FlatList, StyleSheet, Text, TouchableHighlight, View } from 'react-native';
import TrackPlayer from 'react-native-track-player';

function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i+1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export default class TrackPicker extends React.Component {
  constructor(props) {
    super(props);

  }

  async shuffle(): void {
    const trackIds = shuffleArray(this.props.route.params.playlist.trackIds.slice());

    const hasTrack = trackIds.filter((id) => this.props.tracks[id]);

    const data = hasTrack.map((id) => {
      const track = this.props.tracks[id];
      return {
        id: track.id,
        url: track.filePath,
        title: track.name,
      }
    });
    await TrackPlayer.setupPlayer();
    await TrackPlayer.reset();
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
    await TrackPlayer.add(data);
    console.log("playing");
    await TrackPlayer.play();
  }

  async playTrack(trackId) {
    console.log("Play Track");
    await TrackPlayer.setupPlayer();
    await TrackPlayer.reset();
    const options = {
      capabilities: [
        TrackPlayer.CAPABILITY_PLAY,
        TrackPlayer.CAPABILITY_PAUSE,
        TrackPlayer.CAPABILITY_STOP,
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
              <TouchableHighlight onPress={() => this.playTrack(item)}>
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
