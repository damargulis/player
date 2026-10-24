import {readEnvValue} from '../envFile';
import {Concert, ConcertLocation} from './types';

// JamBase Data API. The Developer tier is free for non-commercial use but allows only 1000
// calls a month, so everything here is built around one cheap location sweep rather than a
// lookup per artist: expandExternalIdentifiers puts a MusicBrainz id on every performer, which
// is what lets us match exactly against the library instead of guessing from names.

const BASE_URL = 'https://api.data.jambase.com/v3';
const KEY_NAME = 'JAMBASE_API_KEY';
const PAGE_SIZE = 100;
/** Stop a runaway sweep; a wide radius over a long window can be many pages. */
const MAX_PAGES = 40;

export function getApiKey(): string | undefined {
  return readEnvValue(KEY_NAME);
}

export function apiKeyHelp(): string {
  return `Add ${KEY_NAME}=... to .env.local (dev) or data/.env (packaged). ` +
    'A free Developer key comes from data.jambase.com.';
}

export class ConcertApiError extends Error {
  public status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

interface ExternalIdentifier {
  source?: string;
  identifier?: string[];
}

interface Performer {
  name?: string;
  'x-externalIdentifiers'?: ExternalIdentifier[];
}

interface EventLocation {
  name?: string;
  address?: {
    addressLocality?: string;
    addressRegion?: {alternateName?: string; name?: string};
  };
  geo?: {latitude?: number; longitude?: number};
}

interface RawEvent {
  identifier?: string;
  name?: string;
  startDate?: string;
  url?: string;
  offers?: Array<{url?: string}>;
  location?: EventLocation;
  performer?: Performer[];
}

interface EventsResponse {
  pagination?: {page?: number; totalPages?: number; totalItems?: number};
  events?: RawEvent[];
}

/** An event plus the MusicBrainz ids of everyone on the bill, before library matching. */
export interface FetchedEvent {
  concert: Omit<Concert, 'artistIds'>;
  mbids: string[];
}

export interface SweepResult {
  events: FetchedEvent[];
  calls: number;
  totalItems: number;
}

function iso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function mbidsOf(performers: Performer[]): string[] {
  const out: string[] = [];
  performers.forEach((performer) => {
    (performer['x-externalIdentifiers'] || []).forEach((ext) => {
      if (ext.source === 'musicbrainz') {
        (ext.identifier || []).forEach((id) => out.push(String(id).toLowerCase()));
      }
    });
  });
  return out;
}

function toConcert(raw: RawEvent): Omit<Concert, 'artistIds'> | undefined {
  if (!raw.identifier || !raw.startDate) {
    return undefined;
  }
  const location = raw.location || {};
  const address = location.address || {};
  const region = address.addressRegion || {};
  const offer = (raw.offers || []).find((o) => o.url);
  return {
    city: address.addressLocality || '',
    date: raw.startDate,
    id: raw.identifier,
    lat: location.geo && location.geo.latitude,
    lon: location.geo && location.geo.longitude,
    name: raw.name || '',
    region: region.alternateName || region.name || '',
    url: (offer && offer.url) || raw.url,
    venue: location.name || '',
  };
}

async function getPage(url: string, key: string): Promise<EventsResponse> {
  const res = await fetch(url, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${key}`,
    },
  });
  const text = await res.text();
  if (!res.ok) {
    let detail = text;
    try {
      const parsed = JSON.parse(text) as {detail?: string; title?: string};
      detail = parsed.detail || parsed.title || text;
    } catch (err) {
      // keep the raw body
    }
    throw new ConcertApiError(res.status, detail);
  }
  return JSON.parse(text) as EventsResponse;
}

/**
 * Approximate location from the connection's IP. JamBase's own geoIp parameter reports its
 * servers rather than the caller, so this asks a geolocation service directly. Accuracy is
 * ISP-level — a few miles — which is fine for centring a 25-mile radius, and the city picker
 * is there for anyone who wants it exact.
 */
export async function locateByIp(): Promise<CityResult> {
  const providers = [
    {
      parse: (d: Record<string, unknown>) => ({
        label: `${d.city || 'Here'}, ${d.region_code || d.region || ''}`.replace(/, $/, ''),
        lat: Number(d.latitude),
        lon: Number(d.longitude),
      }),
      url: 'https://ipapi.co/json/',
    },
    {
      parse: (d: Record<string, unknown>) => ({
        label: `${d.city || 'Here'}, ${d.region || ''}`.replace(/, $/, ''),
        lat: Number(d.lat),
        lon: Number(d.lon),
      }),
      url: 'http://ip-api.com/json/?fields=status,city,region,lat,lon',
    },
  ];
  let lastError = 'Could not work out where you are.';
  for (const provider of providers) {
    try {
      const res = await fetch(provider.url);
      if (!res.ok) {
        lastError = `Location lookup failed (${res.status})`;
        continue;
      }
      const parsed = provider.parse(JSON.parse(await res.text()) as Record<string, unknown>);
      if (isFinite(parsed.lat) && isFinite(parsed.lon) && (parsed.lat !== 0 || parsed.lon !== 0)) {
        return parsed;
      }
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
  }
  throw new ConcertApiError(0, lastError);
}

export interface CityResult {
  label: string;
  lat: number;
  lon: number;
}

interface RawCity {
  name?: string;
  geo?: {latitude?: number; longitude?: number};
  address?: {addressRegion?: string; addressCountry?: string};
}

/** Looks up candidate cities by name, so the listener can pick where "near me" means. */
export async function searchCities(name: string): Promise<CityResult[]> {
  const key = getApiKey();
  if (!key) {
    throw new ConcertApiError(401, `No ${KEY_NAME} found. ${apiKeyHelp()}`);
  }
  const url = `${BASE_URL}/geographies/cities?geoCityName=${encodeURIComponent(name)}&perPage=10`;
  const res = await fetch(url, {
    headers: {Accept: 'application/json', Authorization: `Bearer ${key}`},
  });
  if (!res.ok) {
    throw new ConcertApiError(res.status, `City search failed (${res.status})`);
  }
  const body = JSON.parse(await res.text()) as {cities?: RawCity[]};
  return (body.cities || [])
    .filter((city) => city.geo && city.geo.latitude !== undefined && city.geo.longitude !== undefined)
    .map((city) => {
      const address = city.address || {};
      // regions arrive as ISO codes like "US-NY"; the suffix is the useful half
      const region = (address.addressRegion || '').split('-').pop() || '';
      const country = address.addressCountry || '';
      const place = [city.name, region || country].filter(Boolean).join(', ');
      return {
        label: place,
        lat: (city.geo as {latitude: number}).latitude,
        lon: (city.geo as {longitude: number}).longitude,
      };
    });
}

/**
 * Pages through every music event near `location` in its window. Returns the raw events with
 * their performers' MusicBrainz ids; matching against the library happens separately so it can
 * be re-run without spending calls.
 */
export async function sweep(
  location: ConcertLocation,
  onProgress?: (page: number, totalPages: number) => void,
): Promise<SweepResult> {
  const key = getApiKey();
  if (!key) {
    throw new ConcertApiError(401, `No ${KEY_NAME} found. ${apiKeyHelp()}`);
  }
  const from = new Date();
  const to = new Date(from.getTime() + location.windowDays * 24 * 60 * 60 * 1000);
  const base = `${BASE_URL}/events?geoLatitude=${location.lat}&geoLongitude=${location.lon}` +
    `&geoRadiusAmount=${location.radiusMiles}&geoRadiusUnits=mi` +
    `&eventDateFrom=${iso(from)}&eventDateTo=${iso(to)}` +
    `&perPage=${PAGE_SIZE}&expandExternalIdentifiers=true`;

  const events: FetchedEvent[] = [];
  let calls = 0;
  let totalItems = 0;
  let page = 1;
  let totalPages = 1;
  while (page <= totalPages && page <= MAX_PAGES) {
    const body = await getPage(`${base}&page=${page}`, key);
    calls++;
    const pagination = body.pagination || {};
    totalPages = pagination.totalPages || 1;
    totalItems = pagination.totalItems || 0;
    if (onProgress) {
      onProgress(page, Math.min(totalPages, MAX_PAGES));
    }
    (body.events || []).forEach((raw) => {
      const concert = toConcert(raw);
      const mbids = mbidsOf(raw.performer || []);
      if (concert && mbids.length) {
        events.push({concert, mbids});
      }
    });
    page++;
  }
  return {calls, events, totalItems};
}
