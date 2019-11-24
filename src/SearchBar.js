
import React from 'react';

export default class SearchBar extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      value: '',
    }

    this.searchDebounce = null;
  }

  onChange(evt) {
    this.setState({
      value: evt.target.value,
    });

    if (this.searchDebounce) {
      clearInterval(this.searchDebounce);
    }
    this.searchDebounce = setTimeout(() => {
      this.props.onSearch(this.state.value);
    }, 200);
  }

  render() {
    return (
      <input 
        placeholder="Search"
        value={this.state.value}
        onChange={this.onChange.bind(this)}
      />
    )
  }
}
