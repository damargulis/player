import React from "react";

interface EditableAttributeProps<T> {
  attr: T;
  onSave(value: T): void;
}

interface EditableAttributeState<T> {
  value: T;
  editing: boolean;
}

export default class EditableAttribute<T> extends
    React.Component<EditableAttributeProps<T>, EditableAttributeState<T>> {
  private input = React.createRef<HTMLInputElement>();

  constructor(props: EditableAttributeProps<T>) {
    super(props);
    this.state = {
      editing: false,
      value: props.attr,
    };
  }

  public componentDidUpdate(prevProps: EditableAttributeProps<T>): void {
    if (this.props.attr !== prevProps.attr) {
      this.setState({ value: this.props.attr});
    }
  }

  public render(): JSX.Element {
    return (
      <div>
        <input
          onBlur={ this.save.bind(this)}
          onChange={ this.onChange.bind(this)}
          onKeyUp={ this.onKeyUp.bind(this)}
          ref={ this.input}
          style={ { display: this.state.editing ? "" : "none"}}
          value={ this.state.value as unknown as string}
        >
        </input>
        <div style={ { display: this.state.editing ? "none" : ""}}>
          { this.state.value}
          <button onClick={ this.edit.bind(this)}>Edit</button>
        </div>
      </div>
    );
  }

  private edit(): void {
    this.setState({
      editing: true,
    }, () => {
      const node = this.input.current;
      if (node) {
        node.focus();
      }
    });
  }

  private onChange(evt: React.ChangeEvent<HTMLInputElement>): void {
    this.setState({
      value: evt.target.value as unknown as T,
    });
  }

  private save(): void {
    this.setState({
      editing: false,
    });
    this.props.onSave(this.state.value);
  }

  private onKeyUp(evt: React.KeyboardEvent): void {
    if (evt.key === "Enter") {
      this.save();
    }
  }
}
