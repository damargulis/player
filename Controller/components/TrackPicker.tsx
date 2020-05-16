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
    console.log("playing");
    const track = this.props.tracks[trackId];
    const playerData = {
      id: track.id,
      url: track.filePath,
      title: track.title,
    }
    console.log("adding");
    TrackPlayer.add([track]).then(() => {
      console.log("added");
      TrackPlayer.play().then(() => {
        console.log("playing");
      });
    });
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
