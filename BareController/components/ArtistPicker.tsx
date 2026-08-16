import missingArtist from '../assets/missing_artist.png';
import ListRow, {ListSeparator} from './ListRow';
import SearchBar from './SearchBar';
import {COLORS} from './theme';
import React from 'react';
import {FlatList, StyleSheet, View} from 'react-native';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
});

export default class ArtistPicker extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      query: '',
    };
  }

  render(): JSX.Element {
    let artists = Object.values(this.props.artists);
    artists.sort((a, b) => a.name.localeCompare(b.name));
    const query = this.state.query.trim().toLowerCase();
    if (query) {
      artists = artists.filter((artist) => artist.name && artist.name.toLowerCase().includes(query));
    }
    return (
      <View style={styles.container}>
        <SearchBar
          value={this.state.query}
          onChangeText={(query) => this.setState({query})}
          placeholder="Search artists"
        />
        <FlatList
          data={artists}
          keyboardShouldPersistTaps="handled"
          ItemSeparatorComponent={ListSeparator}
          renderItem={({item}) => (
            <ListRow
              title={item.name}
              image={item.artFile ? {uri: item.artFile} : missingArtist}
              imageRound={true}
              subtitle={item.trackIds ? `${item.trackIds.length} tracks` : undefined}
              onPress={() => this.props.navigation.navigate('Artist', {artistId: item.id})}
            />
          )}
          keyExtractor={item => item.id}
        />
      </View>
    )
  }
}
