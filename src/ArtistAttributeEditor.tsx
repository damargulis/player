import {Artist} from './redux/actionTypes';
import AttributeList from './AttributeList';
import React from 'react';
import {connect} from 'react-redux';
import {getAllArtistIds, getArtistById} from './redux/selectors';
import {RootState} from './redux/store';

interface OwnProps {
  artistIds: string[];
}

interface StateProps {
  allIds: string[];
  getArtistById(id: string): Artist;
}

type ArtistAttributeEditorProps = OwnProps & StateProps;

class ArtistAttributeEditor extends React.Component<ArtistAttributeEditorProps> {
  public render(): JSX.Element {
    return (
      <AttributeList
        attributes={this.props.artistIds}
        getDisplayName={(artistId: string) => {
          return this.props.getArtistById(artistId).name;
        }}
        label="Artists"
        searchFilter={(input: string, suggest: string) => {
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
    getArtistById: (id: string) => getArtistById(state, id),
  };
}

export default connect(mapStateToProps)(ArtistAttributeEditor);
