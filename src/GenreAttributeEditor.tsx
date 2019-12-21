import AttributeList from "./AttributeList";
import Library from "./library/Library";
import React from "react";

interface GenreAttributeEditorProps {
  genreIds: number[];
  library: Library;
}

export default class GenreAttributeEditor extends React.Component<GenreAttributeEditorProps, {}> {
  public render() {
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
