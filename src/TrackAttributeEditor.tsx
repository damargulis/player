import {Track} from './redux/actionTypes';
import React from 'react';
import {DragDropContext, Draggable, Droppable, DropResult} from 'react-beautiful-dnd';
import {connect} from 'react-redux';
import {getTrackById} from './redux/selectors';
import {RootState} from './redux/store';

const GRID = 4;

function reorder<T>(list: T[], startIndex: number, endIndex: number): T[] {
  const result = Array.from(list);
  const [removed] = result.splice(startIndex, 1);
  result.splice(endIndex, 0, removed);
  return result;
}

function getItemStyle(isDragging: boolean, draggableStyle?: React.CSSProperties): React.CSSProperties {
  return {
    userSelect: 'none',
    padding: GRID * 2,
    margin: `0 0 ${GRID}px 0`,
    background: isDragging ? 'lightgreen' : 'grey',
    ...draggableStyle,
  };
}

const getListStyle = (isDraggingOver: boolean) => ({
  height: '400px',
  overflow: 'scroll',
  background: isDraggingOver ? 'lightblue' : 'lightgrey',
  padding: GRID,
  width: '100%',
});

interface OwnProps {
  trackIds: string[];
  setIds(ids: string[]): void;
}

interface StateProps {
  getTrackById(id: string): Track;
}

type TrackAttributeEditorProps = OwnProps & StateProps;

class TrackAttributeEditor extends React.Component<TrackAttributeEditorProps> {

  render(): JSX.Element {
    return (
      <div>
        <h5 className="sectionLabel">Tracks: <span onClick={this.addTrack.bind(this)} className="add">+</span></h5>
        <DragDropContext onDragEnd={this.onDragEnd.bind(this)} >
          <Droppable droppableId="droppable">
            {(provided, snapshot) => (
              <div
                {...provided.droppableProps}
                ref={provided.innerRef}
                style={getListStyle(snapshot.isDraggingOver)}
              >
                {this.props.trackIds.map((track, index) => (
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
      </div>
    );
  }
  private addTrack(): void {
    // TODO:
    alert('Not implemented yet! Complain if you actually want to use this');
  }

  private onDragEnd(result: DropResult): void {
    if (!result.destination) {
      return;
    }

    const trackIds = reorder(
      this.props.trackIds,
      result.source.index,
      result.destination.index
    );
    this.props.setIds(trackIds);
  }

  private removeTrack(index: number): void {
    const trackIds = this.props.trackIds;
    trackIds.splice(index, 1);
    this.props.setIds(trackIds);
  }

}

function mapStateToProps(state: RootState): StateProps {
  return {
    getTrackById: (id: string) => getTrackById(state, id),
  };
}

export default connect(mapStateToProps)(TrackAttributeEditor);
