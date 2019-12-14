import AutoComplete from './AutoComplete';
import React from 'react';

export default class AttributeList extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      current: props.attributes,
    };
  }

  add(attr) {
    this.state.current.push(attr);
    this.setState({current: this.state.current});
  }

  remove(index) {
    this.state.current.splice(index, 1);
    this.setState({current: this.state.current});
  }

  getAttributes() {
    return this.state.current.map((attr, index) => {
      return (
        <div className="list-item" key={index}>
          {this.props.getDisplayName(attr)}
          <span onClick={() => this.remove(index)} className="close">
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
          suggestions={suggestions}
          searchFilter={this.props.searchFilter}
        />
      </div>
    );
  }
}
