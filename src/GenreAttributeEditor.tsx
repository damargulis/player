import AttributeList from "./AttributeList";
import Library from "./library/Library";
import React from "react";
import { connect } from "react-redux";
import {RootState} from "./redux/store";
import {getGenres, getGenreById} from "./redux/selectors";

interface GenreAttributeEditorProps {
  genreIds: number[];
  getGenreById: (id: number) => string;
  allGenres: number[];
}

class GenreAttributeEditor extends React.Component<GenreAttributeEditorProps> {
  public render(): JSX.Element {
    return (
      <AttributeList
        attributes={this.props.genreIds}
        getDisplayName={(genreId) => this.props.getGenreById(genreId)}
        label="Genres"
        searchFilter={(input, suggest) => {
          const genre = this.props.getGenreById(suggest);
          return genre.toLowerCase().indexOf(input.toLowerCase()) > -1;
        }}
        suggestions={this.props.allGenres}
      />
    );
  }
}

function mapStateToProps(store: RootState) {
  return {
    getGenreById: (id: number) => getGenreById(store, id),
    allGenres: [...Array(getGenres(store).length).keys()]
  }
}

export default connect(mapStateToProps)(GenreAttributeEditor);
