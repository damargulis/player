import {COLORS, SPACING} from './theme';
import React from 'react';
import {StyleSheet, TextInput, View} from 'react-native';

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: SPACING.screen,
    paddingTop: 10,
    paddingBottom: 6,
  },
  input: {
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    color: COLORS.text,
    fontSize: 15,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
});

/** A themed search input; filtering is done by the parent via onChangeText. */
export default class SearchBar extends React.Component {
  render(): JSX.Element {
    return (
      <View style={styles.wrap}>
        <TextInput
          style={styles.input}
          value={this.props.value}
          onChangeText={this.props.onChangeText}
          placeholder={this.props.placeholder}
          placeholderTextColor={COLORS.textSecondary}
          autoCapitalize="none"
          autoCorrect={false}
          clearButtonMode="while-editing"
          returnKeyType="search"
        />
      </View>
    );
  }
}
