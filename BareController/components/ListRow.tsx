import {COLORS} from './theme';
import React from 'react';
import {Image, StyleSheet, Text, TouchableHighlight, View} from 'react-native';

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  thumb: {
    width: 44,
    height: 44,
    borderRadius: 6,
    marginRight: 14,
    backgroundColor: COLORS.surface,
  },
  thumbRound: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 14,
    backgroundColor: COLORS.surface,
  },
  textWrap: {
    flex: 1,
  },
  title: {
    color: COLORS.text,
    fontSize: 17,
  },
  subtitle: {
    color: COLORS.textSecondary,
    fontSize: 13,
    marginTop: 2,
  },
  chevron: {
    color: COLORS.textSecondary,
    fontSize: 22,
    paddingLeft: 12,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: COLORS.border,
    marginLeft: 20,
  },
});

/** A themed pressable list row with an optional thumbnail, subtitle, and chevron. */
export default class ListRow extends React.Component {
  render(): JSX.Element {
    return (
      <TouchableHighlight underlayColor={COLORS.surfaceLight} onPress={this.props.onPress}>
        <View style={styles.row}>
          {this.props.image ?
            <Image
              style={this.props.imageRound ? styles.thumbRound : styles.thumb}
              source={this.props.image}
            /> : null}
          <View style={styles.textWrap}>
            <Text style={styles.title} numberOfLines={1}>{this.props.title}</Text>
            {this.props.subtitle ?
              <Text style={styles.subtitle} numberOfLines={1}>{this.props.subtitle}</Text> : null}
          </View>
          <Text style={styles.chevron}>›</Text>
        </View>
      </TouchableHighlight>
    );
  }
}

export function ListSeparator(): JSX.Element {
  return <View style={styles.separator} />;
}
