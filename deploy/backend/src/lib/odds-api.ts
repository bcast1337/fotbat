import { cache } from './cache.js';
import type { MarketOdds } from './types.js';

const BASE_URL = 'https://api.the-odds-api.com/v4';

export const SPORT_KEYS: Record<string, string> = {
  PL: 'soccer_epl', PD: 'soccer_spain_la_liga', SA: 'soccer_italy_serie_a',
  BL1: 'soccer_germany_bundesliga', FL1: 'soccer_france_ligue_one',
  DED: 'soccer_netherlands_eredivisie', PPL: 'soccer_portugal_primeira_liga',
  CL: 'soccer_uefa_champs_league', WC: 'soccer_fifa_world_cup',
};

function apiKey(): string {
  const key = process.env.ODDS_API_KEY;
  if (!key) throw new Error('ODDS_API_KEY is not configured');
  return key;
}

function sleep(ms: number): Promise<void> { return new Promise((r) => setTimeout(r, ms)); }

type RawEvent = {
  id: string; home_team: string; away_team: string; commence_time: string;
  bookmakers: Array<{ markets: Array<{ key: string; outcomes: Array<{ name: string; price: number }> }> }>;
};

export type OddsEntry = { home: string; away: string; commence: string; odds: MarketOdds };

async function apiGet<T>(path: string, attempt = 0): Promise<T> {
  try {
    const sep = path.includes('?') ? '&' : '?';
    const res = await fetch(`${BASE_URL}${path}${sep}apiKey=${apiKey()}`);
    if (res.status === 429 || res.status >= 500) throw new Error(`Transient odds API error: ${res.status}`);
    if (!res.ok) throw new Error(`Odds API error ${res.status}: ${await res.text()}`);
    return (await res.json()) as T;
  } catch (err) {
    if (attempt < 2) { await sleep(800 * Math.pow(2, attempt)); return apiGet<T>(path, attempt + 1); }
    throw err;
  }
}

function averageOdds(event: RawEvent): MarketOdds | null {
  let sumH = 0, sumD = 0, sumA = 0, n = 0;
  for (const bm of event.bookmakers) {
    const h2h = bm.markets.find((m) => m.key === 'h2h');
    if (!h2h) continue;
    const home = h2h.outcomes.find((o) => o.name === event.home_team);
    const away = h2h.outcomes.find((o) => o.name === event.away_team);
    const draw = h2h.outcomes.find((o) => o.name === 'Draw');
    if (home && away && draw) { sumH += home.price; sumD += draw.price; sumA += away.price; n++; }
  }
  if (n === 0) return null;
  return { home: sumH / n, draw: sumD / n, away: sumA / n };
}

export function getOddsForCompetition(competitionCode: string): Promise<OddsEntry[]> {
  const sport = SPORT_KEYS[competitionCode];
  if (!sport) return Promise.resolve([]);
  return cache.wrap(`odds:${sport}`, 2 * 60 * 60 * 1000, async () => {
    let events: RawEvent[] = [];
    try { events = await apiGet<RawEvent[]>(`/sports/${sport}/odds?regions=eu&markets=h2h&oddsFormat=decimal`); } catch { return []; }
    const entries: OddsEntry[] = [];
    for (const ev of events) {
      const odds = averageOdds(ev);
      if (odds) entries.push({ home: ev.home_team, away: ev.away_team, commence: ev.commence_time, odds });
    }
    return entries;
  });
}
