import AsyncStorage from '@react-native-async-storage/async-storage';
import ErrorBoundary from 'react-native-error-boundary';
import AlbumPicker from './AlbumPicker';
import AlbumScreen from './AlbumScreen';
import ArtistScreen from './ArtistScreen';
import ListRow, {ListSeparator} from './ListRow';
import PlayerScreen from './PlayerScreen';
import {NavigationContainer} from '@react-navigation/native';
import {createStackNavigator} from '@react-navigation/stack';
import PromisePool from 'es6-promise-pool';
import PlaylistPicker from './PlaylistPicker';
import React from 'react';
import {Button, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import {FileSystem} from 'react-native-unimodules';
import {COLORS, RADIUS, SPACING} from './theme';
import TrackPicker from './TrackPicker';
import ArtistPicker from './ArtistPicker';

const CONCURRENCY = 3;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    padding: SPACING.screen,
  },
  sectionLabel: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 2,
    marginTop: 24,
    marginBottom: 8,
    marginLeft: 4,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.card,
    overflow: 'hidden',
  },
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.card,
    padding: SPACING.card,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 10,
  },
  statusText: {
    color: COLORS.text,
    fontSize: 15,
    flex: 1,
  },
  primaryButton: {
    backgroundColor: COLORS.accent,
    borderRadius: RADIUS.button,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 24,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  rescanButton: {
    borderColor: COLORS.accent,
    borderWidth: 1,
    borderRadius: RADIUS.button,
    paddingVertical: 6,
    paddingHorizontal: 14,
    marginLeft: 10,
  },
  rescanButtonText: {
    color: COLORS.accent,
    fontSize: 13,
    fontWeight: '600',
  },
  outlineButton: {
    borderColor: COLORS.accent,
    borderWidth: 1,
    borderRadius: RADIUS.button,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  outlineButtonText: {
    color: COLORS.accent,
    fontSize: 15,
    fontWeight: '600',
  },
  helperText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    marginBottom: 10,
  },
  input: {
    backgroundColor: COLORS.background,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 10,
    color: COLORS.text,
    fontSize: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  manualCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.card,
    padding: SPACING.card,
    marginTop: 24,
  },
  statusMessage: {
    color: COLORS.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    marginTop: 16,
  },
  errorMessage: {
    color: COLORS.warning,
    fontSize: 14,
    textAlign: 'center',
    marginTop: 16,
  },
});

const SECTIONS = ['Playlists', 'Albums', 'Artists', 'Tracks'];

class Main extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      curIpText: '',
    }
  }

  render(): JSX.Element {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        { this.renderConnectionStatus() }
        <Text style={styles.sectionLabel}>LIBRARY</Text>
        <View style={styles.card}>
          {SECTIONS.map((item, i) => (
            <View key={item}>
              {i > 0 ? <ListSeparator /> : null}
              <ListRow title={item} onPress={() => this.props.navigation.navigate(item)} />
            </View>
          ))}
        </View>
      { this.renderSyncButton() }
      { this.renderManualInput() }
      { this.renderSyncStatus() }
      </ScrollView>
    );
  }

  renderConnectionStatus(): JSX.Element {
    const connected = this.props.connected;
    return (
      <View style={styles.statusCard}>
        <View style={[
          styles.statusDot,
          {backgroundColor: connected ? COLORS.success : COLORS.warning},
        ]} />
        <Text style={styles.statusText}>
          {connected ? 'Connected to desktop' : 'Not connected — searching…'}
        </Text>
        {connected ? null : (
          <TouchableOpacity style={styles.rescanButton} onPress={this.props.rescan}>
            <Text style={styles.rescanButtonText}>Rescan</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  renderSyncButton(): JSX.Element | null {
    if (!this.props.connected || this.props.syncing) {
      return null;
    }
    return (
      <TouchableOpacity style={styles.primaryButton} onPress={this.props.sync.bind(this)}>
        <Text style={styles.primaryButtonText}>Sync Library</Text>
      </TouchableOpacity>
    );
  }

  setIpAddress() {
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
      <View style={styles.manualCard}>
        <Text style={styles.helperText}>Enter the desktop's IP address to connect manually</Text>
        <TextInput
          onChangeText={this.onChangeIpText.bind(this)}
          style={styles.input}
          maxLength={15}
          placeholder="192.168.1.42"
          placeholderTextColor={COLORS.textSecondary}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TouchableOpacity style={styles.outlineButton} onPress={this.setIpAddress.bind(this)}>
          <Text style={styles.outlineButtonText}>Connect</Text>
        </TouchableOpacity>
      </View>
    );
  }

  renderSyncStatus(): JSX.Element | null {
    if (this.props.errString) {
      return (<Text style={styles.errorMessage}>{this.props.errString}</Text>);
    }
    if (!this.props.syncing) {
      return null;
    }
    return (
      <Text style={styles.statusMessage}>{this.props.progressString}</Text>
    );
  }
}

const Stack = createStackNavigator();

const fallbackStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.screen,
  },
  title: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 12,
  },
  detail: {
    color: COLORS.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
  },
});

const Fallback = (props: { error: Error, resetError: Function}) => (
  <View style={fallbackStyles.container}>
    <Text style={fallbackStyles.title}>Something went wrong</Text>
    <Text style={fallbackStyles.detail}>{props.error.toString()}</Text>
    <Button color={COLORS.accent} onPress={props.resetError} title="Reset" />
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
        // the desktop stores artist art as artFile; get-artist-pic serves the bytes
        if (!res.artFile) {
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
        const artPath = this.state.artists[artistId].artFile;
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
          <Stack.Navigator
            screenOptions={{
              headerStyle: {
                backgroundColor: COLORS.surface,
                elevation: 0,
                shadowColor: 'transparent',
              },
              headerTintColor: COLORS.text,
              headerTitleStyle: {fontWeight: '700'},
              headerBackTitleVisible: false,
              cardStyle: {backgroundColor: COLORS.background},
            }}>
            <Stack.Screen name="main" options={{title: 'MyMusic'}}>
              {
                props => <Main {...props}
                  sync={this.sync.bind(this)}
                  connected={this.props.connected}
                  apiUrl={this.props.apiUrl}
                  setIp={this.props.setIp}
                  rescan={this.props.rescan}
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
            <Stack.Screen name="Album" options={{title: 'Album'}}>
              {props => <AlbumScreen {...props}
                tracks={this.state.tracks}
                artists={this.state.artists}
                albums={this.state.albums}
              />}
            </Stack.Screen>
            <Stack.Screen name="Artist" options={{title: 'Artist'}}>
              {props => <ArtistScreen {...props}
                tracks={this.state.tracks}
                artists={this.state.artists}
                albums={this.state.albums}
              />}
            </Stack.Screen>
            <Stack.Screen name="Player" options={{title: 'Now Playing'}}>
              {props => <PlayerScreen {...props} />}
            </Stack.Screen>
          </Stack.Navigator>
        </NavigationContainer>
      </ErrorBoundary>
    );
  }
}
