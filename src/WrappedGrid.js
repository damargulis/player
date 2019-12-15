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
    if (this.props.numItems === 0) {
      return null;
    }
    return (
      <AutoSizer>
        {({height, width}) => {
        // TODO: make 150 a prop (w/ default?)
          this.numCols = Math.floor(width / 150);
          const rows = Math.ceil(this.props.numItems / this.numCols);
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
  numItems: PropTypes.number.isRequired,
};
