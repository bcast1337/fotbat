import { cache } from './cache.js';

const BASE_URL = 'https://api.football-data.org/v4';
const MIN_REQUEST_SPACING_MS = 6500;
let lastRequestAt = 0;

function authToken(): string {
  const key = process.env.API_FOOTBALL_KEY;
  if (!key) throw new Error('API_FOOTBALL_KEY is not configured');
  return key;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function throttle(): Promise<void> {
  const wait = lastRequestAt + MIN_REQUEST_SPACING_MS - Date.now();
  if (wait > 0) await sleep(wait);
  lastRequestAt = Date.now();
}

async function apiGet<T>(path: string, attempt = 0): Promise<T> {
  await throttle();
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      headers: { 'X-Auth-Token': authToken() },
    });
    if (res.status === 429 || res.status >= 500) throw new Error(`Transient API error: ${res.status}`);
    if (!res.ok) throw new Error(`football-data error ${res.status}: ${await res.text()}`);
    return (await res.json()) as T;
  } catch (err) {
    if (attempt < 3) { await sleep(1000 * Math.pow(2, attempt)); return apiGet<T>(path, attempt + 1); }
    throw err;
  }
}

export const COMPETITIONS = ['PL', 'PD', 'SA', 'BL1', 'FL1', 'DED', 'PPL', 'CL', 'WC'];

export type RawMatch = {
  id: number;
  utcDate: string;
  status: string;
  competition: { name: string; code: string; emblem: string };
  homeTeam: { id: number; name: string; shortName: string; crest: string };
  awayTeam: { id: number; name: string; shortName: string; crest: string };
  score?: { winner?: string | null; fullTime?: { home: number | null; away: number | null } };
};

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

export function getMatches(dateFrom: string, dateTo: string): Promise<{ matches: RawMatch[] }> {
  const comps = COMPETITIONS.join(',');
  return cache.wrap(`matches:${dateFrom}:${dateTo}`, 20 * 60 * 1000, () =>
    apiGet<{ matches: RawMatch[] }>(`/matches?competitions=${comps}&dateFrom=${dateFrom}&dateTo=${dateTo}`)
  );
}

export function getStandings(code: string): Promise<RawTableRow[]> {
  return cache.wrap(`standings:${code}`, 12 * 60 * 60 * 1000, async () => {
    const data = await apiGet<{ standings: Array<{ type: string; table: RawTableRow[] }> }>(`/competitions/${code}/standings`);
    const total = data.standings.find((s) => s.type === 'TOTAL') ?? data.standings[0];
    return total?.table ?? [];
  });
}

export function getRecentMatches(code: string, dateFrom: string, dateTo: string): Promise<RawMatch[]> {
  return cache.wrap(`recent:${code}:${dateFrom}:${dateTo}`, 6 * 60 * 60 * 1000, async () => {
    const data = await apiGet<{ matches: RawMatch[] }>(`/competitions/${code}/matches?status=FINISHED&dateFrom=${dateFrom}&dateTo=${dateTo}`);
    return data.matches;
  });
}

export function getTeamMatches(teamId: number, limit = 12): Promise<RawMatch[]> {
  return cache.wrap(`team:${teamId}:${limit}`, 24 * 60 * 60 * 1000, async () => {
    const data = await apiGet<{ matches: RawMatch[] }>(`/teams/${teamId}/matches?status=FINISHED&limit=${limit}`);
    return data.matches;
  });
}

export function getH2H(teamA: number, teamB: number, limit = 10): Promise<RawMatch[]> {
  const key = [teamA, teamB].sort().join(':');
  return cache.wrap(`h2h:${key}:${limit}`, 48 * 60 * 60 * 1000, async () => {
    try {
      const data = await apiGet<{ matches: RawMatch[] }>(`/teams/${teamA}/matches?status=FINISHED&limit=${limit}`);
      return data.matches.filter((m) => m.homeTeam.id === teamB || m.awayTeam.id === teamB);
    } catch { return []; }
  });
}
