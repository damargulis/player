import {Playlist} from './redux/actionTypes';
import {memoize} from './redux/memo';
import PlaylistArt from './PlaylistArt';
import './PlaylistPicker.css';
import {describeLength, PlaylistSummary, summarise} from './playlistSummary';
import React from 'react';
import {connect} from 'react-redux';
import SearchBar from './SearchBar';
import {getAutoPlaylists, getPlaylists} from './redux/selectors';
import {RootState} from './redux/store';
import {matchesSearch} from './utils';

/** A playlist and what we can say about it, worked out once per library change. */
interface Row {
  playlist: Playlist;
  summary: PlaylistSummary;
}

interface OwnProps {
  goToPlaylist(playlist: Playlist): void;
}

interface StateProps {
  manual: Row[];
  auto: Row[];
}

interface State {
  search: string;
}

type PlaylistPickerProps = OwnProps & StateProps;

/**
 * The playlists, as a list rather than a grid.
 *
 * This reused the album grid, which exists to lay out *pictures* — and a playlist has none, so
 * every cell was a bare name in a 150px box with empty space around it. A playlist's shape is
 * textual (what is in it, how long it is, who is on it), which is a row, and the artwork is
 * built from the albums inside it rather than missing.
 *
 * The two halves are gone too. Manual and Auto each had 50% of the width and their own
 * scrollbar whatever their size, and the generated side grows with every year and every person
 * who reacts, so the split was always going to be wrong. One list, two headed sections.
 */
class PlaylistPicker extends React.Component<PlaylistPickerProps, State> {
  constructor(props: PlaylistPickerProps) {
    super(props);
    this.state = {search: ''};
  }

  public render(): JSX.Element {
    const manual = this.filter(this.props.manual);
    const auto = this.filter(this.props.auto);
    return (
      <div className="main">
        <div className="playlistPickerPage">
          <div className="playlistPickerBar">
            <SearchBar onSearch={(search: string) => this.setState({search})} />
          </div>
          <div className="playlistList">
            {this.section('Manual', manual, 'Imported from iTunes or made here.')}
            {this.section('Auto', auto, 'Built from the library and kept up to date.')}
            {!manual.length && !auto.length && (
              <div className="playlistEmpty">Nothing matches that.</div>
            )}
          </div>
        </div>
      </div>
    );
  }

  private filter(rows: Row[]): Row[] {
    return rows.filter((row) => matchesSearch(row.playlist.name, this.state.search));
  }

  /** A heading and its rows, or nothing at all when a search has emptied it. */
  private section(title: string, rows: Row[], blurb: string): JSX.Element {
    if (!rows.length) {
      return <></>;
    }
    return (
      <div className="playlistSection" key={title}>
        <div className="playlistSectionHead">
          <h3>{title}</h3>
          <span className="playlistSectionCount">{rows.length}</span>
          <span className="playlistSectionBlurb">{blurb}</span>
        </div>
        {rows.map((row, index) => this.row(row, `${title}-${index}`))}
      </div>
    );
  }

  private row(row: Row, key: string): JSX.Element {
    const {playlist, summary} = row;
    return (
      <div
        className="playlistRow"
        key={key}
        onClick={() => this.props.goToPlaylist(playlist)}
        title={playlist.name}
      >
        <PlaylistArt artFiles={summary.artFiles} />
        <div className="playlistRowText">
          <div className="playlistName">{playlist.name}</div>
          <div className="playlistMeta">{describeLength(summary)}</div>
          {/* the artists are what make one recognisable when the name does not say much */}
          {summary.topArtists.length > 0 && (
            <div className="playlistArtists">{summary.topArtists.join(', ')}</div>
          )}
        </div>
      </div>
    );
  }
}

/**
 * Both halves are memoised on `store.library`, and the rows are built here rather than in
 * `render`.
 *
 * `getPlaylists` and `getAutoPlaylists` each build a fresh array, so without this the props
 * were never shallow-equal and the page re-rendered on every action — about four times a
 * second throughout playback, each one re-summarising a 3,106-track playlist. Note the state
 * itself cannot be handed down for the same reason: `currentlyPlaying` changes on every
 * `timeupdate`, so the root object does too.
 */
function rowsFor(playlistsOf: (store: RootState) => Playlist[]): (
  library: object, store: RootState) => Row[] {
  return memoize((library: object, store: RootState) =>
    playlistsOf(store).map((playlist) => ({playlist, summary: summarise(store, playlist)})));
}

const manualRows = rowsFor(getPlaylists);
const autoRows = rowsFor(getAutoPlaylists);

function mapStateToProps(store: RootState): StateProps {
  return {
    auto: autoRows(store.library, store),
    manual: manualRows(store.library, store),
  };
}

export default connect(mapStateToProps)(PlaylistPicker);
