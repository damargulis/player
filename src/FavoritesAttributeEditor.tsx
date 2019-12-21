import AttributeList from "./AttributeList";
import React from "react";

interface FavoritesAttributeEditorProps {
  yearsFavorited: number[];
}

export default class FavoritesAttributeEditor extends React.Component<FavoritesAttributeEditorProps, {}> {
  public render() {
    return (
      <AttributeList
        attributes={this.props.yearsFavorited}
        // TODO: make this the default
        getDisplayName={(year) => year.toString()}
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
