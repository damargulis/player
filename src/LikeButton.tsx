import {save} from "./redux/actions";
import Album from "./library/Album";
import favoriteButton from "./resources/favorite.png";
import * as React from "react";
import {connect} from "react-redux";
import Track from "./library/Track";

interface DispatchProps {
  save(): void;
}

interface OwnProps {
  item?: Album | Track;
}

type LikeButtonProps = DispatchProps & OwnProps;

class LikeButton extends React.Component<LikeButtonProps> {

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
    this.props.save();
    this.forceUpdate();
  }
}

export default connect(null, {save})(LikeButton);
