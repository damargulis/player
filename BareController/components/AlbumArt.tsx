import missingAlbum from '../assets/missing_album.png';
import {COLORS} from './theme';
import React from 'react';
import {Dimensions, Image, StyleSheet, View} from 'react-native';

const ART_SIZE = Math.min(Dimensions.get('window').width * 0.78, 360);

const styles = StyleSheet.create({
  albumCover: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  shadowWrap: {
    borderRadius: 18,
    backgroundColor: COLORS.surface,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 12},
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 16,
  },
  image: {
    width: ART_SIZE,
    height: ART_SIZE,
    borderRadius: 18,
  },
});

export default class AlbumArt extends React.Component {
  render(): JSX.Element {
    const source = this.props.artFile ? {uri: this.props.artFile} : missingAlbum;
    return (
      <View style={styles.albumCover}>
        <View style={styles.shadowWrap}>
          <Image style={styles.image} source={source} />
        </View>
      </View>
    );
  }
}
