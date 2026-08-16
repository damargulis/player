import missingAlbum from '../assets/missing_album.png';
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

export default class AlbumPicker extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      query: '',
    };
  }

  render(): JSX.Element {
    let albums = Object.values(this.props.albums);
    //TODO:why is this commented?
    //albums.sort((a, b) => a.name.localeCompare(b.name));
    const query = this.state.query.trim().toLowerCase();
    if (query) {
      albums = albums.filter((album) => album && album.name && album.name.toLowerCase().includes(query));
    }
    return (
      <View style={styles.container}>
        <SearchBar
          value={this.state.query}
          onChangeText={(query) => this.setState({query})}
          placeholder="Search albums"
        />
        <FlatList
          data={albums}
          keyboardShouldPersistTaps="handled"
          ItemSeparatorComponent={ListSeparator}
          renderItem={({item}) => (
            <ListRow
              title={item ? item.name : ''}
              image={item && item.albumArtFile ? {uri: item.albumArtFile} : missingAlbum}
              subtitle={item && item.trackIds ? `${item.trackIds.length} tracks` : undefined}
              onPress={() => this.props.navigation.navigate('Album', {albumId: item.id})}
            />
          )}
          keyExtractor={item => item.id}
        />
      </View>
    )
  }
}
