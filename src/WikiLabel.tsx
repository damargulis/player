import MetaRow from './MetaRow';
import React from 'react';

interface OwnProps {
  wikiPage?: string;
  /**
   * When given, renders a small Run button inline with the field.
   *
   * Return the promise: `MetaRow` then shows a pending state and puts a failure beside the row.
   * These two used to take a plain `void` and the callers dropped the promise, so a failed run
   * was entirely silent and the button never looked busy.
   */
  onRun?(): void | PromiseLike<void>;
}

export default class WikiLabel extends React.Component<OwnProps> {
  public render(): JSX.Element {
    return (
      <MetaRow
        label="Wiki Page"
        link={this.props.wikiPage}
        onRun={this.props.onRun}
        runTitle="Run the Wiki extension for this item"
        value={this.props.wikiPage}
      />
    );
  }
}
