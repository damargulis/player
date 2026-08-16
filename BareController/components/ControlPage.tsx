import AlbumArt from './AlbumArt';
import Controls from './Controls';
import Info from './Info';
import Progress from './Progress';
import {COLORS, SPACING} from './theme';
import VolumeSlider from './VolumeSlider';
import React, {Component} from 'react';
import {SafeAreaView, StyleSheet, Text, View} from 'react-native';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: 'stretch',
    justifyContent: 'flex-end',
    paddingHorizontal: SPACING.screen,
    paddingBottom: 28,
  },
  header: {
    alignItems: 'center',
    paddingTop: 18,
    paddingBottom: 6,
  },
  headerLabel: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 2,
  },
});

export default class ControlPage extends React.Component {
  favoriteTrack(): void {
    this.props.sendMessage('favoriteTrack');
  }

  render(): JSX.Element {
    const current = this.props.current;
    const albums = current && current.albums;
    const artId = albums && albums.length && albums[0].id;
    const artFile = artId ? `${this.props.apiUrl}/get-album-art/${artId}` : '';
    const artists = current && current.artists;
    const track = current && current.track;
    const curYear = (new Date()).getFullYear();
    const isFav = track && track.favorites && track.favorites.includes(curYear);
    const mediaState = current && current.mediaState;
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerLabel}>NOW PLAYING</Text>
        </View>
        <AlbumArt artFile={artFile} />
        <Info
          track={track || {}}
          artists={artists || []}
          albums={albums || []}
          isFavorite={isFav}
          onToggleFavorite={this.favoriteTrack.bind(this)}
        />
        <Progress
          sendMessage={this.props.sendMessage.bind(this)}
          currentTime={current && current.currentTime}
          duration={track ? track.duration : 0}
        />
        <Controls
          paused={mediaState && mediaState.paused}
          sendMessage={this.props.sendMessage.bind(this)}
        />
        <VolumeSlider
          sendMessage={this.props.sendMessage.bind(this)}
          volume={mediaState ? mediaState.volume : 0}
        />
      </SafeAreaView>
    );
  }
}
