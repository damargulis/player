import React from 'react';
import {AutoSizer, Grid} from 'react-virtualized';

import './App.css';

interface WrappedGridProps {
  numItems: number;
  cellRenderer(index: number, key: string, style: React.CSSProperties): JSX.Element;
}

export default class WrappedGrid extends React.Component<WrappedGridProps> {
  private numCols: number;

  constructor(props: WrappedGridProps) {
    super(props);
    this.numCols = 0;
  }

  public render(): JSX.Element | null {
    if (this.props.numItems === 0) {
      return null;
    }
    return (
      <AutoSizer>
        {({height, width}) => {
          // TODO: make 150 a prop (w/ default?)
          this.numCols = Math.floor(width / 150);
          if (this.numCols <= 0) {
            return;
          }
          const rows = Math.ceil(this.props.numItems / this.numCols);
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

  private cellRenderer(
    {columnIndex, key, rowIndex, style}:
    {columnIndex: number; key: string; rowIndex: number; style: object},
  ): JSX.Element {
    return this.props.cellRenderer(rowIndex * this.numCols + columnIndex, key, style);
  }
}
