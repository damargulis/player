import Marquee from './Marquee';
import React from 'react';

interface Linkable {
  id: number;
  name: string;
}

interface OwnProps<T> {
  items: T[];
  name: string;
  goToItem(item: T): void;
}

type LinksProps<T> = OwnProps<T>;

export default class Links<T extends Linkable> extends React.Component<LinksProps<T>> {
  render(): JSX.Element | string {
    if (!this.props.items.length) {
      return this.props.name;
    }
    return (
      <Marquee>
        {
          this.props.items.map((item) => {
            return (
              <span key={item.id} className="link" onClick={() => this.props.goToItem(item)}>
                {item.name}
              </span>
            );
          })
        }
      </Marquee>
    );
  }
}
