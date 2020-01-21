import React from 'react';

interface OwnProps {
  name: string;
  val?: string | number;
}

type AttributeEditorProps = OwnProps;

export default class AttributeEditer extends React.Component<OwnProps,{}> {
  private innerRef = React.createRef<HTMLInputElement>();
  get value(): string {
    return this.innerRef.current!.value;
  }

  render() {
    return (
      <div className="edit-container">
        <label className="label">{this.props.name}: </label>
        <input className="input" defaultValue={this.props.val} placeholder={this.props.name} ref={this.innerRef} type={typeof this.props.val}/>
      </div>
    )
  }

}
