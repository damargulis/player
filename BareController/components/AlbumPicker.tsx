import React from 'react';
import {AsyncStorage, FlatList, StyleSheet, Text, TouchableHighlight, View } from 'react-native';

const styles = StyleSheet.create({
  listItem: {
    fontSize: 20,
  },
});

export default class AlbumPicker extends React.Component {
  render(): JSX.Element {
    const albums = Object.values(this.props.albums);
    //TODO:why is this commented?
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
              <Text style={styles.listItem}>{item ? item.name : ''}</Text>
            </TouchableHighlight>
          )}
          keyExtractor={item => item.id}
        >
        </FlatList>
      </View>
    )
  }
}
