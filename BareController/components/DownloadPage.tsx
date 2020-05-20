import {NavigationContainer} from '@react-navigation/native';
import {createStackNavigator} from '@react-navigation/stack';
import {API_URL} from '../constants';
import PromisePool from 'es6-promise-pool';
import {FileSystem} from 'react-native-unimodules';
import PlaylistPicker from './PlaylistPicker';
import React from 'react';
import {AsyncStorage, FlatList, StyleSheet, Text, TouchableHighlight, View } from 'react-native';
import TrackPicker from "./TrackPicker";

const styles = StyleSheet.create({
  container: {
    paddingTop: 20,
  },
  listItem: {
    fontSize: 20,
  },
  sync: {
    fontSize: 40,
    width: '100%',
    textAlign: 'center',
  },
});

class Main extends React.Component {
  render() {
    return (
      <View style={styles.container} >
        <FlatList
          data={['Playlists', 'Albums', 'Artists', 'Tracks']}
          renderItem={({item}) => (
            <TouchableHighlight underlayColor="white" onPress={() => this.props.navigation.navigate(item)}>
              <Text style={styles.listItem}>{item}</Text>
            </TouchableHighlight>
          )}
          keyExtractor={item => item}
        />
      { this.renderSyncButton() }
      { this.renderSyncStatus() }
      </View>
    );
  }

  renderSyncButton() {
    if (!this.props.connected || this.props.syncing) {
      return null;
    }
    return (
      <TouchableHighlight underlayColor="white" onPress={this.props.sync.bind(this)}>
        <Text style={styles.sync}>Press to Sync</Text>
      </TouchableHighlight>
    );
  }

  renderSyncStatus() {
    if (!this.props.syncing) {
      return null;
    }
    return (
      <Text style={styles.sync}>{this.props.progressString}</Text>
    );
  }
}

const Stack = createStackNavigator();

export default class DownloadPage extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      tracks: {},
      syncing: false,
      playlists: [],
    };
  }

  componentDidMount() {
    this.fetchData();
  }

  async fetchData() {
    const tracks = await AsyncStorage.getItem('tracks');
    const playlists = await AsyncStorage.getItem('playlists');
    if (tracks && playlists) {
      this.setState({
        tracks: JSON.parse(tracks),
        playlists: JSON.parse(playlists),
      });
    }
  }

  sync(): void {
    this.setState({syncing: true});
    fetch(API_URL + '/start-sync').then((res) => res.json())
    .then((json) => {
      let trackIds = new Set() as Set<number>;
      const playlists = json.playlists;
      playlists.forEach((playlist) => {
        playlist.trackIds.forEach((id) => trackIds.add(id));
      });
      this.setState({playlists});
      trackIds = trackIds.keys();
      const trackPromises = new PromisePool(() => {
        const next = trackIds.next();
        if (next.done) {
          return null;
        }
        const trackId = next.value;
        const url = API_URL + '/get-track/' + trackId;
        return FileSystem.downloadAsync(url, FileSystem.documentDirectory + trackId + '.mp3').then(({uri}) => {
          return fetch(API_URL + '/get-track-data/' + trackId).then((res) => res.json()).then((res) => {
            this.setState({
              tracks: Object.assign({}, this.state.tracks, {
                [trackId]: {
                  ...res,
                  filePath: uri,
                },
              }),
            });
          });
        });
      }, 1);
      return trackPromises.start().then(() => {
        this.setState({syncing: false});
        AsyncStorage.setItem('tracks', JSON.stringify(this.state.tracks));
        AsyncStorage.setItem('playlists', JSON.stringify(this.state.playlists));
      });
    }).catch((err) => {
      console.log('Err:');
      console.log(err);
      this.setState({syncing: false});
    });
  }

  render() {
    const synced = Object.values(this.state.tracks).length;
    const total = this.state.playlists.reduce((total, playlist) => { return total + playlist.trackIds.length}, 0);
    const progressString = `Synced ${synced} out of ${total} tracks`;
    return (
      <NavigationContainer>
        <Stack.Navigator>
          <Stack.Screen name="main" >
            {
              props => <Main {...props}
                sync={this.sync.bind(this)}
                connected={this.props.connected}
                syncing={this.state.syncing}
                progressString={progressString}
              />
            }
          </Stack.Screen>
          <Stack.Screen name="Playlists">
            {
              props => <PlaylistPicker {...props} playlists={this.state.playlists} />
            }
          </Stack.Screen>
          <Stack.Screen name="tracks" >
            {
              props => <TrackPicker {...props} tracks={this.state.tracks} />
            }
          </Stack.Screen>
        </Stack.Navigator>
      </NavigationContainer>
    );
  }
}
