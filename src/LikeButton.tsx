import {EventSubject, logPlays} from './eventLog';
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
  /** Which collection the id belongs to, so the log says what was favourited. */
  subject: EventSubject;
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
        onClick={() => this.favorite()}
        src={favoriteButton}
        style={{width: '25px', opacity: favorite ? '1' : '.5'}}
        type="image"
      />
    );
  }

  /**
   * Toggles this year's favourite, and logs which way it went.
   *
   * `favorites` is a list of years, so it records *that* something was crowned in 2026 but not
   * when — and un-favouriting removes the year, leaving no trace that it ever happened. The log
   * is the only place either of those survives.
   */
  private favorite(): void {
    if (!this.props.item) {
      return;
    }
    const favorites = this.props.item.favorites.slice();
    const year = new Date().getFullYear();
    const index = favorites.indexOf(year);
    const adding = index === -1;
    if (adding) {
      favorites.push(year);
    } else {
      favorites.splice(index, 1);
    }
    this.props.update(this.props.item.id, {favorites: favorites});
    logPlays([{
      at: Date.now(),
      id: this.props.item.id,
      source: 'desktop',
      subject: this.props.subject,
      type: adding ? 'favorite' : 'unfavorite',
    }]);
  }
}

export default connect(null, {})(LikeButton);
