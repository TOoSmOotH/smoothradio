import { db, tracks } from '@smoothradio/database';
import { sql } from 'drizzle-orm';

const SEED_GENRES = [
  'Rock',
  'Pop',
  'Hip-Hop',
  'R&B',
  'Country',
  'Jazz',
  'Blues',
  'Classical',
  'Electronic',
  'Folk',
  'Metal',
  'Punk',
  'Reggae',
  'Soul',
  'Funk',
  'Latin',
  'World',
  'Gospel',
  'Soundtrack',
];

const SEED_DECADES = [
  '1920s',
  '1930s',
  '1940s',
  '1950s',
  '1960s',
  '1970s',
  '1980s',
  '1990s',
  '2000s',
  '2010s',
  '2020s',
  '2030s',
];

const GENRE_ALIASES: Record<string, string> = {
  'classic rock': 'Rock',
  'hard rock': 'Rock',
  'soft rock': 'Rock',
  'pop music': 'Pop',
  'pop rock': 'Pop',
  'hip hop': 'Hip-Hop',
  'rap': 'Hip-Hop',
  'r and b': 'R&B',
  'r&b': 'R&B',
  'rhythm and blues': 'R&B',
  'electronic dance': 'Electronic',
  'edm': 'Electronic',
  'synth pop': 'Electronic',
  'synthpop': 'Electronic',
  'house': 'Electronic',
  'techno': 'Electronic',
  'swing jazz': 'Jazz',
  'vocal jazz': 'Jazz',
  'smooth jazz': 'Jazz',
  'heavy metal': 'Metal',
  'thrash metal': 'Metal',
  'death metal': 'Metal',
  'reggaeton': 'Latin',
  'salsa': 'Latin',
  'bachata': 'Latin',
};

const REFRESH_INTERVAL_MS = 5 * 60 * 1000;
const MAX_DYNAMIC_GENRES = 64;

export type Buckets = {
  genres: string[];
  decades: string[];
};

type CachedBuckets = {
  buckets: Buckets;
  loadedAt: number;
};

let cache: CachedBuckets | null = null;
let inflight: Promise<Buckets> | null = null;

export async function loadBuckets(now = Date.now()): Promise<Buckets> {
  if (cache && now - cache.loadedAt < REFRESH_INTERVAL_MS) {
    return cache.buckets;
  }

  if (inflight) {
    return inflight;
  }

  inflight = (async () => {
    try {
      const dynamicGenres = await fetchDistinctGenres();
      const buckets: Buckets = {
        genres: mergeUnique(SEED_GENRES, dynamicGenres).slice(0, MAX_DYNAMIC_GENRES),
        decades: [...SEED_DECADES],
      };
      cache = { buckets, loadedAt: now };
      return buckets;
    } catch (error) {
      // If the DB read fails (e.g. fresh install), fall back to seeds.
      const buckets: Buckets = {
        genres: [...SEED_GENRES],
        decades: [...SEED_DECADES],
      };
      cache = { buckets, loadedAt: now };
      return buckets;
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}

export function invalidateBucketCache(): void {
  cache = null;
}

export function normalizeGenre(rawGenre: string, allowed: string[]): string | null {
  const cleaned = collapseGenre(rawGenre);
  if (!cleaned) {
    return null;
  }

  const aliased = GENRE_ALIASES[cleaned.toLowerCase()];
  if (aliased) {
    return aliased;
  }

  const allowedLookup = new Map(allowed.map((g) => [g.toLowerCase(), g]));
  const direct = allowedLookup.get(cleaned.toLowerCase());
  if (direct) {
    return direct;
  }

  // Loose containment match — e.g. "indie rock" matches allowed "Rock".
  for (const candidate of allowed) {
    const lc = candidate.toLowerCase();
    if (cleaned.toLowerCase().includes(lc) || lc.includes(cleaned.toLowerCase())) {
      return candidate;
    }
  }

  return titleCase(cleaned);
}

export function normalizeDecade(rawDecade: string, fallbackYear?: string): string | null {
  if (rawDecade) {
    const match = rawDecade.toLowerCase().match(/(19\d0|20\d0)s/);
    if (match && SEED_DECADES.includes(match[0])) {
      return match[0];
    }
  }

  if (fallbackYear) {
    const yearMatch = fallbackYear.match(/(\d{4})/);
    if (yearMatch) {
      const year = Number.parseInt(yearMatch[1]!, 10);
      if (Number.isFinite(year) && year >= 1900 && year <= 2099) {
        const decade = `${Math.floor(year / 10) * 10}s`;
        if (SEED_DECADES.includes(decade)) {
          return decade;
        }
      }
    }
  }

  return null;
}

async function fetchDistinctGenres(): Promise<string[]> {
  const rows = await db
    .selectDistinct({ genre: tracks.genre })
    .from(tracks)
    .where(sql`${tracks.genre} is not null and ${tracks.isCategorized} = true`)
    .limit(MAX_DYNAMIC_GENRES);

  return rows
    .map((row) => collapseGenre(row.genre ?? ''))
    .filter((value): value is string => value.length > 0)
    .map((value) => titleCase(value));
}

function mergeUnique(seed: string[], dynamic: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of [...seed, ...dynamic]) {
    const key = value.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(value);
  }
  return result;
}

function collapseGenre(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function titleCase(value: string): string {
  return value
    .split(' ')
    .filter(Boolean)
    .map((token) => token[0]!.toUpperCase() + token.slice(1).toLowerCase())
    .join(' ');
}
