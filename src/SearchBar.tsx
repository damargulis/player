import React from 'react';

interface SearchBarProps {
  onSearch: (search: string) => void;
}

interface SearchBarState {
  value: string;
}

export default class SearchBar extends React.Component<SearchBarProps,SearchBarState> {
  searchDebounce?: number;

  constructor(props: SearchBarProps) {
    super(props);

    this.state = {
      value: '',
    };
  }

  onChange(evt: React.ChangeEvent<HTMLInputElement>) {
    this.setState({
      value: evt.target.value,
    });

    if (this.searchDebounce) {
      window.clearInterval(this.searchDebounce);
    }
    this.searchDebounce = window.setTimeout(() => {
      this.props.onSearch(this.state.value);
    }, 200);
  }

  render() {
    return (
      <input
        onChange={this.onChange.bind(this)}
        placeholder="Search"
        value={this.state.value}
      />
    );
  }
}
