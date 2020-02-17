import {shell} from 'electron';
import React from 'react';

interface OwnProps {
  text: string;
  link?: string;
}

type ExternalLinkProps = OwnProps;

export default class ExternalLink extends React.Component<ExternalLinkProps> {
  render(): JSX.Element {
    if (!this.props.link) {
      return (<span></span>);
    }
    return (
      <span className="link" onClick={this.openLink.bind(this)}>{this.props.text}</span>
    );
  }

  private openLink(): void {
    if (this.props.link) {
      shell.openExternal(this.props.link);
    }
  }
}
