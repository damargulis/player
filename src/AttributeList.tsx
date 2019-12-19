import AutoComplete from './AutoComplete';
import React from 'react';

interface AttributeListProps {
  attributes: number[];
  getDisplayName: (id: number) => string;
  label: string;
  searchFilter: (input: string, id: number) => boolean;
  suggestions: number[];
}

interface AttributeListState {
  current: number[];
}

export default class AttributeList extends React.Component<AttributeListProps,AttributeListState> {
  constructor(props: AttributeListProps) {
    super(props);

    this.state = {
      current: props.attributes,
    };
  }

  add(attr: number) {
    this.state.current.push(attr);
    this.setState({current: this.state.current});
  }

  remove(index: number) {
    this.state.current.splice(index, 1);
    this.setState({current: this.state.current});
  }

  getAttributes() {
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

  render() {
    const suggestions = this.props.suggestions.filter((attr, index) => {
      return !this.state.current.includes(index);
    });
    return (
      <div className="edit-constructor">
        <label className="label">{this.props.label}: </label>
        {this.getAttributes()}
        <AutoComplete
          getDisplayName={this.props.getDisplayName}
          onSubmit={this.add.bind(this)}
          searchFilter={this.props.searchFilter}
          suggestions={suggestions}
        />
      </div>
    );
  }
}
