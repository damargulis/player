import React from 'react';
import {FlatList, StyleSheet, Text, TouchableHighlight, View } from 'react-native';
import TrackPlayer from 'react-native-track-player';
import defaultAlbumArt from '../assets/missing_album.png';

const styles = StyleSheet.create({
  name: {
    fontSize: 20,
  },
  artist: {
    fontSize: 12,
  },
});

function shuffleArray<T>(arr: T[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

export default class TrackPicker extends React.Component {

  playPlaylist(): void {
    this.playTracks(this.getTrackIds());
  }

  async playTracks(trackIds) {
    const hasTrack = trackIds.filter((id) => this.props.tracks[id]);

    const data = hasTrack.map((id) => {
      const track = this.props.tracks[id];
      const artists = track.artistIds.map((artistId) => {
        return this.props.artists[artistId].name;
      }).join(', ');
      const albums = track.albumIds.map((albumId) => {
        return this.props.albums[albumId].name;
      }).join(', ');
      const albumArt = this.props.albums[track.albumIds[0]].albumArtFile || defaultAlbumArt;
      return {
        id: track.id,
        url: track.filePath,
        title: track.name,
        artist: artists,
        album: albums,
        artwork: albumArt,
      };
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

    };
    await TrackPlayer.updateOptions(options);
    await TrackPlayer.add(data);
    await TrackPlayer.play();
  }

  shuffle(): void {
    const trackIds = this.getTrackIds();
    shuffleArray(trackIds);
    this.playTracks(trackIds);

  }

  async playTrack(trackId: string): void {
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

    };
    await TrackPlayer.updateOptions(options);
    const track = this.props.tracks[trackId];
    const artists = track.artistIds.map((artistId) => {
      return this.props.artists[artistId].name;
    }).join(', ');
    const albums = track.albumIds.map((albumId) => {
      return this.props.albums[albumId].name;
    }).join(', ');
    const albumArt = this.props.albums[track.albumIds[0]].albumArtFile;
    const playerData = {
      id: track.id,
      url: track.filePath,
      title: track.name,
      artist: artists,
      album: albums,
      artwork: albumArt,
    };
    await TrackPlayer.add([playerData]);
    await TrackPlayer.play();
  }

  getTrackIds(): string[] {
    const trackIds = this.props.route.params ?
      this.props.route.params.playlist.trackIds.slice() : Object.keys(this.props.tracks);
    return trackIds;
  }

  render(): JSX.Element {
    const trackIds = this.getTrackIds().filter((trackId) => this.props.tracks[trackId]);
    const name = this.props.route.params ? this.props.route.params.playlist.name : 'All Tracks';
    return (
      <View>
        <Text>{name}</Text>
        <TouchableHighlight onPress={this.shuffle.bind(this)}>
          <Text>Shuffle</Text>
        </TouchableHighlight>
        <TouchableHighlight onPress={this.playPlaylist.bind(this)}>
          <Text>Play All</Text>
        </TouchableHighlight>
        <FlatList
          data={trackIds}
          renderItem={({item}) => {
            const track = this.props.tracks[item];
            const artists = track.artistIds.map((artistId) => this.props.artists[artistId].name).join(', ');
            return (
              <TouchableHighlight onPress={() => this.playTrack(item)}>
                <View>
                  <Text style={styles.name} >{track.name}</Text>
                  <Text style={styles.artist} >{artists}</Text>
                </View>
              </TouchableHighlight>
            );
          }}
          keyExtractor={trackId => trackId}
        />
      </View>
    );
  }
}
