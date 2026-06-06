import { cache } from './cache.js';

/**
 * football-data.org (v4) HTTP client.
 *
 * Wraps the football-data.org API with:
 * - authentication via the API_FOOTBALL_KEY environment variable (X-Auth-Token)
 * - automatic retries with exponential backoff on transient failures
 * - a conservative request throttle + TTL caching to respect the free-tier
 *   rate limit (10 requests/minute) and avoid duplicate calls.
 */

const BASE_URL = 'https://api.football-data.org/v4';

/** Minimum spacing between outbound requests (free tier = 10/min). */
const MIN_REQUEST_SPACING_MS = 6500;
let lastRequestAt = 0;

/** Read the API token at call time. */
function authToken(): string {
  const key = process.env.API_FOOTBALL_KEY;
  if (!key) throw new Error('API_FOOTBALL_KEY is not configured');
  return key;
}

/** Sleep helper. */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Throttle to keep under the per-minute rate limit. */
async function throttle(): Promise<void> {
  const wait = lastRequestAt + MIN_REQUEST_SPACING_MS - Date.now();
  if (wait > 0) await sleep(wait);
  lastRequestAt = Date.now();
}

/**
 * Perform a throttled GET against football-data.org with retries.
 * @param path - endpoint path, e.g. "/matches".
 * @param attempt - current retry attempt (internal).
 * @returns parsed JSON body.
 */
async function apiGet<T>(path: string, attempt = 0): Promise<T> {
  await throttle();
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      headers: { 'X-Auth-Token': authToken() },
    });
    if (res.status === 429 || res.status >= 500) {
      throw new Error(`Transient API error: ${res.status}`);
    }
    if (!res.ok) {
      throw new Error(`football-data error ${res.status}: ${await res.text()}`);
    }
    return (await res.json()) as T;
  } catch (err) {
    if (attempt < 3) {
      await sleep(1000 * Math.pow(2, attempt));
      return apiGet<T>(path, attempt + 1);
    }
    throw err;
  }
}

/** Competition codes tracked by the platform. */
export const COMPETITIONS = ['PL', 'PD', 'SA', 'BL1', 'FL1', 'DED', 'PPL', 'CL', 'WC'];

/** A raw match from football-data.org (subset of fields used). */
export type RawMatch = {
  id: number;
  utcDate: string;
  status: string;
  competition: { name: string; code: string; emblem: string };
  homeTeam: { id: number; name: string; shortName: string; crest: string };
  awayTeam: { id: number; name: string; shortName: string; crest: string };
  score?: {
    winner?: string | null;
    fullTime?: { home: number | null; away: number | null };
  };
};

/** A raw standings table row (subset). */
export type RawTableRow = {
  position: number;
  team: { id: number; name: string; shortName: string; crest: string };
  playedGames: number;
  won: number;
  draw: number;
  lost: number;
  points: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
};

/**
 * Fetch upcoming/scheduled matches in a date window across tracked
 * competitions (cached 20 min).
 * @param dateFrom - ISO date (YYYY-MM-DD).
 * @param dateTo - ISO date (YYYY-MM-DD), max 10 days after dateFrom.
 */
export function getMatches(dateFrom: string, dateTo: string): Promise<{ matches: RawMatch[] }> {
  const comps = COMPETITIONS.join(',');
  return cache.wrap(`matches:${dateFrom}:${dateTo}`, 20 * 60 * 1000, () =>
    apiGet<{ matches: RawMatch[] }>(
      `/matches?competitions=${comps}&dateFrom=${dateFrom}&dateTo=${dateTo}`
    )
  );
}

/**
 * Fetch the standings table for a competition (cached 12h) — source of team
 * strength stats (points, goals, games played).
 * @param code - competition code, e.g. "PL".
 */
export function getStandings(code: string): Promise<RawTableRow[]> {
  return cache.wrap(`standings:${code}`, 12 * 60 * 60 * 1000, async () => {
    const data = await apiGet<{ standings: Array<{ type: string; table: RawTableRow[] }> }>(
      `/competitions/${code}/standings`
    );
    const total = data.standings.find((s) => s.type === 'TOTAL') ?? data.standings[0];
    return total?.table ?? [];
  });
}

/**
 * Fetch recent finished matches for a competition (cached 6h) — used to derive
 * each team's recent form.
 * @param code - competition code.
 * @param dateFrom - ISO date (YYYY-MM-DD).
 * @param dateTo - ISO date (YYYY-MM-DD).
 */
export function getRecentMatches(
  code: string,
  dateFrom: string,
  dateTo: string
): Promise<RawMatch[]> {
  return cache.wrap(`recent:${code}:${dateFrom}:${dateTo}`, 6 * 60 * 60 * 1000, async () => {
    const data = await apiGet<{ matches: RawMatch[] }>(
      `/competitions/${code}/matches?status=FINISHED&dateFrom=${dateFrom}&dateTo=${dateTo}`
    );
    return data.matches;
  });
}

/**
 * Fetch a single team's most recent finished matches (cached 24h).
 *
 * Used to derive strength for teams that have no league standing yet — most
 * notably national teams in a tournament that has just started. Strength comes
 * from their real recent results (across friendlies, qualifiers, etc.).
 *
 * @param teamId - football-data.org team id.
 * @param limit - number of recent finished matches to pull.
 * @returns the team's recent finished matches, newest first.
 */
export function getTeamMatches(teamId: number, limit = 12): Promise<RawMatch[]> {
  return cache.wrap(`team:${teamId}:${limit}`, 24 * 60 * 60 * 1000, async () => {
    const data = await apiGet<{ matches: RawMatch[] }>(
      `/teams/${teamId}/matches?status=FINISHED&limit=${limit}`
    );
    return data.matches;
  });
}

/**
 * Fetch head-to-head matches between two specific teams (cached 48h).
 *
 * Returns all available historical encounters between the two sides,
 * used by the engine to apply a H2H tendency adjustment.
 *
 * @param teamA - football-data.org team id (home in current fixture).
 * @param teamB - football-data.org team id (away in current fixture).
 * @param limit - max historical h2h matches to fetch.
 * @returns h2h matches in any order (engine will sort by date).
 */
export function getH2H(teamA: number, teamB: number, limit = 10): Promise<RawMatch[]> {
  const key = [teamA, teamB].sort().join(':');
  return cache.wrap(`h2h:${key}:${limit}`, 48 * 60 * 60 * 1000, async () => {
    try {
      const data = await apiGet<{ matches: RawMatch[] }>(
        `/teams/${teamA}/matches?status=FINISHED&limit=${limit}`
      );
      // Filter for matches where teamB was also involved.
      return data.matches.filter(
        (m) => m.homeTeam.id === teamB || m.awayTeam.id === teamB
      );
    } catch {
      return [];
    }
  });
}
