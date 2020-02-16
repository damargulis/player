import {Genre} from './redux/actionTypes';
import AttributeList from './AttributeList';
import React from 'react';
import {connect} from 'react-redux';
import {getAllGenreIds, getGenreById} from './redux/selectors';
import {RootState} from './redux/store';

interface OwnProps {
  genreIds: string[];
}

interface StateProps {
  allGenreIds: string[];
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
        searchFilter={(input: string, suggest: string) => {
          const genre = this.props.getGenreById(suggest);
          return genre.name.toLowerCase().indexOf(input.toLowerCase()) > -1;
        }}
        suggestions={this.props.allGenreIds}
      />
    );
  }
}

function mapStateToProps(store: RootState): StateProps {
  return {
    allGenreIds: getAllGenreIds(store),
    getGenreById: (id: string) => getGenreById(store, id),
  };
}

export default connect(mapStateToProps)(GenreAttributeEditor);
