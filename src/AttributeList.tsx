import AutoComplete from './AutoComplete';
import React from 'react';

interface AttributeListProps {
  attributes: string[];
  label: string;
  suggestions: string[];
  getDisplayName(id: string): string;
  searchFilter(input: string, id: string): boolean;
}

interface AttributeListState {
  current: string[];
}

export default class AttributeList extends React.Component<AttributeListProps, AttributeListState> {
  constructor(props: AttributeListProps) {
    super(props);

    this.state = {
      current: props.attributes,
    };
  }

  public render(): JSX.Element {
    const suggestions = this.props.suggestions.filter((attr) => {
      return !this.state.current.includes(attr);
    });
    return (
      <div className="edit-constructor">
        <label className="label">{this.props.label}: </label>
        {this.getAttributes()}
        <AutoComplete
          getDisplayName={this.props.getDisplayName}
          onSubmit={(attr) => this.add(attr)}
          searchFilter={this.props.searchFilter}
          suggestions={suggestions}
        />
      </div>
    );
  }

  private add(attr: string): void {
    this.state.current.push(attr);
    this.setState({current: this.state.current});
  }

  private remove(index: number): void {
    this.state.current.splice(index, 1);
    this.setState({current: this.state.current});
  }

  private getAttributes(): JSX.Element[] {
    return this.state.current.map((attr, index) => {
      return (
        <div className="list-item" key={index}>
          {this.props.getDisplayName(attr)}
          <span className="close" onClick={() => this.remove(index)}>
            X
          </span>
        </div>
      );
    });
  }
}
