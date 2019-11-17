
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
    console.log('editable updated');
    if (this.props.attr != prevProps.attr) {
      console.log('and setting state');
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
          style={{display: this.state.editing ? '' : 'none'}}
          ref={this.input}
          onChange={this.onChange.bind(this)}
          onKeyUp={this.onKeyUp.bind(this)}
          onBlur={this.save.bind(this)}
          value={this.state.value}
        ></input>
        <div style={{display: this.state.editing ? 'none' : ''}}>
          {this.state.value}
          <button onClick={this.edit.bind(this)}>Edit</button>
        </div>
      </div>
    );
  }
}
