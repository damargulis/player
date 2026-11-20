import {Concert} from './types';

/** The shows at one place, which the map draws as a single pin. */
export interface Venue {
  /** Stable while the venue is: the rounded coordinates. */
  key: string;
  name: string;
  lat: number;
  lon: number;
  /** In the order they were given, which is date order everywhere this is called from. */
  concerts: Concert[];
}

/**
 * Folds shows into one entry per place. Keyed on coordinates rather than the venue name, since a
 * name varies between listings ("Brooklyn Steel" / "Brooklyn Steel - NY") where the location does
 * not, and two pins on exactly the same spot could never be told apart or clicked separately.
 * Four decimals is about 10m. Shows JamBase gave no location for are counted, not placed.
 */
export function groupByVenue(concerts: Concert[]): {venues: Venue[]; unplaced: number} {
  const byKey: Record<string, Venue> = {};
  const venues: Venue[] = [];
  let unplaced = 0;
  concerts.forEach((concert) => {
    if (concert.lat === undefined || concert.lon === undefined ||
        !isFinite(concert.lat) || !isFinite(concert.lon)) {
      unplaced++;
      return;
    }
    const key = `${concert.lat.toFixed(4)},${concert.lon.toFixed(4)}`;
    let venue = byKey[key];
    if (!venue) {
      venue = {concerts: [], key, lat: concert.lat, lon: concert.lon, name: concert.venue};
      byKey[key] = venue;
      venues.push(venue);
    }
    venue.concerts.push(concert);
  });
  return {unplaced, venues};
}
