import missingAlbum from '../assets/missing_album.png';
import NowPlayingBar from './NowPlayingBar';
import {joinArtists, playTracks, shuffleArray} from './playback';
import {ListSeparator} from './ListRow';
import {COLORS, RADIUS, SPACING} from './theme';
import TrackRow from './TrackRow';
import React from 'react';
import {FlatList, Image, StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import TrackPlayer from 'react-native-track-player';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    alignItems: 'center',
    paddingHorizontal: SPACING.screen,
    paddingTop: 20,
    paddingBottom: 6,
  },
  artWrap: {
    borderRadius: 12,
    backgroundColor: COLORS.surface,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 8},
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 10,
  },
  art: {
    width: 180,
    height: 180,
    borderRadius: 12,
  },
  name: {
    color: COLORS.text,
    fontSize: 22,
    fontWeight: '700',
    marginTop: 14,
    textAlign: 'center',
  },
  meta: {
    color: COLORS.textSecondary,
    fontSize: 13,
    marginTop: 3,
  },
  buttonRow: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    marginTop: 14,
    marginBottom: 6,
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
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: COLORS.textSecondary,
    fontSize: 16,
  },
});

export default class AlbumScreen extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      currentTrackId: null,
    };
  }

  componentDidMount(): void {
    this.trackSub = TrackPlayer.addEventListener('playback-track-changed', ({nextTrack}) => {
      this.setState({currentTrackId: nextTrack});
    });
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

  getTrackIds(): string[] {
    const album = this.props.albums[this.props.route.params.albumId];
    return ((album && album.trackIds) || []).filter((id) => this.props.tracks[id]);
  }

  playAll(): void {
    playTracks(this.getTrackIds(), this.getLibrary());
  }

  shuffle(): void {
    const trackIds = this.getTrackIds();
    shuffleArray(trackIds);
    playTracks(trackIds, this.getLibrary());
  }

  playFrom(trackId: string): void {
    playTracks(this.getTrackIds(), this.getLibrary(), trackId);
  }

  renderHeader(album): JSX.Element {
    const trackIds = this.getTrackIds();
    const art = album.albumArtFile ? {uri: album.albumArtFile} : missingAlbum;
    const meta = [album.year, `${trackIds.length} tracks`].filter(Boolean).join(' · ');
    return (
      <View style={styles.header}>
        <View style={styles.artWrap}>
          <Image style={styles.art} source={art} />
        </View>
        <Text style={styles.name} numberOfLines={2}>{album.name}</Text>
        <Text style={styles.meta}>{meta}</Text>
        <View style={styles.buttonRow}>
          <TouchableOpacity style={styles.primaryButton} onPress={this.shuffle.bind(this)}>
            <Text style={styles.primaryButtonText}>Shuffle</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.outlineButton} onPress={this.playAll.bind(this)}>
            <Text style={styles.outlineButtonText}>Play</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  render(): JSX.Element {
    const album = this.props.albums[this.props.route.params.albumId];
    if (!album) {
      return (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>Album not synced</Text>
        </View>
      );
    }
    return (
      <View style={styles.container}>
        <FlatList
          data={this.getTrackIds()}
          ListHeaderComponent={this.renderHeader(album)}
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
          keyExtractor={(trackId) => trackId}
        />
        <NowPlayingBar onOpen={() => this.props.navigation.navigate('Player')} />
      </View>
    );
  }
}
