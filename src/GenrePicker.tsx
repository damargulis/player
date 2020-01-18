import React from "react";
import { connect } from "react-redux";
import { getGenres } from "./redux/selectors";
import { RootState } from "./redux/store";

interface OwnProps {
  setGenres(genres: number[]): void;
}

interface StateProps {
  genres: string[];
}

type GenrePickerProps = OwnProps & StateProps;

interface GenreElement {
  html: JSX.Element;
  value: string;
}

// TODO: make this a part of the pages only when its needed, send in available
// genres as a prop
class GenrePicker extends React.Component<GenrePickerProps> {

  public render(): JSX.Element {
    return (
      <div id="genre-picker">
        <select multiple onChange={ this.onChange.bind(this)} size={ 10}
          style={ { height: "100%", width: "100%"}}
        >
          {
            this.getOptions()
          }
        </select>
      </div>
    );
  }

  private getOptions(): JSX.Element[] {
    return this.props.genres.map((genre: string, index: number) => {
      return {
        html: <option key={ genre} value={ index}>{ genre}</option>,
        value: genre,
      };
    }).sort((option1: GenreElement, option2: GenreElement) => {
      return option1.value.localeCompare(option2.value);
    }).map((option: GenreElement) => {
      return option.html;
    });
  }

  private onChange(evt: React.ChangeEvent<HTMLSelectElement>): void {
    const options = [];
    for (const option of evt.target.selectedOptions) {
      options.push(parseInt(option.value, 10));
    }
    this.props.setGenres(options);
  }
}

function mapStateToProps(state: RootState): StateProps {
  return {
    genres: getGenres(state),
  };
}

export default connect(mapStateToProps)(GenrePicker);
