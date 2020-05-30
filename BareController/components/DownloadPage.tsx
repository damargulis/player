import ErrorBoundary from 'react-native-error-boundary';
import AlbumPicker from './AlbumPicker';
import {NavigationContainer} from '@react-navigation/native';
import {createStackNavigator} from '@react-navigation/stack';
import {API_URL} from '../constants';
import PromisePool from 'es6-promise-pool';
import PlaylistPicker from './PlaylistPicker';
import React from 'react';
import {AsyncStorage, Button, FlatList, StyleSheet, Text, TouchableHighlight, View } from 'react-native';
import {FileSystem} from 'react-native-unimodules';
import TrackPicker from './TrackPicker';
import ArtistPicker from './ArtistPicker';
import TrackPlayer from 'react-native-track-player';

const CONCURRENCY = 1;

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
  render(): JSX.Element {
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

  renderSyncButton(): JSX.Element | null {
    if (!this.props.connected || this.props.syncing) {
      return null;
    }
    return (
      <TouchableHighlight underlayColor="white" onPress={this.props.sync.bind(this)}>
        <Text style={styles.sync}>Press to Sync</Text>
      </TouchableHighlight>
    );
  }

  renderSyncStatus(): JSX.Element | null {
    if (this.props.errString) {
      return (<Text style={styles.sync}>{this.props.errString}</Text>);
    }
    if (!this.props.syncing) {
      return null;
    }
    return (
      <Text style={styles.sync}>{this.props.progressString}</Text>
    );
  }
}

const Stack = createStackNavigator();

const Fallback = (props: { error: Error, resetError: Function}) => (
  <View>
    <Text>Something Bad Happened!</Text>
    <Text>{props.error.toString()}</Text>
    <Button onPress={props.resetError} title="Reset" />
  </View>
);

export default class DownloadPage extends React.Component {
  constructor(props: object) {
    super(props);

    this.state = {
      albums: {},
      tracks: {},
      artists: {},
      syncing: false,
      playlists: [],
      err: '',
      storedPlays: {},
    };
  }

  componentWillUnmount() {
    this.onTrackChange.remove();
  }


  componentDidMount(): void {
    this.fetchData();
    this.setUpDirectories();
    this.onTrackChange = TrackPlayer.addEventListener('playback-track-changed', (data) => {
      if (data.track !== null) {
        const track = this.state.tracks[data.track];
        const bigPos = data.position * 100;
        const isGreater = bigPos >= track.duration;
        if (data.position * 1000 >= track.duration * .95) {
          this.setState({
            storedPlays: Object.assign({}, this.state.storedPlays, {
              [track.id]: this.state.storedPlays[track.id] ? this.state.storedPlays[track.id] + 1 : 1,
            })
          });
        }
      }
    });
  }

  setUpDirectories() {
    const artistDir = FileSystem.documentDirectory + '/artist-pics/';
    FileSystem.getInfoAsync(artistDir).then(({exists}) => {
      if (!exists) {
        FileSystem.makeDirectoryAsync(artistDir);
      }
    });
    const albumDir = FileSystem.documentDirectory + '/album-art/';
    FileSystem.getInfoAsync(albumDir).then(({exists}) => {
      if (!exists) {
        FileSystem.makeDirectoryAsync(albumDir);
      }
    });
  }

  async fetchData(): void {
    const tracks = await AsyncStorage.getItem('tracks');
    const playlists = await AsyncStorage.getItem('playlists');
    const artists = await AsyncStorage.getItem('artists');
    const albums = await AsyncStorage.getItem('albums');
    const storedPlays = await AsyncStorage.getItem('storedPlays');
    if (tracks && playlists && artists) {
      this.setState({
        tracks: JSON.parse(tracks),
        playlists: JSON.parse(playlists),
        artists: JSON.parse(artists),
        albums: JSON.parse(albums),
        storedPlays: JSON.parse(storedPlays),
      });
    }
  }

  syncTrackId(trackId: string): Promise {
    return fetch(`${API_URL}/get-track-data/${trackId}`)
      .then((res) => res.json()).then((res) => {
        const path = `${FileSystem.documentDirectory}${trackId}.mp3`;
        return FileSystem.getInfoAsync(path).then(({exists}) => {
          if (exists) {
            this.setState({
              tracks: Object.assign({}, this.state.tracks, {[trackId]: {...res, filePath: path}}),
            });
          } else {
            const url = `${API_URL}/get-track/${trackId}`;
            return FileSystem.downloadAsync(url, path).then(({uri}) => {
              this.setState({
                tracks: Object.assign({}, this.state.tracks, {[trackId]: { ...res, filePath: uri}}),
              });
            });
          }
        });
      });
  }

  syncArtistId(artistId: string): Promise<undefined> {
    return fetch(`${API_URL}/get-artist-data/${artistId}`)
      .then((res) => res.json()).then((res) => {
        const picPath = `${FileSystem.documentDirectory}/artist-pics/${artistId}.png`;
        if (res.filePath) {
          const url = `${API_URL}/get-artist-pic/${artistId}`;
          return FileSystem.downloadAsync(url, picPath).then(({uri}) => {
            this.setState({
              artists: Object.assign({}, this.state.artists, {[artistId]: {...res, artFile: uri}}),
            });
          });
        } else {
          this.setState({
            artists: Object.assign({}, this.state.artists, {[artistId]: {...res}}),
          });
        }
      });
  }

  syncAlbumId(albumId: string): Promise<undefined> {
    return fetch(`${API_URL}/get-album-data/${albumId}`)
      .then((res) => res.json()).then((res) => {
        const picPath = `${FileSystem.documentDirectory}/album-art/${albumId}.png`;
        if (res && res.albumArtFile) {
          const url = `${API_URL}/get-album-art/${albumId}`;
          return FileSystem.downloadAsync(url, picPath).then(({uri}) => {
            this.setState({
              albums: Object.assign({}, this.state.albums, {[albumId]: {...res, albumArtFile: uri}}),
            })
          });
        } else {
          this.setState({
            albums: Object.assign({}, this.state.albums, {[albumId]: {...res}}),
          });
        }
      });
  }

  syncTrackIds(trackIds: string[]): Promise<undefined> {
    trackIds = trackIds.keys();
    const trackPromises = new PromisePool<undefined>(() => {
      const next = trackIds.next();
      if (next.done) {
        return null;
      }
      return this.syncTrackId(next.value);
    }, CONCURRENCY);
    return trackPromises.start();
  }

  syncArtistIds(artistIds: string[]): Promise<undefined> {
    artistIds = artistIds.keys();
    const artistPromises = new PromisePool(() => {
      const next = artistIds.next();
      if (next.done) {
        return null;
      }
      return this.syncArtistId(next.value);
    }, CONCURRENCY);
    return artistPromises.start();
  }

  syncAlbumIds(albumIds: string[]): Promise<undefined> {
    albumIds = albumIds.keys();
    const albumPromises = new PromisePool(() => {
      const next = albumIds.next();
      if (next.done) {
        return null;
      }
      return this.syncAlbumId(next.value);
    }, CONCURRENCY);
    return albumPromises.start();
  }

  save(): void {
    AsyncStorage.setItem('tracks', JSON.stringify(this.state.tracks));
    AsyncStorage.setItem('playlists', JSON.stringify(this.state.playlists));
    AsyncStorage.setItem('artists', JSON.stringify(this.state.artists));
    AsyncStorage.setItem('albums', JSON.stringify(this.state.albums));
    AsyncStorage.setItem('storedPlays', JSON.stringify(this.state.storedPlays));
  }

  removeOldTracks(keepTracks: Set<string>): Promise<undefined> {
    const tracks = Object.assign({}, this.state.tracks);
    const deletes = Promise.all(Object.keys(this.state.tracks).map((trackId) => {
      if (!keepTracks.has(trackId)) {
        const path = this.state.tracks[trackId].filePath;
        delete tracks[trackId];
        return FileSystem.deleteAsync(path, {idempotent: true});
      }
    }));
    this.setState({tracks});
    return deletes;
  }

  removeOldArtists(keepTracks: Set<string>): Promise<Set<string>> {
    const keepArtists = new Set([...keepTracks].map((trackId) => {
      return this.state.tracks[trackId].artistIds;
    }));
    const artists = Object.assign({}, this.state.artists);
    const deletes = Promise.all(Object.keys(this.state.artists).map((artistId) => {
      if (!keepArtists.has(artistId)) {
        const artPath = this.state.artists[artistId].filePath;
        delete artists[artistId];
        if (artPath) {
          return FileSystem.deleteAsync(artPath, {idempotent: true});
        }
      }
    }));
    this.setState({artists});
    return deletes.then(() => keepArtists);
  }

  removeOldAlbums(keepTracks: Set<string>): Promise<Set<string>> {
    const keepAlbums = new Set([...keepTracks].map((trackId) => {
      return this.state.tracks[trackId].albumIds;
    }));
    const albums = Object.assign({}, this.state.albums);
    const deletes = Promise.all(Object.keys(this.state.albums).map((albumId) => {
      if (!keepAlbums.has(albumId)) {
        const album = this.state.albums[albumId];
        const artPath = album && album.albumArtFile;
        delete albums[albumId];
        if (artPath) {
          return FileSystem.deleteAsync(artPath, {idempotent: true});
        }
      }
    }));
    this.setState({albums});
    return deletes.then(() => keepAlbums);
  }

  sync(): void {
    this.setState({syncing: true});

    const url = `${API_URL}/start-sync?plays=${encodeURIComponent(JSON.stringify(this.state.storedPlays))}`;
    fetch(url).then((res) => res.json())
    .then((json) => {
      this.setState({storedPlays: {}});
      const trackIds = new Set() as Set<string>;
      const playlists = json.playlists;
      playlists.forEach((playlist) => {
        playlist.trackIds.forEach((id) => trackIds.add(id));
      });
      this.setState({playlists});
      return this.removeOldTracks(trackIds)
        .then(() => this.syncTrackIds(trackIds))
        .then(() => this.removeOldAlbums(trackIds))
        .then((albumIds) => this.syncAlbumIds(albumIds))
        .then(() => this.removeOldArtists(trackIds))
        .then((artistIds) => this.syncArtistIds(artistIds))
        .then(() => this.setState({syncing: false}, () => this.save()));
    }).catch((err) => {
      console.log("Err: ");
      console.log(err);
      this.setState({syncing: false, err: "Final Catch: " + err});
    });
  }

  render(): JSX.Element {
    const synced = Object.values(this.state.tracks).length;
    const toSync = new Set() as Set<string>;
    this.state.playlists.forEach((playlist) => {
      playlist.trackIds.forEach((id) => toSync.add(id));
    });
    const progressString = `Synced ${synced} out of ${toSync.size} tracks.  Last Err: ${this.state.err}`;
    return (
      <ErrorBoundary FallbackComponent={Fallback}>
        <NavigationContainer>
          <Stack.Navigator>
            <Stack.Screen name="main" >
              {
                props => <Main {...props}
                  sync={this.sync.bind(this)}
                  connected={this.props.connected}
                  syncing={this.state.syncing}
                  progressString={progressString}
                  errString={this.state.err}
                />
              }
            </Stack.Screen>
            <Stack.Screen name="Playlists">
              {props => <PlaylistPicker {...props} playlists={this.state.playlists}/>}
            </Stack.Screen>
            <Stack.Screen name="Albums">
              {props => <AlbumPicker {...props} albums={this.state.albums}/>}
            </Stack.Screen>
            <Stack.Screen name="Artists">
              {props => <ArtistPicker {...props} artists={this.state.artists}/>}
            </Stack.Screen>
            <Stack.Screen name="Tracks" >
              {props => <TrackPicker {...props}
                tracks={this.state.tracks}
                artists={this.state.artists}
                albums={this.state.albums}
              />}
            </Stack.Screen>
          </Stack.Navigator>
        </NavigationContainer>
      </ErrorBoundary>
    );
  }
}
