import React from "react";
import AttributeList from "./AttributeList";
import Album from "./library/Album";
import Library from "./library/Library";

interface AlbumAttributeEditorProps {
  albumIds: number[];
  library: Library;
}

export default class AlbumAttributeEditor extends React.Component<AlbumAttributeEditorProps, {}> {
  public render() {
    return (
      <AttributeList
        attributes={this.props.albumIds}
        getDisplayName={(albumId: number) => {
          return this.props.library.getAlbumById(albumId).name;
        }}
        label="Albums"
        searchFilter={(input: string, suggest: number) => {
          const album = this.props.library.getAlbumById(suggest);
          // todo: include artist, genre etc in search
          const name = album.name.toLowerCase();
          return name.indexOf(input.toLowerCase()) > -1;
        }}
        suggestions={
          this.props.library.getAlbums().map((album: Album) => album.id)
        }
      />
    );
  }
}
