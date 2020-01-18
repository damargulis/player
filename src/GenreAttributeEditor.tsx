import AttributeList from './AttributeList';
import React from 'react';
import {connect} from 'react-redux';
import {getGenreById, getGenres} from './redux/selectors';
import {RootState} from './redux/store';

interface OwnProps {
  genreIds: number[];
}

interface StateProps {
  allGenres: number[];
  getGenreById(id: number): string;
}

type GenreAttributeEditorProps = OwnProps & StateProps;

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

function mapStateToProps(store: RootState): StateProps {
  return {
    allGenres: [...Array(getGenres(store).length).keys()],
    getGenreById: (id: number) => getGenreById(store, id),
  };
}

export default connect(mapStateToProps)(GenreAttributeEditor);