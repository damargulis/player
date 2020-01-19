import {save} from './redux/actions';
import Album from './library/Album';
import Artist from './library/Artist';
import ArtistAttributeEditor from './ArtistAttributeEditor';
import FavoritesAttributeEditor from './FavoritesAttributeEditor';
import GenreAttributeEditor from './GenreAttributeEditor';
import React from 'react';
import {DragDropContext, Draggable, Droppable, DropResult} from 'react-beautiful-dnd';
import {connect} from 'react-redux';
import {getArtistById, getTrackById} from './redux/selectors';
import {RootState} from './redux/store';
import Track from './library/Track';

interface OwnProps {
  album: Album;
  exit(): void;
}

interface StateProps {
  getArtistById(id: number): Artist;
  getTrackById(id: number): Track;
}

interface DispatchProps {
  save(): void;
}

const GRID = 8;

type AlbumEditerProps = OwnProps & StateProps & DispatchProps;

interface AlbumEditerState {
  artistIds: number[];
  genreIds: number[];
  yearsFavorited: number[];
  trackIds: number[];
}

const getListStyle = (isDraggingOver: boolean) => ({
  background: isDraggingOver ? 'lightblue' : 'lightgrey',
  padding: GRID,
  width: 250,
});

function getItemStyle(isDragging: boolean, draggableStyle?: React.CSSProperties): React.CSSProperties {
  return {
    userSelect: 'none',
    padding: GRID * 2,
    margin: `0 0 ${GRID}px 0`,
    background: isDragging ? 'lightgreen' : 'grey',
    ...draggableStyle,
  };
}

function reorder<T>(list: T[], startIndex: number, endIndex: number): T[] {
  const result = Array.from(list);
  const [removed] = result.splice(startIndex, 1);
  result.splice(endIndex, 0, removed);
  return result;
}

class AlbumEditer extends React.Component<AlbumEditerProps, AlbumEditerState> {
  private name = React.createRef<HTMLInputElement>();
  private year = React.createRef<HTMLInputElement>();
  private playCount = React.createRef<HTMLInputElement>();
  private wikiPage = React.createRef<HTMLInputElement>();

  constructor(props: AlbumEditerProps) {
    super(props);
    const album = this.props.album;

    this.state = {
      artistIds: [...album.artistIds],
      genreIds: [...album.genreIds],
      yearsFavorited: [...album.favorites],
      trackIds: [...album.trackIds],
    };

  }

  public save(): void {
    // TODO: turn into action
    const album = this.props.album;
    if (this.name.current) {
      album.name = this.name.current.value;
    }
    if (this.year.current) {
      album.year = parseInt(this.year.current.value, 10);
    }
    if (this.playCount.current) {
      album.playCount = parseInt(this.playCount.current.value, 10);
    }
    album.favorites = this.state.yearsFavorited;
    album.genreIds = this.state.genreIds;
    this.state.artistIds.forEach((artistId) => {
      if (!album.artistIds.includes(artistId)) {
        const artist = this.props.getArtistById(artistId);
        artist.albumIds.push(album.id);
      }
    });
    album.artistIds = this.state.artistIds;
    if (this.wikiPage.current) {
      album.wikiPage = this.wikiPage.current.value;
    }
    this.state.trackIds.forEach((trackId) => {
      if (!album.trackIds.includes(trackId)) {
        const track = this.props.getTrackById(trackId);
        track.albumIds.push(album.id);
      }
    });
    album.trackIds = this.state.trackIds;

    this.props.save();
    this.props.exit();
  }

  render(): JSX.Element {
    const album = this.props.album;
    return (
      <div>
        <h3 className="title">Edit Album</h3>
        <div className="edit-container">
          <label className="label">Name: </label>
          <input className="input" defaultValue={album.name} placeholder="Name" ref={this.name} />
        </div>
        <ArtistAttributeEditor artistIds={this.state.artistIds} />
        <div className="edit-container">
          <label className="label">Year: </label>
          <input className="input" defaultValue={album.year} placeholder="Year" ref={this.year} type="number" />
        </div>
        <GenreAttributeEditor genreIds={this.state.genreIds} />
        <FavoritesAttributeEditor yearsFavorited={this.state.yearsFavorited} />
        <div className="edit-container">
          <label className="label">Play Count:</label>
          <input className="input" defaultValue={album.playCount} ref={this.playCount} type="number" />
        </div>
        <div className="edit-container">
          <label className="label">Wiki page:</label>
          <input className="input" defaultValue={album.wikiPage} ref={this.wikiPage} />
        </div>
        <DragDropContext onDragEnd={this.onDragEnd.bind(this)} >
          <Droppable droppableId="droppable">
            {(provided, snapshot) => (
              <div
                {...provided.droppableProps}
                ref={provided.innerRef}
                style={getListStyle(snapshot.isDraggingOver)}
              >
                {this.state.trackIds.map((track, index) => (
                  <Draggable key={track} draggableId={track.toString()} index={index}>
                    {(innerProvided, innerSnapshot) => (
                      <div
                        ref={innerProvided.innerRef}
                        {...innerProvided.draggableProps}
                        {...innerProvided.dragHandleProps}
                        style={getItemStyle(
                          innerSnapshot.isDragging,
                          innerProvided.draggableProps.style
                        )}
                      >
                        {`${index + 1}. ${this.props.getTrackById(track).name}`}
                        <span className="remove" onClick={() => this.removeTrack(index)}>X</span>
                      </div>
                    )}
                  </Draggable>
                ))}
              {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
        <div className="bottom-bar">
          <button onClick={this.save.bind(this)}>Save</button>
          <button onClick={this.props.exit}>Cancel</button>
        </div>
      </div>
    );
  }

  private onDragEnd(result: DropResult): void {
    if (!result.destination) {
      return;
    }

    const trackIds = reorder(
      this.state.trackIds,
      result.source.index,
      result.destination.index
    );
    this.setState({trackIds});
  }

  private removeTrack(index: number): void {
    const trackIds = this.state.trackIds;
    trackIds.splice(index, 1);
    this.setState({trackIds});
  }
}

function mapStateToProps(state: RootState): StateProps {
  return {
    getArtistById: (id: number) => getArtistById(state, id),
    getTrackById: (id: number) => getTrackById(state, id),
  };
}

export default connect(mapStateToProps, {save})(AlbumEditer);
