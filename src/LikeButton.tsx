import Album from "./library/Album";
import favoriteButton from "./resources/favorite.png";
import Library from "./library/Library";
import * as React from "react";
import Track from "./library/Track";

interface LikeButtonProps {
  library: Library;
  item?: Album | Track;
}

export default class LikeButton extends React.Component<LikeButtonProps> {

  public render(): JSX.Element {
    const year = new Date().getFullYear();
    const favorite = this.props.item &&
      this.props.item.favorites.indexOf(year) !== -1;
    return (
      <input
        alt="favorite"
        className="control-button"
        disabled={!this.props.item}
        onClick={this.favorite.bind(this)}
        src={favoriteButton}
        style={{width: "25px", opacity: favorite ? "1" : ".5"}}
        type="image"
      />
    );
  }

  private favorite(): void {
    if (!this.props.item) {
      return;
    }
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
}
