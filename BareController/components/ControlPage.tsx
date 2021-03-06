import AlbumArt from './AlbumArt';
import Controls from './Controls';
import Info from './Info';
import Progress from './Progress';
import React, {Component} from 'react';
import {StyleSheet, Text, View} from 'react-native';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'stretch',
    justifyContent: 'center',
  },
});

export default class ControlPage extends React.Component {
  render(): JSX.Element {
    const current = this.props.current;
    const albums = current && current.albums;
    const artId =  albums && albums.length && albums[0].id;
    const artFile = artId ? `${this.props.apiUrl}/get-album-art/${artId}` : '';
    const artists = current && current.artists;
    const track = current && current.track;
    const curYear = (new Date()).getFullYear();
    const isFav = track && track.favorites && track.favorites.includes(curYear);
    const mediaState = current && current.mediaState;
    return (
      <View style={styles.container}>
        <AlbumArt artFile={artFile} />
        <Info track={track || {}} artists={artists || []} albums={albums || []} />
        <Progress
          sendMessage={this.props.sendMessage.bind(this)}
          currentTime={current && current.currentTime}
          duration={track ? track.duration : 0}
        />
        <Controls
          isFavorite={isFav}
          paused={mediaState && mediaState.paused}
          sendMessage={this.props.sendMessage.bind(this)}
        />
      </View>
    );
  }
}
