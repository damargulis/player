import {COLORS, SPACING} from './theme';
import React from 'react';
import {StyleSheet, Text, TouchableHighlight, View} from 'react-native';

const styles = StyleSheet.create({
  row: {
    paddingVertical: 12,
    paddingHorizontal: SPACING.screen,
  },
  name: {
    color: COLORS.text,
    fontSize: 16,
  },
  nameActive: {
    color: COLORS.accent,
    fontSize: 16,
    fontWeight: '600',
  },
  artist: {
    color: COLORS.textSecondary,
    fontSize: 13,
    marginTop: 2,
  },
});

/** A track list row; highlights in accent color when active (currently playing). */
export default class TrackRow extends React.Component {
  render(): JSX.Element {
    return (
      <TouchableHighlight underlayColor={COLORS.surfaceLight} onPress={this.props.onPress}>
        <View style={styles.row}>
          <Text style={this.props.active ? styles.nameActive : styles.name} numberOfLines={1}>
            {this.props.name}
          </Text>
          <Text style={styles.artist} numberOfLines={1}>{this.props.artist}</Text>
        </View>
      </TouchableHighlight>
    );
  }
}
