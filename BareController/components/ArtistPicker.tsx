import AsyncStorage from '@react-native-async-storage/async-storage';
import React from 'react';
import {FlatList, StyleSheet, Text, TouchableHighlight, View } from 'react-native';

const styles = StyleSheet.create({
  listItem: {
    fontSize: 24,
  }
});

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
              <Text style={styles.listItem}>{item.name}</Text>
            </TouchableHighlight>
          )}
          keyExtractor={item => item.id}
        >
        </FlatList>
      </View>
    )
  }
}
