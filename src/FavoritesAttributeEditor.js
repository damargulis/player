import AttributeList from './AttributeList';
import PropTypes from 'prop-types';
import React from 'react';

export default class FavoritesAttributeEditor extends React.Component {
  render() {
    return (
      <AttributeList
        attributes={this.props.yearsFavorited}
        // TODO: make this the default
        getDisplayName={(year) => year}
        label="Years Favorited"
        // TODO: make this the default
        searchFilter={(input, year) => {
          return year.toString().toLowerCase().indexOf(
            input.toLowerCase()) > -1;
        }}
        // TODO: better way of suggesting years
        suggestions={[2015, 2016, 2017, 2018, 2019]}
      />
    );
  }
}

FavoritesAttributeEditor.propTypes = {
  yearsFavorited: PropTypes.arrayOf(PropTypes.number).isRequired,
};
