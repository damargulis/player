import {setGenres} from './redux/actions';
import React from 'react';
import {connect} from 'react-redux';
import {getUsedGenres} from './redux/selectors';
import {RootState} from './redux/store';

interface DispatchProps {
  setGenres(genres: string[]): void;
}

interface StateProps {
  genres: Array<{id: string; name: string}>;
}

type GenrePickerProps = DispatchProps & StateProps;

// TODO: make this a part of the pages only when its needed, send in available
// genres as a prop
class GenrePicker extends React.Component<GenrePickerProps> {

  public render(): JSX.Element {
    return (
      <div id="genre-picker">
        <select
          multiple={true}
          onChange={(evt) => this.onChange(evt)}
          size={10}
          style={{height: '100%', width: '100%'}}
        >
          {this.getOptions()}
        </select>
      </div>
    );
  }

  private getOptions(): JSX.Element[] {
    return [...this.props.genres]
      .sort((genre1, genre2) => genre1.name.localeCompare(genre2.name))
      .map((genre) => {
        return <option key={genre.id} value={genre.id}>{genre.name}</option>;
      });
  }

  private onChange(evt: React.ChangeEvent<HTMLSelectElement>): void {
    const options = [];
    for (const option of evt.target.selectedOptions) {
      options.push(option.value);
    }
    this.props.setGenres(options);
  }
}

function mapStateToProps(state: RootState): StateProps {
  return {
    genres: getUsedGenres(state),
  };
}

export default connect(mapStateToProps, {setGenres})(GenrePicker);
