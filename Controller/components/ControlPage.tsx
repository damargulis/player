import AlbumArt from './AlbumArt';
import Controls from './Controls';
import Info from './Info';
import io from 'socket.io-client';
import Progress from './Progress';
import React, {Component} from 'react';
import {StyleSheet, Text, View} from 'react-native';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'stretch',
    justifyContent: 'center',
  },
});

export default class ControlPage extends React.Component {
  constructor(props: object) {
    super(props);

    this.state = {
      track: null,
      currentTime: 0,
      mediaState: null,
    };
  }

  sendMessage(type: string, data: object): void {
    this.socket.emit('action', {
      type: type,
      data: data,
    });
  }

  componentDidMount(): void {
    const port = __DEV__ ? 4444 : 4443;
    this.socket = io.connect('http://192.168.1.61:4444');
    this.socket.on('state', (state) => {
      this.setState({
        track: state.track,
        currentTime: state.currentTime,
        mediaState: state.mediaState,
        albums: state.albums,
        artists: state.artists,
      });
    });
  }

  render(): JSX.Element {
    return (
      <View style={styles.container}>
        <AlbumArt artFile={this.state.albums && this.state.albums[0] && this.state.albums[0].albumArtFile} />
        <Info track={this.state.track || {}} artists={this.state.artists || []} albums={this.state.albums || []} />
        <Progress
          sendMessage={this.sendMessage.bind(this)}
          currentTime={this.state.currentTime}
          duration={this.state.track ? this.state.track.duration : 0}
        />
        <Controls
          paused={this.state.mediaState && this.state.mediaState.paused}
          sendMessage={this.sendMessage.bind(this)}
        />
      </View>
    );
  }
}
