import AttributeList from './AttributeList';
import React from 'react';

interface FavoritesAttributeEditorProps {
  yearsFavorited: number[];
}

export default class FavoritesAttributeEditor extends React.Component<FavoritesAttributeEditorProps> {
  public render(): JSX.Element {
    const years = [];
    const maxYear = (new Date()).getFullYear();
    for (let year = 2015; year <= maxYear; year++) {
      years.push(year);
    }
    return (
      <AttributeList
        attributes={this.props.yearsFavorited}
        getDisplayName={(year) => year.toString()}
        label="Years Favorited"
        searchFilter={(input, year) => {
          return year.toString().toLowerCase().indexOf(
            input.toLowerCase()) > -1;
        }}
        suggestions={years}
      />
    );
  }
}
