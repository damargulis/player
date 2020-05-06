import ControlPage from "./components/ControlPage";
import React from 'react';
import {StyleSheet, Text, View } from 'react-native';
import {Pages} from "react-native-pages";

export default class App extends React.Component {
  render() {
    return (
      <Pages>
        <View ><Text>Downloaded Page</Text></View>
        <ControlPage />
      </Pages>
    );
  }

}
