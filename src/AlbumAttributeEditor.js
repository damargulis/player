import AttributeList from './AttributeList';
import Library from './library/Library';
import PropTypes from 'prop-types';
import React from 'react';

export default class AlbumAttributeEditor extends React.Component {
  render() {
    return (
      <AttributeList
        attributes={this.props.albumIds}
        getDisplayName={(albumId) => {
          return this.props.library.getAlbumById(albumId).name;
        }}
        label="Albums"
        searchFilter={(input, suggest) => {
          const album = this.props.library.getAlbumById(suggest);
          // todo: include artist, genre etc in search
          const name = album.name.toLowerCase();
          return name.indexOf(input.toLowerCase()) > -1;
        }}
        suggestions={
          this.props.library.getAlbums().map((album) => album.id)
        }
      />
    );
  }
}

AlbumAttributeEditor.propTypes = {
  albumIds: PropTypes.arrayOf(PropTypes.number).isRequired,
  library: PropTypes.instanceOf(Library).isRequired,
};
