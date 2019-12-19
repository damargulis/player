import React from 'react';

interface ToggableEditableAttributeProps {
  editing: boolean;
  label: string;
  toggleEdit: (editing: boolean) => void;
}

export default class ToggableEditableAttribute extends React.Component<ToggableEditableAttributeProps,{}> {
  toggleEdit(evt: React.ChangeEvent<HTMLInputElement>) {
    this.props.toggleEdit(evt.target.checked);
  }

  render() {
    return (
      <>
        {
          this.props.editing && this.props.children
        }
        <div>Edit {this.props.label}:
          <input onChange={this.toggleEdit} type="checkbox" />
        </div>
      </>
    );
  }
}
