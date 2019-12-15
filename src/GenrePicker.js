import Library from './library/Library';
import PropTypes from 'prop-types';
import React from 'react';

// TODO: make this a part of the pages only when its needed, send in available
// genres as a prop
export default class GenrePicker extends React.Component {
  getOptions() {
    return this.props.library.getGenres().map((genre, index) => {
      return {
        html: <option key={genre} value={index}>{genre}</option>,
        value: genre,
      };
    }).sort((option1, option2) => {
      return option1.value.localeCompare(option2.value);
    }).map((option) => {
      return option.html;
    });
  }

  onChange(evt) {
    const options = [];
    for (const option of evt.target.selectedOptions) {
      options.push(parseInt(option.value));
    }
    this.props.setGenres(options);
  }

  render() {
    return (
      <div id="genre-picker">
        <select multiple onChange={this.onChange.bind(this)} size={10}
          style={{height: '100%', width: '100%'}}
        >
          {
            this.getOptions()
          }
        </select>
      </div>
    );
  }
}

GenrePicker.propTypes = {
  library: PropTypes.instanceOf(Library).isRequired,
  setGenres: PropTypes.func.isRequired,
};
