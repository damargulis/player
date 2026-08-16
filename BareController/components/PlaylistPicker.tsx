import ListRow, {ListSeparator} from './ListRow';
import {COLORS} from './theme';
import React from 'react';
import {FlatList, StyleSheet, View} from 'react-native';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
});

export default class PlaylistPicker extends React.Component {
  render(): JSX.Element {
    return (
      <View style={styles.container}>
        <FlatList
          data={this.props.playlists}
          ItemSeparatorComponent={ListSeparator}
          renderItem={({item}) => (
            <ListRow
              title={item.name}
              subtitle={item.trackIds ? `${item.trackIds.length} tracks` : undefined}
              onPress={() => this.props.navigation.navigate('Tracks', {
                playlist: item,
              })}
            />
          )}
          keyExtractor={item => item.name}
        />
      </View>
    );
  }
}
