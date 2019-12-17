import PropTypes from 'prop-types';
import React from 'react';

export default class ToggableEditableAttribute extends React.Component {
  render() {
    return (
      <>
        {
          this.props.editing && this.props.children
        }
        <div>Edit {this.props.label}:
          <input onChange={this.props.toggleEdit} type="checkbox" />
        </div>
      </>
    );
  }
}

ToggableEditableAttribute.propTypes = {
  children: PropTypes.element.isRequired,
  editing: PropTypes.bool.isRequired,
  label: PropTypes.string.isRequired,
  toggleEdit: PropTypes.func.isRequired,
};
