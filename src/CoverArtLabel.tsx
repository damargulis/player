import MetaRow from './MetaRow';
import React from 'react';

interface OwnProps {
  /** Runs the Cover Art extension for this album alone. */
  onRun(): Promise<void>;
}

/**
 * "Cover art: none", with a button to fetch one.
 *
 * Only rendered for an album that has no art at all — 32 of them here. Everything about a cover
 * that exists lives in `ArtZoom`: the resolution was on the page as "Cover art: 220 × 220",
 * which is a line of text on every album page to serve the handful you would act on, and the
 * Run button beside it was the one thing the number was for. Clicking the art shows both.
 *
 * An album with no art has nothing to click, so this is the only way in.
 */
export default class CoverArtLabel extends React.Component<OwnProps> {
  public render(): JSX.Element {
    return (
      <MetaRow
        label="Cover art"
        onRun={this.props.onRun}
        runTitle="Fetch the largest cover the Cover Art Archive has for this album"
        value="none"
      />
    );
  }
}
