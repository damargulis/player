import {shell} from 'electron';
import React from 'react';

interface OwnProps {
  wikiPage?: string;
}

type WikiLabelProps = OwnProps;

export default class WikiLabel extends React.Component<WikiLabelProps> {
  render(): JSX.Element {
    return (
      <div>
        <label>WIki Page: </label>
        <span className="link" onClick={this.openWiki.bind(this)}>{this.props.wikiPage}</span>
      </div>
    );
  }

  private openWiki(): void {
    if (this.props.wikiPage) {
      shell.openExternal(this.props.wikiPage);
    }
  }
}
