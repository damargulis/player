import {shell} from 'electron';
import React from 'react';

interface OwnProps {
  wikiPage?: string;
  /** When given, renders a small Run button inline with the field. */
  onRun?(): void;
}

type WikiLabelProps = OwnProps;

export default class WikiLabel extends React.Component<WikiLabelProps> {
  render(): JSX.Element {
    return (
      <div className="metaRow">
        <label>Wiki Page: </label>
        <span className="link metaValue" onClick={() => this.openWiki()}>{this.props.wikiPage}</span>
        {this.props.onRun && (
          <button className="runExtension" onClick={this.props.onRun} title="Run the Wiki extension for this item">
            Run
          </button>
        )}
      </div>
    );
  }

  private openWiki(): void {
    if (this.props.wikiPage) {
      shell.openExternal(this.props.wikiPage);
    }
  }
}
