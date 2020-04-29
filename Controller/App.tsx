import React from 'react';
import {StyleSheet, Text, View } from 'react-native';
import Controls from './components/Controls';
import io from "socket.io-client";

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'stretch',
    justifyContent: 'center',
  },
  info: {
    flex: 1,
    backgroundColor: 'blue',
  },
  albumCover: {
    flex: 5,
    backgroundColor: 'green',
  },
  progress: {
    flex: 1,
    backgroundColor: 'red',
  },
});

export default class App extends React.Component {
  constructor(props) {
    super(props);

    this.messages = [];

    this.state = {
      track: null,
      currentTime: 0,
    };
  }

  sendMessage(message, data) {
    console.log('sending: ' + message + ' ' + data);
    this.socket.emit(message, data);
  }

  componentDidMount() {
    this.socket = io.connect("http://192.168.1.61:4444");
    this.socket.on('state', (state) => {
      this.setState({
        track: state.track,
        currentTime: state.currentTime,
      });
    });
  }

  render() {
    return (
      <View style={styles.container}>
        <View style={styles.albumCover}><Text>Picture</Text></View>
        <View style={styles.info}><Text>Title: {this.state.track ? this.state.track.name : ''}</Text></View>
        <View style={styles.progress}><Text>Progress: {this.state.currentTime}</Text></View>
        <Controls sendMessage={this.sendMessage.bind(this)}/>
      </View>
    );
  }
}
