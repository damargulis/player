/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 * @flow strict-local
 */

import DownloadPage from './components/DownloadPage';
import {Pages} from 'react-native-pages';
import {PORT} from './constants';
import React from 'react';
import {
  SafeAreaView,
  StyleSheet,
  ScrollView,
  View,
  Text,
  StatusBar,
  NativeEventEmitter,
} from 'react-native';
import io from 'socket.io-client';
import ControlPage from './components/ControlPage';
import MdnsModule from './MdnsModule';

export default class App extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      currentlyPlaying: null,
      connected: false,
      apiUrl: '',
    };
  }

  setupSocket(url) {
    this.socket = io.connect(url);
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

  componentDidMount() {
    const emitter = new NativeEventEmitter(MdnsModule);
    this.mdnsListener = emitter.addListener('resolve', (event) => {
      if (event.port === PORT) {
        const apiUrl = `http://${event.host}:${event.port}`;
        this.setState({apiUrl});
        clearTimeout(this.endScanTimeout);
        MdnsModule.stop();
        this.setupSocket(apiUrl);
      }
    });

    MdnsModule.scan();
    this.endScanTimeout = setTimeout(() => {
      MdnsModule.stop();
    }, 10000);
  }

  componentWillUnmount() {
    if (this.endScanTimeout) {
      MdnsModule.stop();
      clearTimeout(this.endScanTimeout);
    }
    this.mdnsListener.remove();
  }

  sendMessage(type, data) {
    this.socket.emit('action', { type, data });
  }

  render() {
    return (
      <Pages>
        <DownloadPage apiUrl={this.state.apiUrl} connected={this.state.connected} />
        <ControlPage current={this.state.currentlyPlaying} sendMessage={this.sendMessage.bind(this)} />
      </Pages>
    )
  }
}
