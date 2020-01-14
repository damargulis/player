import Album from "./library/Album";
import AttributeList from "./AttributeList";
import Library from "./library/Library";
import React from "react";
import { connect } from "react-redux";
import {RootState} from "./redux/store";
import {getAlbumsByIds, getAlbumById, getAllAlbumIds} from "./redux/selectors";

interface AlbumAttributeEditorProps {
  albumIds: number[];
  albums: Album[];
  getAlbumById: (albumId: number) => Album;
  allIds: number[];
}

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
          // todo: include artist, genre etc in search
          const name = album.name.toLowerCase();
          return name.indexOf(input.toLowerCase()) > -1;
        }}
        suggestions={this.props.allIds}
      />
    );
  }
}

interface OwnProps {
  albumIds: number[];
}

function mapStateToProps(state: RootState, ownProps: OwnProps) {
  return {
    albums: getAlbumsByIds(state, ownProps.albumIds),
    getAlbumById: (albumId: number) => getAlbumById(state, albumId),
    allIds: getAllAlbumIds(state),
  }
}

export default connect(mapStateToProps)(AlbumAttributeEditor);
