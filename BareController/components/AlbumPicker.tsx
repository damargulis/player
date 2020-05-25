import React from 'react';
import {AsyncStorage, FlatList, StyleSheet, Text, TouchableHighlight, View } from 'react-native';

export default class AlbumPicker extends React.Component {
  render(): JSX.Element {
    const albums = Object.values(this.props.albums);
    //albums.sort((a, b) => a.name.localeCompare(b.name));
    return (
      <View>
        <FlatList
         data={albums}
          renderItem={({item}) => (
            <TouchableHighlight onPress={() => this.props.navigation.navigate('Tracks', {
              playlist: {
                name: item.name,
                trackIds: item.trackIds,
              }
            })}>
              <Text>Album: {item ? item.name : ''}</Text>
            </TouchableHighlight>
          )}
          keyExtractor={item => item.id}
        >
        </FlatList>
      </View>
    )
  }
}
