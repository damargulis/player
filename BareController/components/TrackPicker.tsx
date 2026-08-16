import NowPlayingBar from './NowPlayingBar';
import {joinArtists, playTracks, shuffleArray} from './playback';
import {ListSeparator} from './ListRow';
import SearchBar from './SearchBar';
import {COLORS, RADIUS, SPACING} from './theme';
import TrackRow from './TrackRow';
import React from 'react';
import {FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import TrackPlayer from 'react-native-track-player';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    paddingHorizontal: SPACING.screen,
    paddingTop: 16,
    paddingBottom: 12,
  },
  playlistName: {
    color: COLORS.text,
    fontSize: 24,
    fontWeight: '700',
  },
  trackCount: {
    color: COLORS.textSecondary,
    fontSize: 13,
    marginTop: 2,
  },
  buttonContainer: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.screen,
    paddingBottom: 12,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: COLORS.accent,
    borderRadius: RADIUS.button,
    paddingVertical: 11,
    alignItems: 'center',
    marginRight: 6,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  outlineButton: {
    flex: 1,
    borderColor: COLORS.accent,
    borderWidth: 1,
    borderRadius: RADIUS.button,
    paddingVertical: 11,
    alignItems: 'center',
    marginLeft: 6,
  },
  outlineButtonText: {
    color: COLORS.accent,
    fontSize: 15,
    fontWeight: '600',
  },
});

export default class TrackPicker extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      query: '',
      currentTrackId: null,
    };
  }

  componentDidMount(): void {
    this.trackSub = TrackPlayer.addEventListener('playback-track-changed', ({nextTrack}) => {
      this.setState({currentTrackId: nextTrack});
    });
    // pick up playback that started before this screen mounted
    TrackPlayer.getCurrentTrack()
      .then((trackId) => trackId && this.setState({currentTrackId: trackId}))
      .catch(() => {});
  }

  componentWillUnmount(): void {
    this.trackSub.remove();
  }

  getLibrary() {
    return {
      tracks: this.props.tracks,
      artists: this.props.artists,
      albums: this.props.albums,
    };
  }

  playPlaylist(): void {
    playTracks(this.getVisibleTrackIds(), this.getLibrary());
  }

  shuffle(): void {
    const trackIds = this.getVisibleTrackIds();
    shuffleArray(trackIds);
    playTracks(trackIds, this.getLibrary());
  }

  playFrom(trackId: string): void {
    playTracks(this.getVisibleTrackIds(), this.getLibrary(), trackId);
  }

  getTrackIds(): string[] {
    const trackIds = this.props.route.params ?
      this.props.route.params.playlist.trackIds.slice() : Object.keys(this.props.tracks);
    return trackIds;
  }

  /** Synced tracks matching the current search query (all synced tracks if empty). */
  getVisibleTrackIds(): string[] {
    const trackIds = this.getTrackIds().filter((trackId) => this.props.tracks[trackId]);
    const query = this.state.query.trim().toLowerCase();
    if (!query) {
      return trackIds;
    }
    return trackIds.filter((trackId) => {
      const trackName = this.props.tracks[trackId].name;
      return trackName && trackName.toLowerCase().includes(query);
    });
  }

  render(): JSX.Element {
    const trackIds = this.getVisibleTrackIds();
    const name = this.props.route.params ? this.props.route.params.playlist.name : 'All Tracks';
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.playlistName} numberOfLines={1}>{name}</Text>
          <Text style={styles.trackCount}>{trackIds.length} tracks</Text>
        </View>
        <View style={styles.buttonContainer}>
          <TouchableOpacity style={styles.primaryButton} onPress={this.shuffle.bind(this)}>
            <Text style={styles.primaryButtonText}>Shuffle</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.outlineButton} onPress={this.playPlaylist.bind(this)}>
            <Text style={styles.outlineButtonText}>Play All</Text>
          </TouchableOpacity>
        </View>
        <SearchBar
          value={this.state.query}
          onChangeText={(query) => this.setState({query})}
          placeholder="Search tracks"
        />
        <FlatList
          data={trackIds}
          keyboardShouldPersistTaps="handled"
          ItemSeparatorComponent={ListSeparator}
          renderItem={({item}) => {
            const track = this.props.tracks[item];
            return (
              <TrackRow
                name={track.name}
                artist={joinArtists(track, this.props.artists)}
                active={item === this.state.currentTrackId}
                onPress={() => this.playFrom(item)}
              />
            );
          }}
          keyExtractor={trackId => trackId}
        />
        <NowPlayingBar onOpen={() => this.props.navigation.navigate('Player')} />
      </View>
    );
  }
}
