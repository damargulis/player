/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 * @flow strict-local
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import DownloadPage from './components/DownloadPage';
import {Pages} from 'react-native-pages';
import {DEV_API_URL, PORT} from './constants';
import React from 'react';
import {NativeEventEmitter, StatusBar, StyleSheet, View} from 'react-native';
import io from 'socket.io-client';
import ControlPage from './components/ControlPage';
import {COLORS} from './components/theme';
import MdnsModule from './MdnsModule';

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
});

const SCAN_WINDOW_MS = 10000;
const PING_TIMEOUT_MS = 3000;
const SUPPORTED_PROTOCOL = 1;

export default class App extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      currentlyPlaying: null,
      connected: false,
      apiUrl: '',
    };
  }

  /**
   * Confirms a discovered address actually belongs to the desktop app before
   * trusting it. Old desktop builds have no /ping, so a 404 also passes.
   */
  verifyHost(url) {
    return new Promise(resolve => {
      const timeout = setTimeout(() => resolve(false), PING_TIMEOUT_MS);
      fetch(`${url}/ping`)
        .then(res => {
          if (res.status === 404) {
            return {app: 'MyMusic'};
          }
          return res.json();
        })
        .then(json => {
          clearTimeout(timeout);
          // desktops older than /ping report no protocol; treat as compatible
          const compatible = json && (json.protocol === undefined || json.protocol === SUPPORTED_PROTOCOL);
          resolve(json && json.app === 'MyMusic' && compatible);
        })
        .catch(() => {
          clearTimeout(timeout);
          resolve(false);
        });
    });
  }

  setupSocket(url) {
    if (this.socket) {
      this.socket.close();
    }
    this.socket = io.connect(url);
    this.socket.on('connect', () => {
      this.stopScan();
      this.setState({connected: true});
      AsyncStorage.setItem('last-host', url);
    });
    this.socket.on('disconnect', () => {
      this.setState({connected: false});
      // the desktop may have moved to a new address; look for it again
      this.startScan();
    });
    this.socket.on('state', state => {
      this.setState({
        currentlyPlaying: state,
      });
    });
  }

  startScan() {
    if (__DEV__) {
      return;
    }
    MdnsModule.scan();
    clearTimeout(this.endScanTimeout);
    this.endScanTimeout = setTimeout(() => {
      MdnsModule.stop();
    }, SCAN_WINDOW_MS);
  }

  stopScan() {
    clearTimeout(this.endScanTimeout);
    MdnsModule.stop();
  }

  componentDidMount() {
    const emitter = new NativeEventEmitter(MdnsModule);
    if (__DEV__) {
      this.setState({apiUrl: DEV_API_URL});
      this.setupSocket(DEV_API_URL);
      return;
    }
    this.mdnsListener = emitter.addListener('resolve', event => {
      // ipv6 literals need brackets inside a url
      const host = event.host.includes(':') ? `[${event.host}]` : event.host;
      const apiUrl = `http://${host}:${event.port}`;
      if (apiUrl === this.state.apiUrl && this.state.connected) {
        return;
      }
      this.verifyHost(apiUrl).then(ok => {
        if (!ok) {
          return;
        }
        this.stopScan();
        this.setState({apiUrl});
        this.setupSocket(apiUrl);
      });
    });

    AsyncStorage.getItem('last-host').then(host => {
      // try the last known address immediately while discovery runs
      if (host) {
        this.setState({apiUrl: host});
        this.setupSocket(host);
      }
      this.startScan();
    });
  }

  componentWillUnmount() {
    this.stopScan();
    if (this.mdnsListener) {
      this.mdnsListener.remove();
    }
    if (this.socket) {
      this.socket.close();
    }
  }

  sendMessage(type, data) {
    this.socket.emit('action', {type, data});
  }

  setIp(newIp) {
    const apiUrl = `http://${newIp}:${PORT}`;
    this.setState({apiUrl});
    this.setupSocket(apiUrl);
  }

  render() {
    return (
      <View style={styles.root}>
        <StatusBar
          barStyle="light-content"
          backgroundColor={COLORS.background}
        />
        <Pages indicatorColor={COLORS.accent}>
          <DownloadPage
            apiUrl={this.state.apiUrl}
            connected={this.state.connected}
            setIp={this.setIp.bind(this)}
            rescan={this.startScan.bind(this)}
          />
          <ControlPage
            apiUrl={this.state.apiUrl}
            current={this.state.currentlyPlaying}
            sendMessage={this.sendMessage.bind(this)}
          />
        </Pages>
      </View>
    );
  }
}
