import React from 'react';


export default class ArtistInfo extends React.Component {
  render() {
    if (!this.props.artist) {
      return (
        <div style={this.props.stlye} />
      )
    }
    // recenter with new width filling full space
    const newStyle = {
      ...this.props.style,
      paddingLeft: (this.props.style.width - 150) / 2,
      paddingRight: (this.props.style.width - 150) / 2,
      width: 150
    };

    return (
      <div
        style={newStyle}
      >
        <div style={{position:"absolute", left: "50%"}}>
        <div style={{position: "relative", left: "-50%", textAlign: 'center'}}>{this.props.artist.name}</div>
        </div>
      </div>
    )
  }
}
