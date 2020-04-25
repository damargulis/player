import Marquee from './Marquee';
import React from 'react';

interface Linkable {
  id: string;
  name: string;
}

interface OwnProps<T> {
  items: T[];
  name: string;
  goToItem(itemId: string): void;
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
          this.props.items.map((item, index) => {
            return (
              <span>
                <span key={item.id} className="link" onClick={() => this.props.goToItem(item.id)}>
                  {item.name}
                </span>
                {index != this.props.items.length - 1 ? ', ' : ''}
              </span>
            );
          })
        }
      </Marquee>
    );
  }
}
