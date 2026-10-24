import {subscribeUnseen, unseenCount} from './concerts/alerts';
import './PlaylistTypePicker.css';
import React from 'react';

interface PlaylistTypePickerProps {
  setType(playlistType: string): void;
}

// TODO: Change name to like PagePicker or something, playlist type is too confusing with other playlist stuff
interface PlaylistTypePickerState {
  unseen: number;
}

export default class PlaylistTypePicker
  extends React.Component<PlaylistTypePickerProps, PlaylistTypePickerState> {
  private unsubscribe?: () => void;

  constructor(props: PlaylistTypePickerProps) {
    super(props);
    this.state = {unseen: unseenCount()};
  }

  public componentDidMount(): void {
    this.unsubscribe = subscribeUnseen(() => this.setState({unseen: unseenCount()}));
  }

  public componentWillUnmount(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
    }
  }

  public render(): JSX.Element {
    return (
      <div id="playlist-picker">
        <select size={8} className="playlist-type-container">
          <option onClick={() => this.props.setType('album')} className="playlist-type-option" >Albums</option>
          <option onClick={() => this.props.setType('artist')} className="playlist-type-option" >Artists</option>
          <option onClick={() => this.props.setType('track')} className="playlist-type-option" >Tracks</option>
          <option onClick={() => this.props.setType('playlist')} className="playlist-type-option" >Playlists</option>
          <option onClick={() => this.props.setType('new')} className="playlist-type-option">New Tracks</option>
          <option onClick={() => this.props.setType('stats')} className="playlist-type-option">Stats</option>
          <option onClick={() => this.props.setType('dj')} className="playlist-type-option">DJ</option>
          <option onClick={() => this.props.setType('concerts')} className="playlist-type-option">
            {this.state.unseen ? `Concerts (${this.state.unseen})` : 'Concerts'}
          </option>
        </select>
      </div>
    );
  }
}
