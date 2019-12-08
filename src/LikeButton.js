import React from 'react';
import {Resources} from './constants';
import {getImgSrc} from './utils';

export default class LikeButton extends React.Component {
  favorite() {
    const year = (new Date()).getFullYear();
    const index = this.props.track.favorites.indexOf(year);
    if (index !== -1) {
      this.props.track.favorites.splice(index, 1);
    } else {
      this.props.track.favorites.push(year);
    }
    this.props.library.save();
    this.forceUpdate();
  }

  render() {
    const year = (new Date()).getFullYear();
    const favorite = this.props.track && this.props.track.favorites.indexOf(year) !== -1;
    return (
      <input
        type="image"
        alt="favorite"
        src={getImgSrc(Resources.FAVORITE)}
        onClick={this.favorite.bind(this)}
        style={{width: "50px", height: "50px", opacity: favorite ? '1' : '.5'}}
        disabled={!this.props.track}
      />
    )
  }
}
