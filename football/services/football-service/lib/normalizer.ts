import type { Fixture, Team, MarketOdds, H2HResult } from './types.js';
import {
  getMatches,
  getStandings,
  getRecentMatches,
  getTeamMatches,
  getH2H,
  COMPETITIONS,
  type RawMatch,
  type RawTableRow,
} from './api-football.js';
import { getOddsForCompetition, type OddsEntry } from './odds-api.js';
import { matchOdds } from './match-odds.js';

/**
 * Data normalization layer (football-data.org).
 *
 * Transforms raw football-data.org payloads into the clean domain shapes the
 * engine consumes, deriving ELO-like ratings and rolling averages from real
 * league standings, and recent form from real finished matches.
 *
 * v2 additions:
 *  - Home/Away venue-split averages (avgScoredHome, avgScoredAway, etc.)
 *  - Head-to-head history (last 10 encounters)
 */

/** Add days to an ISO date string (YYYY-MM-DD). */
function addDays(date: string, days: number): string {
  const d = new Date(date + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Derive an ELO-like rating from a standings row. */
function deriveElo(s: RawTableRow): number {
  const played = Math.max(1, s.playedGames);
  const ppg = s.points / played;
  const gd = s.goalDifference / played;
  return 1500 + (ppg - 1.4) * 220 + gd * 60;
}

/**
 * Build a strength map keyed by team id from a competition's standings.
 * Teams with fewer than 3 games are skipped so they fall back to neutral defaults.
 */
function buildTeamStats(table: RawTableRow[]): Map<number, Team> {
  const map = new Map<number, Team>();
  for (const row of table) {
    if (row.playedGames < 3) continue;
    const played = row.playedGames;
    map.set(row.team.id, {
      id: String(row.team.id),
      name: row.team.shortName || row.team.name,
      logo: row.team.crest,
      elo: deriveElo(row),
      avgScored: row.goalsFor / played,
      avgConceded: row.goalsAgainst / played,
      // Venue splits not available from standings — filled by recent match analysis.
      avgScoredHome: 0,
      avgScoredAway: 0,
      avgConcededHome: 0,
      avgConcededAway: 0,
      form: [],
      hasData: true,
    });
  }
  return map;
}

/**
 * Derive a team's strength from its own recent finished matches.
 * Also computes home/away split averages.
 */
async function deriveTeamFromHistory(
  teamId: number,
  meta: { id: number; name: string; shortName: string; crest: string }
): Promise<Team | null> {
  let matches: RawMatch[] = [];
  try {
    matches = await getTeamMatches(teamId, 15);
  } catch {
    return null;
  }
  const played = matches.filter(
    (m) => m.score?.fullTime?.home != null && m.score?.fullTime?.away != null
  );
  if (played.length < 4) return null;

  let scored = 0, conceded = 0, points = 0;
  let scoredHome = 0, concededHome = 0, homePlayed = 0;
  let scoredAway = 0, concededAway = 0, awayPlayed = 0;
  const chrono = [...played].sort(
    (a, b) => new Date(a.utcDate).getTime() - new Date(b.utcDate).getTime()
  );
  const form: Array<'W' | 'D' | 'L'> = [];
  for (const m of chrono) {
    const isHome = m.homeTeam.id === teamId;
    const gf = (isHome ? m.score?.fullTime?.home : m.score?.fullTime?.away) ?? 0;
    const ga = (isHome ? m.score?.fullTime?.away : m.score?.fullTime?.home) ?? 0;
    scored += gf;
    conceded += ga;
    if (isHome) {
      scoredHome += gf; concededHome += ga; homePlayed++;
    } else {
      scoredAway += gf; concededAway += ga; awayPlayed++;
    }
    if (gf > ga) { points += 3; form.push('W'); }
    else if (gf === ga) { points += 1; form.push('D'); }
    else { form.push('L'); }
  }
  const n = played.length;
  const ppg = points / n;
  const gd = (scored - conceded) / n;
  return {
    id: String(teamId),
    name: meta.shortName || meta.name,
    logo: meta.crest,
    elo: 1500 + (ppg - 1.4) * 220 + gd * 60,
    avgScored: scored / n,
    avgConceded: conceded / n,
    avgScoredHome: homePlayed > 0 ? scoredHome / homePlayed : 0,
    avgScoredAway: awayPlayed > 0 ? scoredAway / awayPlayed : 0,
    avgConcededHome: homePlayed > 0 ? concededHome / homePlayed : 0,
    avgConcededAway: awayPlayed > 0 ? concededAway / awayPlayed : 0,
    form: form.slice(-5),
    hasData: true,
  };
}

/**
 * Derive recent form and venue-split averages per team from a set of finished matches.
 */
function buildFormAndSplits(matches: RawMatch[]): {
  form: Map<number, Array<'W' | 'D' | 'L'>>;
  splits: Map<number, { sh: number; ch: number; hp: number; sa: number; ca: number; ap: number }>;
} {
  const sorted = [...matches].sort(
    (a, b) => new Date(a.utcDate).getTime() - new Date(b.utcDate).getTime()
  );
  const form = new Map<number, Array<'W' | 'D' | 'L'>>();
  const splits = new Map<number, { sh: number; ch: number; hp: number; sa: number; ca: number; ap: number }>();

  const ensureSplit = (id: number) => {
    if (!splits.has(id)) splits.set(id, { sh: 0, ch: 0, hp: 0, sa: 0, ca: 0, ap: 0 });
    return splits.get(id)!;
  };
  const pushForm = (id: number, r: 'W' | 'D' | 'L') => {
    const arr = form.get(id) ?? [];
    arr.push(r);
    form.set(id, arr.slice(-5));
  };

  for (const m of sorted) {
    const h = m.score?.fullTime?.home;
    const a = m.score?.fullTime?.away;
    if (h == null || a == null) continue;

    const hId = m.homeTeam.id;
    const aId = m.awayTeam.id;

    // Venue splits (last 8 home/away matches respectively).
    const hs = ensureSplit(hId);
    hs.sh += h; hs.ch += a; hs.hp++;
    const as_ = ensureSplit(aId);
    as_.sa += a; as_.ca += h; as_.ap++;

    if (h > a) { pushForm(hId, 'W'); pushForm(aId, 'L'); }
    else if (h < a) { pushForm(hId, 'L'); pushForm(aId, 'W'); }
    else { pushForm(hId, 'D'); pushForm(aId, 'D'); }
  }
  return { form, splits };
}

/** Neutral fallback team when no real data could be found. */
function fallbackTeam(raw: { id: number; name: string; shortName: string; crest: string }): Team {
  return {
    id: String(raw.id),
    name: raw.shortName || raw.name,
    logo: raw.crest,
    elo: 1500,
    avgScored: 1.3,
    avgConceded: 1.3,
    avgScoredHome: 0,
    avgScoredAway: 0,
    avgConcededHome: 0,
    avgConcededAway: 0,
    form: [],
    hasData: false,
  };
}

/**
 * Resolve a team's strength: prefer the league standing, then real recent
 * results, then a neutral fallback.
 */
async function resolveTeam(
  raw: { id: number; name: string; shortName: string; crest: string },
  stats: Map<number, Team>
): Promise<Team> {
  const fromStandings = stats.get(raw.id);
  if (fromStandings) return { ...fromStandings };
  const fromHistory = await deriveTeamFromHistory(raw.id, raw);
  if (fromHistory) return fromHistory;
  return fallbackTeam(raw);
}

/**
 * Normalize H2H raw matches into our H2HResult shape.
 * homeId/awayId refers to the CURRENT fixture's home and away teams.
 */
function normalizeH2H(
  rawH2H: RawMatch[],
  currentHomeId: number
): H2HResult[] {
  return rawH2H
    .filter((m) => m.score?.fullTime?.home != null && m.score?.fullTime?.away != null)
    .sort((a, b) => new Date(a.utcDate).getTime() - new Date(b.utcDate).getTime())
    .slice(-10)
    .map((m) => {
      // Flip goals if the current home team was away in this h2h match.
      const isHome = m.homeTeam.id === currentHomeId;
      const homeGoals = (isHome ? m.score!.fullTime!.home : m.score!.fullTime!.away) ?? 0;
      const awayGoals = (isHome ? m.score!.fullTime!.away : m.score!.fullTime!.home) ?? 0;
      const outcome: H2HResult['outcome'] =
        homeGoals > awayGoals ? 'home' : homeGoals === awayGoals ? 'draw' : 'away';
      return { date: m.utcDate.slice(0, 10), homeGoals, awayGoals, outcome };
    });
}

/**
 * Map a raw match into a normalized Fixture.
 */
async function toFixture(
  raw: RawMatch,
  stats: Map<number, Team>,
  form: Map<number, Array<'W' | 'D' | 'L'>>,
  splits: Map<number, { sh: number; ch: number; hp: number; sa: number; ca: number; ap: number }>,
  odds: MarketOdds | null,
  h2h: H2HResult[]
): Promise<Fixture> {
  const home = await resolveTeam(raw.homeTeam, stats);
  const away = await resolveTeam(raw.awayTeam, stats);

  // Apply league-derived form if available.
  home.form = form.get(raw.homeTeam.id) ?? home.form;
  away.form = form.get(raw.awayTeam.id) ?? away.form;

  // Apply venue splits if available.
  const hs = splits.get(raw.homeTeam.id);
  if (hs && hs.hp > 0) {
    home.avgScoredHome = hs.sh / hs.hp;
    home.avgConcededHome = hs.ch / hs.hp;
  }
  const as_ = splits.get(raw.awayTeam.id);
  if (as_ && as_.ap > 0) {
    away.avgScoredAway = as_.sa / as_.ap;
    away.avgConcededAway = as_.ca / as_.ap;
  }

  return {
    id: String(raw.id),
    league: raw.competition.name,
    leagueCode: raw.competition.code,
    leagueLogo: raw.competition.emblem,
    kickoff: raw.utcDate,
    status: raw.status,
    home,
    away,
    odds,
    h2h,
  };
}

/**
 * Fetch and normalize all scheduled matches in a date window across tracked
 * competitions. v2: also fetches H2H for each fixture.
 */
export async function getNormalizedFixtures(
  dateFrom: string,
  dateTo: string
): Promise<Fixture[]> {
  let raw: RawMatch[] = [];
  try {
    raw = (await getMatches(dateFrom, dateTo)).matches;
  } catch {
    return [];
  }

  const upcoming = raw.filter(
    (m) => m.status === 'SCHEDULED' || m.status === 'TIMED'
  );
  if (upcoming.length === 0) return [];

  const byComp = new Map<string, RawMatch[]>();
  for (const m of upcoming) {
    const code = m.competition.code;
    if (!COMPETITIONS.includes(code)) continue;
    const arr = byComp.get(code) ?? [];
    arr.push(m);
    byComp.set(code, arr);
  }

  const recentFrom = addDays(dateFrom, -45);
  const recentTo = addDays(dateFrom, 1);
  const fixtures: Fixture[] = [];

  for (const [code, matches] of byComp) {
    let stats = new Map<number, Team>();
    let form = new Map<number, Array<'W' | 'D' | 'L'>>();
    let splits = new Map<number, { sh: number; ch: number; hp: number; sa: number; ca: number; ap: number }>();
    let oddsEntries: OddsEntry[] = [];

    try {
      stats = buildTeamStats(await getStandings(code));
    } catch {
      stats = new Map();
    }
    try {
      const recentMatches = await getRecentMatches(code, recentFrom, recentTo);
      const derived = buildFormAndSplits(recentMatches);
      form = derived.form;
      splits = derived.splits;
    } catch {
      form = new Map();
      splits = new Map();
    }
    try {
      oddsEntries = await getOddsForCompetition(code);
    } catch {
      oddsEntries = [];
    }

    for (const m of matches) {
      const odds: MarketOdds | null = matchOdds(
        m.homeTeam.shortName || m.homeTeam.name,
        m.awayTeam.shortName || m.awayTeam.name,
        m.utcDate,
        oddsEntries
      );
      // Fetch H2H for this specific pair (cached 24h per pair).
      let h2h: H2HResult[] = [];
      try {
        const rawH2H = await getH2H(m.homeTeam.id, m.awayTeam.id);
        h2h = normalizeH2H(rawH2H, m.homeTeam.id);
      } catch {
        h2h = [];
      }
      fixtures.push(await toFixture(m, stats, form, splits, odds, h2h));
    }
  }

  return fixtures;
}
