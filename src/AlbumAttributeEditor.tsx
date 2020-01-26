import {AlbumParams} from './redux/actionTypes';
import AttributeList from './AttributeList';
import React from 'react';
import {connect} from 'react-redux';
import {getAlbumById, getAlbumsByIds, getAllAlbumIds} from './redux/selectors';
import {RootState} from './redux/store';

interface StateProps {
  albums: AlbumParams[];
  allIds: number[];
  getAlbumById(albumId: number): AlbumParams;
}

interface OwnProps {
  albumIds: number[];
}

type AlbumAttributeEditorProps = OwnProps & StateProps;

class AlbumAttributeEditor extends React.Component<AlbumAttributeEditorProps> {
  public render(): JSX.Element {
    return (
      <AttributeList
        attributes={this.props.albumIds}
        getDisplayName={(albumId: number) => {
          return this.props.getAlbumById(albumId).name;
        }}
        label="Albums"
        searchFilter={(input: string, suggest: number) => {
          const album = this.props.getAlbumById(suggest);
          // TODO: include artist, genre etc in search
          const name = album.name.toLowerCase();
          return name.indexOf(input.toLowerCase()) > -1;
        }}
        suggestions={this.props.allIds}
      />
    );
  }
}

function mapStateToProps(state: RootState, ownProps: OwnProps): StateProps {
  return {
    albums: getAlbumsByIds(state, ownProps.albumIds),
    allIds: getAllAlbumIds(state),
    getAlbumById: (albumId: number) => getAlbumById(state, albumId),
  };
}

export default connect(mapStateToProps)(AlbumAttributeEditor);
