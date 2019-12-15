import PropTypes from 'prop-types';
import React from 'react';
import { AutoSizer, Grid } from 'react-virtualized';

import './App.css';

export default class WrappedGrid extends React.Component {
  constructor(props) {
    super(props);
    this.numCols = 0;
  }

  cellRenderer({columnIndex, key, rowIndex, style}) {
    return this.props.cellRenderer(
      rowIndex * this.numCols + columnIndex, key, style);
  }

  render() {
    if (!this.props.items) {
      return null;
    }
    const numItems = this.props.items.length;
    return (
      <AutoSizer>
        {({height, width}) => {
        // TODO: make 150 a prop (w/ default?)
          this.numCols = Math.floor(width / 150);
          const rows = Math.ceil(numItems / this.numCols);
          if (this.numCols <= 0 || this.numCols <= 0) {
            return null;
          }
          return (
            <Grid
              cellRenderer={this.cellRenderer.bind(this)}
              columnCount={this.numCols}
              columnWidth={width / this.numCols}
              height={height}
              rowCount={rows}
              rowHeight={150}
              width={width}
            />
          );
        }}
      </AutoSizer>
    );
  }
}

WrappedGrid.propTypes = {
  cellRenderer: PropTypes.func.isRequired,
  items: PropTypes.array.isRequired,
};
