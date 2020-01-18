import Artist from './library/Artist';
import AttributeList from './AttributeList';
import React from 'react';
import {connect} from 'react-redux';
import {getAllArtistIds, getArtistById} from './redux/selectors';
import {RootState} from './redux/store';

interface OwnProps {
  artistIds: number[];
}

interface StateProps {
  allIds: number[];
  getArtistById(id: number): Artist;
}

type ArtistAttributeEditorProps = OwnProps & StateProps;

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

function mapStateToProps(state: RootState, ownProps: OwnProps): StateProps {
  return {
    allIds: getAllArtistIds(state),
    getArtistById: (id: number) => getArtistById(state, id),
  };
}

export default connect(mapStateToProps)(ArtistAttributeEditor);
