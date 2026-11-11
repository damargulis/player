import defaultAlbum from './resources/missing_album.png';
import {MOSAIC_TILES} from './playlistSummary';
import React from 'react';
import {getImgSrc} from './utils';

interface OwnProps {
  /** Covers of the playlist's most common albums, most frequent first. */
  artFiles: string[];
}

/**
 * A playlist's artwork, built from the covers of the albums inside it.
 *
 * Playlists have no art of their own, which is what made the picker a grid of bare words. A
 * mosaic of what the playlist is mostly made of gives it a face, and is recognisable at a
 * glance in a way a name is not.
 *
 * Four covers make a 2x2. Fewer than four shows the single most common one full size rather
 * than a lopsided grid with gaps — a playlist with one album should look like that album.
 */
export default class PlaylistArt extends React.Component<OwnProps> {
  public render(): JSX.Element {
    const {artFiles} = this.props;
    if (artFiles.length < MOSAIC_TILES) {
      const file = artFiles[0];
      return (
        <div className="playlistArt single">
          <img alt="" src={file ? getImgSrc(file) : defaultAlbum} />
        </div>
      );
    }
    return (
      <div className="playlistArt mosaic">
        {artFiles.slice(0, MOSAIC_TILES).map((file, index) => (
          <img alt="" key={`${file}-${index}`} src={getImgSrc(file)} />
        ))}
      </div>
    );
  }
}
