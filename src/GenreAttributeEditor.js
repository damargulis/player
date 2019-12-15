import AttributeList from './AttributeList';
import Library from './library/Library';
import PropTypes from 'prop-types';
import React from 'react';

export default class GenreAttributeEditor extends React.Component {
  render() {
    return (
      <AttributeList
        attributes={this.props.genreIds}
        getDisplayName={(genreId) => this.props.library.getGenreById(genreId)}
        label="Genres"
        searchFilter={(input, suggest) => {
          const genre = this.props.library.getGenreById(suggest);
          return genre.toLowerCase().indexOf(input.toLowerCase()) > -1;
        }}
        suggestions={[...Array(this.props.library.getGenres().length).keys()]}
      />
    );
  }
}

GenreAttributeEditor.propTypes = {
  genreIds: PropTypes.arrayOf(PropTypes.number).isRequired,
  library: PropTypes.instanceOf(Library).isRequired,
};
