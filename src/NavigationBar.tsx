import React from 'react';

interface NavigationBarProps {
  canGoForward: boolean;
  goBack(): void;
  goForward(): void;
}

export default class NavigationBar extends React.Component<NavigationBarProps> {
  public render(): JSX.Element {
    return (
      <div>
        <button onClick={this.props.goBack}>&lt;</button>
        <button disabled={!this.props.canGoForward} onClick={this.props.goForward} >&gt;</button>
      </div>
    );
  }
}
