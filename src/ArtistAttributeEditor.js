import AttributeList from './AttributeList';
import Library from './library/Library';
import PropTypes from 'prop-types';
import React from 'react';

export default class ArtistAttributeEditor extends React.Component {
  render() {
    return (
      <AttributeList
        attributes={this.props.artistIds}
        getDisplayName={(artistId) => {
          return this.props.library.getArtistById(artistId).name;
        }}
        label="Artists"
        searchFilter={(input, suggest) => {
          const artist = this.props.library.getArtistById(suggest);
          const name = artist.name.toLowerCase();
          return name.indexOf(input.toLowerCase()) > -1;
        }}
        suggestions={
          this.props.library.getArtists().map((artist) => artist.id)
        }
      />
    );
  }
}

ArtistAttributeEditor.propTypes = {
  artistIds: PropTypes.arrayOf(PropTypes.number).isRequired,
  library: PropTypes.instanceOf(Library).isRequired,
};
