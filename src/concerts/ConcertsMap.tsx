import L from 'leaflet';
// tslint:disable-next-line:no-submodule-imports -- the stylesheet only ships here
import 'leaflet/dist/leaflet.css';
import React from 'react';
import {ConcertLocation} from './types';
import {Venue} from './venues';

const METERS_PER_MILE = 1609.34;

/**
 * OpenStreetMap's standard tiles, darkened in CSS to sit in the theme. CARTO's dark basemap was
 * the first choice and now watermarks every tile "API KEY REQUIRED". OSM's usage policy asks for
 * the attribution and an identifying User-Agent, which Electron's (it names MyMusic) is.
 */
const TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

/** Not in TS 3.7's DOM lib; Chromium 91 has it. */
interface ResizeObserver {
  observe(target: Element): void;
  disconnect(): void;
}
declare const ResizeObserver: new (callback: () => void) => ResizeObserver;

interface ConcertsMapProps {
  location: ConcertLocation;
  venues: Venue[];
  selectedKey?: string;
  /** Pin radius in pixels. */
  sizeOf(venue: Venue): number;
  isLoved(venue: Venue): boolean;
  isNew(venue: Venue): boolean;
  /** Tooltip lines: the venue first, then what is on there. Plain text, never HTML. */
  describe(venue: Venue): string[];
  onSelect(key: string): void;
  openUrl(url: string): void;
}

/**
 * Leaflet owns its own DOM, so this renders one empty div and drives the map imperatively: built
 * once on mount, pins redrawn whenever the props change.
 */
export default class ConcertsMap extends React.Component<ConcertsMapProps> {
  private container = React.createRef<HTMLDivElement>();
  private map?: L.Map;
  private pins?: L.LayerGroup;
  private radius?: L.Circle;
  private resizer?: ResizeObserver;
  /** The search area last framed, so a redraw only re-frames when the place changes. */
  private framed = '';

  public componentDidMount(): void {
    const element = this.container.current as HTMLDivElement;
    this.map = L.map(element, {attributionControl: true, zoomControl: true});
    this.map.attributionControl.setPrefix(false);
    L.tileLayer(TILES, {attribution: ATTRIBUTION, maxZoom: 19}).addTo(this.map);
    this.pins = L.layerGroup().addTo(this.map);
    // MaxWindow hides a page with display:none rather than unmounting it, and Leaflet measures
    // its container only on window resizes, so coming back to the tab would leave a grey map
    this.resizer = new ResizeObserver(() => this.map && this.map.invalidateSize());
    this.resizer.observe(element);
    this.draw();
  }

  public componentDidUpdate(): void {
    this.draw();
  }

  public componentWillUnmount(): void {
    if (this.resizer) {
      this.resizer.disconnect();
    }
    if (this.map) {
      this.map.remove();
    }
  }

  public render(): JSX.Element {
    // the attribution is links, and a plain link would navigate the whole app window away
    return <div className="concerts-map-canvas" ref={this.container} onClick={(evt) => this.catchLink(evt)} />;
  }

  private draw(): void {
    const map = this.map as L.Map;
    const pins = this.pins as L.LayerGroup;
    const {location, venues, selectedKey} = this.props;
    const center = L.latLng(location.lat, location.lon);
    // re-framed when the place changes or shows first arrive, not on every redraw, so it never
    // yanks the view away from somewhere the listener has panned to
    const area = `${location.lat},${location.lon},${location.radiusMiles},${venues.length > 0}`;
    if (area !== this.framed) {
      this.framed = area;
      // first, and from coordinates: until a map has a view, a circle cannot measure itself and
      // adding any vector layer throws. Framed on the pins, since the shows bunch up in the middle
      // of the circle and framing the whole of it leaves them a few pixels apart
      const bounds = venues.length
        ? L.latLngBounds(venues.map((venue) => L.latLng(venue.lat, venue.lon)))
        : center.toBounds(location.radiusMiles * METERS_PER_MILE * 2);
      map.fitBounds(bounds, {maxZoom: 14, padding: [30, 30]});
    }
    if (this.radius) {
      this.radius.remove();
    }
    this.radius = L.circle(center, {
      className: 'concerts-map-radius',
      interactive: false,
      radius: location.radiusMiles * METERS_PER_MILE,
    }).addTo(map);
    pins.clearLayers();
    // loved last, so they draw on top where pins overlap
    const ordered = venues.slice().sort((a, b) => Number(this.props.isLoved(a)) - Number(this.props.isLoved(b)));
    ordered.forEach((venue) => {
      const classes = ['concerts-pin'];
      if (this.props.isLoved(venue)) {
        classes.push('loved');
      }
      if (this.props.isNew(venue)) {
        classes.push('fresh');
      }
      if (venue.key === selectedKey) {
        classes.push('selected');
      }
      L.circleMarker([venue.lat, venue.lon], {className: classes.join(' '), radius: this.props.sizeOf(venue)})
        .bindTooltip(tooltip(this.props.describe(venue)), {className: 'concerts-map-tip', direction: 'top'})
        .on('click', () => this.props.onSelect(venue.key))
        .addTo(pins);
    });
  }

  private catchLink(evt: React.MouseEvent): void {
    // only the attribution's: the zoom buttons are links too, to "#"
    const link = (evt.target as HTMLElement).closest('.leaflet-control-attribution a') as HTMLAnchorElement | null;
    if (link && /^https?:/.test(link.href)) {
      evt.preventDefault();
      this.props.openUrl(link.href);
    }
  }
}

/** Built from text nodes because Leaflet reads a string tooltip as HTML, and these hold artist names. */
function tooltip(lines: string[]): HTMLElement {
  const element = document.createElement('div');
  lines.forEach((line, i) => {
    const row = document.createElement('div');
    row.className = i === 0 ? 'head' : '';
    row.textContent = line;
    element.appendChild(row);
  });
  return element;
}
