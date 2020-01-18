import React from "react";

interface ToggableEditableAttributeProps {
  editing: boolean;
  label: string;
  toggleEdit(editing: boolean): void;
}

export default class ToggableEditableAttribute extends React.Component<ToggableEditableAttributeProps> {
  public render(): JSX.Element {
    return (
      <>
        {this.props.editing && this.props.children}
        <div>Edit {this.props.label}:
          <input onChange={this.toggleEdit.bind(this)} type="checkbox" />
        </div>
      </>
    );
  }

  private toggleEdit(evt: React.ChangeEvent<HTMLInputElement>): void {
    this.props.toggleEdit(evt.target.checked);
  }
}
