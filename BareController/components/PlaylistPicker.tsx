import React from 'react';
import {FlatList, StyleSheet, Text, TouchableHighlight, View } from 'react-native';

const styles = StyleSheet.create({
  listItem: {
    fontSize: 24,
  },
});

export default class PlaylistPicker extends React.Component {
  render(): JSX.Element {
    return (
      <View>
        <FlatList
          data={this.props.playlists}
          renderItem={({item}) => (
            <TouchableHighlight underlayColor="white" onPress={() => this.props.navigation.navigate('Tracks', {
              playlist: item,
            })}>
              <Text style={styles.listItem}>{item.name}</Text>
            </TouchableHighlight>
          )}
          keyExtractor={item => item.name}
        />
      </View>
    );
  }
}
