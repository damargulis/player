
import React from "react";

import "./Marquee.css";

interface LinkableItem {
  id: number;
  name: string;
}

interface MarqueeState {
  marquee: boolean;
}


export default class Marquee extends React.Component<{}, MarqueeState> {
  private marquee = React.createRef<HTMLInputElement>();
  constructor(props: {}) {
    super(props);

    this.state = {
      marquee: false,
    }
  }

  private setMarquee() {
    const marquee = this.marquee.current;
    const container =  marquee && marquee.parentElement;
    const par = container && container.parentElement;
    if (!par) {
      return;
    }

    if (!marquee || !container || !marquee.offsetWidth || !container.offsetWidth) {
      return;
    }
    console.log("Element: " + marquee.textContent);
    console.log("marquee: " + marquee.offsetWidth);
    console.log("container: " + container.offsetWidth);
    console.log('parent: ' + par.offsetWidth);
    if (marquee.offsetWidth > container.offsetWidth) {
      if (!this.state.marquee) {
        this.setState({
          marquee: true
        });
      }
    } else if (this.state.marquee) {
      this.setState({
        marquee: false,
      });
    }
  }

  public componentDidMount() {
    this.setMarquee();
  }

  public componentDidUpdate() {
    this.setMarquee();
  }

  public render(): JSX.Element {
    return (
      <span ref={this.marquee} className={this.state.marquee ? "marquee" : ""}>
      {this.props.children}
      </span>
    );
  }
}
