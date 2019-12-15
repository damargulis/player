import PropTypes from 'prop-types';
import React from 'react';

export default class NavigationBar extends React.Component {
  render() {
    return (
      <div>
        <button onClick={this.props.goBack}>&lt;</button>
        <button
          disabled={!this.props.canGoForward}
          onClick={this.props.goForward}
        >&gt;
        </button>
      </div>
    );
  }
}

NavigationBar.propTypes = {
  canGoForward: PropTypes.bool.isRequired,
  goBack: PropTypes.func.isRequired,
  goForward: PropTypes.func.isRequired,
};
