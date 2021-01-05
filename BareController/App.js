/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 * @flow strict-local
 */

import DownloadPage from './components/DownloadPage';
import {Pages} from 'react-native-pages';
import {DEV_API_URL, PORT} from './constants';
import React from 'react';
import {AsyncStorage, NativeEventEmitter} from 'react-native';
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
      AsyncStorage.setItem('last-host', url);
    });
    this.socket.on('disconnect', () => {
      this.setState({connected: false});
    });
    this.socket.on('state', state => {
      this.setState({
        currentlyPlaying: state,
      });
    });
  }

  componentDidMount() {
    const emitter = new NativeEventEmitter(MdnsModule);
    if (__DEV__) {
      this.setState({apiUrl: DEV_API_URL});
      this.setupSocket(DEV_API_URL);
      return;
    }
    this.mdnsListener = emitter.addListener('resolve', event => {
      if (event.port == PORT) {
        const apiUrl = `http://${event.host}:${event.port}`;
        this.setState({apiUrl});
        clearTimeout(this.endScanTimeout);
        MdnsModule.stop();
        this.setupSocket(apiUrl);
      }
    });

    this.endScanTimeout = setTimeout(() => {
      MdnsModule.stop();
    }, 10000);

    AsyncStorage.getItem('last-host').then(host => {
      // current url -- just to get something to start
      let apiUrl = host || `http://192.168.1.75:${PORT}`;
      this.setState({apiUrl});
      this.setupSocket(apiUrl);
      MdnsModule.scan();
    });
  }

  componentWillUnmount() {
    if (this.endScanTimeout) {
      MdnsModule.stop();
      clearTimeout(this.endScanTimeout);
    }
    if (this.mdnsListener) {
      this.mdnsListener.remove();
    }
  }

  sendMessage(type, data) {
    this.socket.emit('action', {type, data});
  }

  render() {
    return (
      <Pages>
        <DownloadPage
          apiUrl={this.state.apiUrl}
          connected={this.state.connected}
        />
        <ControlPage
          apiUrl={this.state.apiUrl}
          current={this.state.currentlyPlaying}
          sendMessage={this.sendMessage.bind(this)}
        />
      </Pages>
    );
  }
}
