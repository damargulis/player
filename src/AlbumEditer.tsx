// TODO: rename all editer to editor lol
import {updateAlbum} from './redux/actions';
import {AlbumParams, Artist, Track} from './redux/actionTypes';
import ArtistAttributeEditor from './ArtistAttributeEditor';
import AttributeEditer from './AttributeEditer';
import FavoritesAttributeEditor from './FavoritesAttributeEditor';
import GenreAttributeEditor from './GenreAttributeEditor';
import React from 'react';
import {DragDropContext, Draggable, Droppable, DropResult} from 'react-beautiful-dnd';
import {connect} from 'react-redux';
import {getArtistById, getTrackById} from './redux/selectors';
import {RootState} from './redux/store';

interface OwnProps {
  album: AlbumParams;
  exit(): void;
}

interface StateProps {
  getArtistById(id: number): Artist;
  getTrackById(id: number): Track;
}

interface DispatchProps {
  updateAlbum(id: number, info: object): void;
}

const GRID = 4;

type AlbumEditerProps = OwnProps & StateProps & DispatchProps;

interface AlbumEditerState {
  artistIds: number[];
  genreIds: number[];
  yearsFavorited: number[];
  trackIds: number[];
}

const getListStyle = (isDraggingOver: boolean) => ({
  height: '400px',
  overflow: 'scroll',
  background: isDraggingOver ? 'lightblue' : 'lightgrey',
  padding: GRID,
  width: '100%',
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
  private name = React.createRef<AttributeEditer>();
  private year = React.createRef<AttributeEditer>();
  private playCount = React.createRef<AttributeEditer>();
  private wikiPage = React.createRef<AttributeEditer>();

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
    // const album = this.props.album;
    // if (this.name.current) {
    //   album.name = this.name.current.value;
    // }
    // if (this.year.current) {
    //   album.year = parseInt(this.year.current.value, 10);
    // }
    // if (this.playCount.current) {
    //   album.playCount = parseInt(this.playCount.current.value, 10);
    // }
    // album.favorites = this.state.yearsFavorited;
    // album.genreIds = this.state.genreIds;
    // setMemberIds(album.id, this.state.artistIds, album.artistIds, (id) => this.props.getArtistById(id).albumIds);
    // album.artistIds = this.state.artistIds;
    // if (this.wikiPage.current) {
    //   album.wikiPage = this.wikiPage.current.value;
    // }
    // setMemberIds(album.id, this.state.trackIds, album.trackIds, (id) => this.props.getTrackById(id).albumIds);
    // album.trackIds = this.state.trackIds;

    this.props.updateAlbum(this.props.album.id, {
      name: this.name.current && this.name.current.value,
      year: this.year.current && parseInt(this.year.current.value, 10),
      playCount: this.playCount.current && parseInt(this.playCount.current.value, 10),
      favorites: this.state.yearsFavorited,
      genreIds: this.state.genreIds,
      artistIds: this.state.artistIds,
      wikiPage: this.wikiPage.current && this.wikiPage.current.value,
      trackIds: this.state.trackIds,
    });
    this.props.exit();
  }

  render(): JSX.Element {
    const album = this.props.album;
    return (
      <div>
        <h3 className="title">Edit Album</h3>
        <AttributeEditer name="Name" val={album.name} ref={this.name} />
        <ArtistAttributeEditor artistIds={this.state.artistIds} />
        <AttributeEditer name="Year" val={album.year} ref={this.year} />
        <GenreAttributeEditor genreIds={this.state.genreIds} />
        <FavoritesAttributeEditor yearsFavorited={this.state.yearsFavorited} />
        <AttributeEditer name="Play Count" val={album.playCount} ref={this.playCount} />
        <AttributeEditer name="Wiki Page" val={album.wikiPage} ref={this.wikiPage} />
        <h5 className="sectionLabel">Tracks: <span onClick={this.addTrack.bind(this)} className="add">+</span></h5>
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

  private addTrack(): void {
    // TODO:
    alert('Not implemented yet! Complain if you actually want to use this');
  }
}

function mapStateToProps(state: RootState): StateProps {
  return {
    getArtistById: (id: number) => getArtistById(state, id),
    getTrackById: (id: number) => getTrackById(state, id),
  };
}

export default connect(mapStateToProps, {updateAlbum})(AlbumEditer);
