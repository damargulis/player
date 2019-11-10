import React from 'react';

export default class NavigationBar extends React.Component {
  render() {
    return (
      <div>
        <button onClick={this.props.goBack}>&lt;</button>
        <button
          onClick={this.props.goForward}
          disabled={!this.props.canGoForward}
        >&gt;</button>
      </div>
    )
  }
}
