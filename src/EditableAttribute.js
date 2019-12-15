import PropTypes from 'prop-types';
import React from 'react';

export default class EditableAttribute extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      editing: false,
      value: props.attr,
    };

    this.input = React.createRef();
  }

  componentDidUpdate(prevProps) {
    if (this.props.attr !== prevProps.attr) {
      this.setState({value: this.props.attr});
    }
  }

  edit() {
    this.setState({
      editing: true,
    }, () => {
      this.input.current.focus();
    });
  }

  onChange(evt) {
    this.setState({
      value: evt.target.value,
    });
  }

  save() {
    this.setState({
      editing: false,
    });
    this.props.onSave(this.state.value);
  }

  onKeyUp(evt) {
    if (evt.key === "Enter") {
      this.save();
    }
  }

  render() {
    return (
      <div>
        <input
          onBlur={this.save.bind(this)}
          onChange={this.onChange.bind(this)}
          onKeyUp={this.onKeyUp.bind(this)}
          ref={this.input}
          style={{display: this.state.editing ? '' : 'none'}}
          value={this.state.value}
        >
        </input>
        <div style={{display: this.state.editing ? 'none' : ''}}>
          {this.state.value}
          <button onClick={this.edit.bind(this)}>Edit</button>
        </div>
      </div>
    );
  }
}

EditableAttribute.propTypes = {
  attr: PropTypes.object.isRequired,
  onSave: PropTypes.func.isRequired,
};
