import Artist from "./library/Artist";
import AttributeList from "./AttributeList";
import Library from "./library/Library";
import React from "react";

interface ArtistAttributeEditorProps {
  artistIds: number[];
  library: Library;
}

export default class ArtistAttributeEditor extends React.Component<ArtistAttributeEditorProps, {}> {
  public render() {
    return (
      <AttributeList
        attributes={this.props.artistIds}
        getDisplayName={(artistId: number) => {
          return this.props.library.getArtistById(artistId).name;
        }}
        label="Artists"
        searchFilter={(input: string, suggest: number) => {
          const artist = this.props.library.getArtistById(suggest);
          const name = artist.name.toLowerCase();
          return name.indexOf(input.toLowerCase()) > -1;
        }}
        suggestions={
          this.props.library.getArtists().map((artist: Artist) => artist.id)
        }
      />
    );
  }
}
