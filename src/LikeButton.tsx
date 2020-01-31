import favoriteButton from './resources/favorite.png';
import * as React from 'react';
import {connect} from 'react-redux';

interface Likeable {
  id: string;
  favorites: number[];
}

interface LikeableInternal {
  favorites: number[];
}

interface DispatchProps {
}

interface OwnProps<T> {
  item?: T;
  update(id: string, item: LikeableInternal): void;
}

type LikeButtonProps<T> = DispatchProps & OwnProps<T>;

class LikeButton<T extends Likeable> extends React.Component<LikeButtonProps<T>> {

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
        style={{width: '25px', opacity: favorite ? '1' : '.5'}}
        type="image"
      />
    );
  }

  private favorite(): void {
    if (!this.props.item) {
      return;
    }
    const favorites = this.props.item.favorites.slice();
    const year = new Date().getFullYear();
    const index = favorites.indexOf(year);
    if (index === -1) {
      favorites.push(year);
    } else {
      favorites.splice(index, 1);
    }
    this.props.update(this.props.item.id, {favorites: favorites});
  }
}

export default connect(null, {})(LikeButton);
