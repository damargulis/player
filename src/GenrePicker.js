import React from 'react';

export default class GenrePicker extends React.Component {
  getOptions() {
    return this.props.library.getGenres().map((genre, index) => {
      return {
        html: <option value={index} key={index}>{genre}</option>,
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
        <select onChange={this.onChange.bind(this)} multiple size={10}
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
