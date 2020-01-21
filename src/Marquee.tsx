
import React from 'react';

import './Marquee.css';

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

    this.state = {marquee: false};
  }

  public componentDidMount(): void {
    this.setMarquee();
  }

  public componentDidUpdate(): void {
    this.setMarquee();
  }

  public render(): JSX.Element {
    return (
      <span ref={this.marquee} className={this.state.marquee ? 'marquee' : ''}>{this.props.children}</span>
    );
  }

  private setMarquee(): void {
    const marquee = this.marquee.current;
    const container =  marquee && marquee.parentElement;
    const par = container && container.parentElement;
    if (!par) {
      return;
    }

    if (!marquee || !container || !marquee.offsetWidth || !container.offsetWidth) {
      return;
    }
    if (marquee.offsetWidth > container.offsetWidth) {
      if (!this.state.marquee) {
        this.setState({marquee: true});
      }
    } else if (this.state.marquee) {
      this.setState({marquee: false});
    }
  }
}
