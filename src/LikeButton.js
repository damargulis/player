import Album from './library/Album';
import Library from './library/Library';
import PropTypes from 'prop-types';
import React from 'react';
import {Resources} from './constants';
import Track from './library/Track';
import {getImgSrc} from './utils';

export default class LikeButton extends React.Component {
  favorite() {
    const year = new Date().getFullYear();
    const index = this.props.item.favorites.indexOf(year);
    if (index === -1) {
      this.props.item.favorites.push(year);
    } else {
      this.props.item.favorites.splice(index, 1);
    }
    this.props.library.save();
    this.forceUpdate();
  }

  render() {
    const year = new Date().getFullYear();
    const favorite = this.props.item &&
      this.props.item.favorites.indexOf(year) !== -1;
    return (
      <input
        alt="favorite"
        className="control-button"
        disabled={!this.props.item}
        onClick={this.favorite.bind(this)}
        src={getImgSrc(Resources.FAVORITE)}
        style={{width: "25px", opacity: favorite ? '1' : '.5'}}
        type="image"
      />
    );
  }
}

LikeButton.propTypes = {
  item: PropTypes.oneOfType([
    PropTypes.instanceOf(Track),
    PropTypes.instanceOf(Album),
  ]),
  library: PropTypes.instanceOf(Library).isRequired,
};
