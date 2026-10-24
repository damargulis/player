/** A show near the listener by an artist in their library. */
export interface Concert {
  /** JamBase event id, stable across refreshes. */
  id: string;
  /** ISO date (may include a time). */
  date: string;
  name: string;
  venue: string;
  city: string;
  region: string;
  lat?: number;
  lon?: number;
  /** Where to buy or read more. */
  url?: string;
  /** Library artist ids playing this show. */
  artistIds: string[];
}

export interface ConcertLocation {
  label: string;
  lat: number;
  lon: number;
  radiusMiles: number;
  /** How far ahead to look. */
  windowDays: number;
}

export interface ConcertCache {
  /** epoch ms of the last successful refresh. */
  fetchedAt?: number;
  location: ConcertLocation;
  concerts: Concert[];
  /** Rough API budget tracking: the free tier allows 1000 calls a month. */
  usage: {month: string; calls: number};
  /** Set when the last refresh failed, so the UI can say why. */
  error?: string;
}

/**
 * Centred on the Upper East Side. 25 miles reaches every venue that matters from there —
 * Brooklyn and Hoboken are under 5, MetLife and Jersey City under 8, Newark 12, Coney Island 14
 * — and radius barely affects cost (15mi is 23 pages, 40mi is 26), so there's no reason to be
 * stingy.
 */
export const DEFAULT_LOCATION: ConcertLocation = {
  label: 'New York, NY',
  lat: 40.7736,
  lon: -73.9566,
  radiusMiles: 25,
  windowDays: 120,
};

/** JamBase Developer tier allowance; refreshes stop rather than silently overspend. */
export const MONTHLY_CALL_BUDGET = 1000;

export function emptyCache(): ConcertCache {
  return {
    concerts: [],
    location: DEFAULT_LOCATION,
    usage: {calls: 0, month: currentMonth()},
  };
}

export function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/** The calendar day a show falls on, as YYYY-MM-DD. */
export function dayKey(isoDate: string): string {
  return isoDate.slice(0, 10);
}

/**
 * Parses a show's date in local time. `new Date('2027-01-14')` is treated as UTC midnight,
 * which lands on the 13th anywhere west of Greenwich — so build the date from its parts
 * instead. Venue dates are already local to the venue; there is nothing to convert.
 */
export function localDate(isoDate: string): Date {
  const [year, month, day] = dayKey(isoDate).split('-').map(Number);
  const time = isoDate.slice(11, 16);
  const [hours, minutes] = time ? time.split(':').map(Number) : [0, 0];
  return new Date(year, (month || 1) - 1, day || 1, hours || 0, minutes || 0);
}

/** Great-circle distance in miles, for showing how far a show is. */
export function milesBetween(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const earthRadiusMiles = 3958.8;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return earthRadiusMiles * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
