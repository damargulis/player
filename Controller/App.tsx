import React from 'react';
import {StyleSheet, Text, View } from 'react-native';
import Controls from './components/Controls';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'stretch',
    justifyContent: 'center',
  },
  info: {
    flex: 1,
    backgroundColor: 'blue',
  },
  albumCover: {
    flex: 5,
    backgroundColor: 'green',
  },
  progress: {
    flex: 1,
    backgroundColor: 'red',
  },
});

export default function App() {
  return (
    <View style={styles.container}>
      <View style={styles.info}><Text>Info</Text></View>
      <View style={styles.albumCover}><Text>Picture</Text></View>
      <View style={styles.progress}><Text>Progress</Text></View>
      <Controls />
    </View>
  );
}
