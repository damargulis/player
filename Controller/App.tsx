import {API_URL} from './constants';
import ControlPage from './components/ControlPage';
import DownloadPage from './components/DownloadPage';
import React from 'react';
import {StyleSheet, Text, View } from 'react-native';
import {Pages} from 'react-native-pages';
import io from 'socket.io-client';

export default class App extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      currentlyPlaying: null,
      connected: false,
    };
  }

  componentDidMount(): void {
    this.socket = io.connect(API_URL);
    this.socket.on('connect', () => {
      this.setState({connected: true});
    });
    this.socket.on('disconnect', () => {
      this.setState({connected: false});
    });
    this.socket.on('state', (state) => {
      this.setState({
        currentlyPlaying: state,
      });
    });
  }

  sendMessage(type: string, data: object): void {
    this.socket.emit('action', {
      type: type,
      data: data,
    });
  }

  render() {
    return (
      <Pages>
        <DownloadPage connected={this.state.connected} />
        <ControlPage current={this.state.currentlyPlaying} sendMessage={this.sendMessage.bind(this)} />
      </Pages>
    );
  }

}
