import AsyncStorage from '@react-native-async-storage/async-storage';
import ErrorBoundary from 'react-native-error-boundary';
import AlbumPicker from './AlbumPicker';
import {NavigationContainer} from '@react-navigation/native';
import {createStackNavigator} from '@react-navigation/stack';
import PromisePool from 'es6-promise-pool';
import PlaylistPicker from './PlaylistPicker';
import React from 'react';
import {Button, FlatList, StyleSheet, Text, TextInput, TouchableHighlight, View } from 'react-native';
import {FileSystem} from 'react-native-unimodules';
import TrackPicker from './TrackPicker';
import ArtistPicker from './ArtistPicker';

const CONCURRENCY = 3;

const styles = StyleSheet.create({
  container: {
    paddingTop: 20,
  },
  listItem: {
    fontSize: 24,
  },
  sync: {
    fontSize: 42,
    width: '100%',
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: 'black',
  },
});

class Main extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      curIpText: '',
    }
  }

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
      { this.renderManualInput() }
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

  setIpAddress() {
    console.log(this.props);
    this.props.setIp(this.state.curIpText);
  }

  onChangeIpText(ip) {
    this.setState({curIpText: ip});
  }

  renderManualInput(): JSX.Element | null {
    if (this.props.connected) {
      return null;
    }
    return (
      <View>
        <Text>Not Connected, Enter IP Address to manually connect</Text>
        <TextInput onChangeText={this.onChangeIpText.bind(this)} style={styles.input} maxLength={15}/>
        <TouchableHighlight underlayColor="white" onPress={this.setIpAddress.bind(this)}>
          <Text style={styles.sync}>Press to Connect</Text>
        </TouchableHighlight>
      </View>
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
    };
  }

  componentWillUnmount() {
    this.save();
  }

  componentDidMount(): void {
    this.fetchData().then(() => {
      this.setUpDirectories();
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
    return new Promise(async (resolve) => {
      const tracks = await AsyncStorage.getItem('tracks');
      const playlists = await AsyncStorage.getItem('playlists');
      const artists = await AsyncStorage.getItem('artists');
      const albums = await AsyncStorage.getItem('albums');
      if (tracks && playlists && artists) {
        this.setState({
          tracks: JSON.parse(tracks),
          playlists: JSON.parse(playlists),
          artists: JSON.parse(artists),
          albums: JSON.parse(albums),
        }, () => resolve());
      }
    })
  }

  syncFile(filePath: string, urlPath: string): Promise {
    return FileSystem.getInfoAsync(filePath).then(({exists}) => {
      if (exists) {
        return Promise.resolve(filePath);
      }
      return FileSystem.downloadAsync(urlPath, filePath);
    });
  }

  syncTrackId(trackId: string): Promise {
    return fetch(`${this.props.apiUrl}/get-track-data/${trackId}`)
      .then((res) => res.json()).then((res) => {
        const path = `${FileSystem.documentDirectory}${trackId}.mp3`;
        const url = `${this.props.apiUrl}/get-track/${trackId}`;
        return this.syncFile(path, url).then((path) => {
          this.setState({
            tracks: Object.assign({}, this.state.tracks, {[trackId]: {...res, filePath: path}}),
          });
        });
      });
  }

  syncArtistId(artistId: string): Promise<undefined> {
    return fetch(`${this.props.apiUrl}/get-artist-data/${artistId}`)
      .then((res) => res.json()).then((res) => {
        // pic is stored on main as filePath, but need to call get-artist-pic to get pic data
        // if no filePath, artist has no pic
        // TODO: default pic
        if (!res.filePath) {
          this.setState({artists: Object.assign({}, this.state.artists, {[artistId]: {...res}})});
          return;
        }
        const picPath = `${FileSystem.documentDirectory}/artist-pics/${artistId}.png`;
        const url = `${this.props.apiUrl}/get-artist-pic/${artistId}`;
        return this.syncFile(picPath, url).then((path) => {
          this.setState({ artists: Object.assign({}, this.state.artists, {[artistId]: {...res, artFile: path}})});
        });
      });
  }

  syncAlbumId(albumId: string): Promise<undefined> {
    return fetch(`${this.props.apiUrl}/get-album-data/${albumId}`)
      .then((res) => res.json()).then((res) => {
        if (!res || !res.albumArtFile) {
          this.setState({
            albums: Object.assign({}, this.state.albums, {[albumId]: {...res}}),
          });
          return;
        }
        const picPath = `${FileSystem.documentDirectory}/album-art/${albumId}.png`;
        const url = `${this.props.apiUrl}/get-album-art/${albumId}`;
        return this.syncFile(picPath, url).then((path) => {
            this.setState({
              albums: Object.assign({}, this.state.albums, {[albumId]: {...res, albumArtFile: path}}),
            })
        });
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
    }).flat());
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
    }).flat());
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
    AsyncStorage.getItem('storedPlays').then((stored) => {
      const plays = {};
      const storedPlays = JSON.parse(stored);
      if (storedPlays) {
        Object.keys(storedPlays).forEach((trackId) => {
          if (this.state.tracks[trackId]) {
            const duration = this.state.tracks[trackId].duration
            plays[trackId] = storedPlays[trackId].filter((time) => time * 1000 > duration * .95).length;
          }
          // TODO: what to do if track not found? Keep play for later? Throw error?
        });
      }
      return `${this.props.apiUrl}/start-sync?plays=${encodeURIComponent(JSON.stringify(plays))}`;
    }).then((url) => fetch(url))
    .then((res) => res.json())
    .then((json) => {
      AsyncStorage.removeItem('storedPlays');
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
                  apiUrl={this.props.apiUrl}
                  setIp={this.props.setIp}
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
