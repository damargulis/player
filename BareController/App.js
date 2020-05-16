/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 * @flow strict-local
 */

import DownloadPage from './components/DownloadPage';
import {Pages} from 'react-native-pages';
import {API_URL} from './constants';
import React from 'react';
import {
  SafeAreaView,
  StyleSheet,
  ScrollView,
  View,
  Text,
  StatusBar,
} from 'react-native';
import io from 'socket.io-client';
import ControlPage from './components/ControlPage';

export default class App extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      currentlyPlaying: null,
      connected: false,
    };
  }

  componentDidMount() {
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

  sendMessage(type, data) {
    this.socket.emit('action', { type, data });
  }

  render() {
    return (
      <Pages>
        <DownloadPage connected={this.state.connected} />
        <ControlPage current={this.state.currentlyPlaying} sendMessage={this.sendMessage.bind(this)} />
      </Pages>
    )
  }
}
