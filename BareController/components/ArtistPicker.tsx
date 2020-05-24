import React from 'react';
import {AsyncStorage, FlatList, StyleSheet, Text, TouchableHighlight, View } from 'react-native';

export default class ArtistPicker extends React.Component {
  render(): JSX.Element {
    const artists = Object.values(this.props.artists);
    artists.sort((a, b) => a.name.localeCompare(b.name));
    return (
      <View>
        <FlatList
          data={artists}
          renderItem={({item}) => (
            <TouchableHighlight onPress={() => this.props.navigation.navigate('Tracks', {
              playlist: {
                name: item.name,
                trackIds: item.trackIds,
              }
            })}>
              <Text>{item.name}</Text>
            </TouchableHighlight>
          )}
          keyExtractor={item => item.id}
        >
        </FlatList>
      </View>
    )
  }
}
