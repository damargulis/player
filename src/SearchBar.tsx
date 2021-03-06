import React from 'react';

interface SearchBarProps {
  onSearch(search: string): void;
}

interface SearchBarState {
  value: string;
}

export default class SearchBar extends React.Component<SearchBarProps, SearchBarState> {
  private searchDebounce?: number;

  constructor(props: SearchBarProps) {
    super(props);

    this.state = {value: ''};
  }

  public render(): JSX.Element {
    return (
      <input
        onChange={(evt) => this.onChange(evt)}
        placeholder="Search"
        value={this.state.value}
      />
    );
  }

  private onChange(evt: React.ChangeEvent<HTMLInputElement>): void {
    this.setState({value: evt.target.value});

    if (this.searchDebounce) {
      window.clearInterval(this.searchDebounce);
    }
    this.searchDebounce = window.setTimeout(() => {
      this.props.onSearch(this.state.value);
    }, 200);
  }
}
