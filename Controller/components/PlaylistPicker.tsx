import React from 'react';
import {FlatList, StyleSheet, Text, TouchableHighlight, View } from 'react-native';

export default class PlaylistPicker extends React.Component {
  render() {
    return (
      <View>
        <FlatList
          data={this.props.playlists}
          renderItem={({item}) => (
            <TouchableHighlight underlayColor="white" onPress={() => {}}>
              <Text>{item.name}</Text>
            </TouchableHighlight>
          )}
          keyExtractor={item => item.name}
        />
      </View>
    );
  }
}
