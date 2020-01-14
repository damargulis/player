import Artist from "./library/Artist";
import AttributeList from "./AttributeList";
import Library from "./library/Library";
import React from "react";
import { connect } from "react-redux";
import {RootState} from "./redux/store";
import {getArtistsByIds, getArtistById, getAllArtistIds} from "./redux/selectors";

interface ArtistAttributeEditorProps {
  artistIds: number[];
  getArtistById: (id: number) => Artist;
  allIds: number[];
}

class ArtistAttributeEditor extends React.Component<ArtistAttributeEditorProps> {
  public render(): JSX.Element {
    return (
      <AttributeList
        attributes={this.props.artistIds}
        getDisplayName={(artistId: number) => {
          return this.props.getArtistById(artistId).name;
        }}
        label="Artists"
        searchFilter={(input: string, suggest: number) => {
          const artist = this.props.getArtistById(suggest);
          const name = artist.name.toLowerCase();
          return name.indexOf(input.toLowerCase()) > -1;
        }}
        suggestions={this.props.allIds}
      />
    );
  }
}

interface OwnProps {
  artistIds: number[];
}

function mapStateToProps(state: RootState, ownProps: OwnProps) {
  return {
    artists: getArtistsByIds(state, ownProps.artistIds),
    getArtistById: (id: number) => getArtistById(state, id),
    allIds: getAllArtistIds(state),
  }
}

export default connect(mapStateToProps)(ArtistAttributeEditor);
