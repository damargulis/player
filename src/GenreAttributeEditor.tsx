import {Genre} from './redux/actionTypes';
import AttributeList from './AttributeList';
import React from 'react';
import {connect} from 'react-redux';
import {getGenreById, getGenres} from './redux/selectors';
import {RootState} from './redux/store';

interface OwnProps {
  genreIds: string[];
}

interface StateProps {
  allGenres: string[];
  getGenreById(id: string): Genre;
}

type GenreAttributeEditorProps = OwnProps & StateProps;

class GenreAttributeEditor extends React.Component<GenreAttributeEditorProps> {
  public render(): JSX.Element {
    return (
      <AttributeList
        attributes={this.props.genreIds}
        getDisplayName={(genreId) => this.props.getGenreById(genreId).name}
        label="Genres"
        searchFilter={(input, suggest) => {
          const genre = this.props.getGenreById(suggest).name;
          return genre.toLowerCase().indexOf(input.toLowerCase()) > -1;
        }}
        suggestions={this.props.allGenres}
      />
    );
  }
}

function mapStateToProps(store: RootState): StateProps {
  return {
    allGenres: getGenres(store).map((genre) => genre.name),
    getGenreById: (id: string) => getGenreById(store, id),
  };
}

export default connect(mapStateToProps)(GenreAttributeEditor);
