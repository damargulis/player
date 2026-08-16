import favoriteImg from '../assets/favorite.png';
import {COLORS} from './theme';
import React, {Component} from 'react';
import {Image, StyleSheet, Text, TouchableOpacity, View} from 'react-native';

const styles = StyleSheet.create({
  info: {
    paddingVertical: 10,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    flex: 1,
    color: COLORS.text,
    fontSize: 22,
    fontWeight: '700',
  },
  favoriteButton: {
    paddingLeft: 16,
    paddingVertical: 4,
  },
  favoriteIcon: {
    width: 26,
    height: 26,
    tintColor: COLORS.textSecondary,
    opacity: 0.6,
  },
  favoriteIconActive: {
    width: 26,
    height: 26,
    tintColor: COLORS.accent,
  },
  artists: {
    color: COLORS.textSecondary,
    fontSize: 16,
    marginTop: 4,
  },
  album: {
    color: COLORS.textSecondary,
    fontSize: 13,
    marginTop: 2,
    opacity: 0.8,
  },
});

export default class Info extends Component {
  render(): JSX.Element {
    const albumNames = this.props.albums.map((a) => a.name).join(', ');
    const albumLine = [albumNames, this.props.track.year].filter(Boolean).join(' · ');
    return (
      <View style={styles.info}>
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={2}>
            {this.props.track.name || 'Nothing playing'}
          </Text>
          <TouchableOpacity style={styles.favoriteButton} onPress={this.props.onToggleFavorite}>
            <Image
              style={this.props.isFavorite ? styles.favoriteIconActive : styles.favoriteIcon}
              source={favoriteImg}
            />
          </TouchableOpacity>
        </View>
        <Text style={styles.artists} numberOfLines={1}>
          {this.props.artists.map((a) => a.name).join(', ')}
        </Text>
        <Text style={styles.album} numberOfLines={1}>{albumLine}</Text>
      </View>
    );
  }
}
