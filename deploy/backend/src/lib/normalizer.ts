import type { Fixture, Team, MarketOdds, H2HResult } from './types.js';
import { getMatches, getStandings, getRecentMatches, getTeamMatches, getH2H, COMPETITIONS, type RawMatch, type RawTableRow } from './api-football.js';
import { getOddsForCompetition, type OddsEntry } from './odds-api.js';
import { matchOdds } from './match-odds.js';

function addDays(date: string, days: number): string {
  const d = new Date(date + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function deriveElo(s: RawTableRow): number {
  const played = Math.max(1, s.playedGames);
  return 1500 + (s.points / played - 1.4) * 220 + (s.goalDifference / played) * 60;
}

function buildTeamStats(table: RawTableRow[]): Map<number, Team> {
  const map = new Map<number, Team>();
  for (const row of table) {
    if (row.playedGames < 3) continue;
    const played = row.playedGames;
    map.set(row.team.id, { id: String(row.team.id), name: row.team.shortName || row.team.name, logo: row.team.crest, elo: deriveElo(row), avgScored: row.goalsFor / played, avgConceded: row.goalsAgainst / played, avgScoredHome: 0, avgScoredAway: 0, avgConcededHome: 0, avgConcededAway: 0, form: [], hasData: true });
  }
  return map;
}

async function deriveTeamFromHistory(teamId: number, meta: { id: number; name: string; shortName: string; crest: string }): Promise<Team | null> {
  let matches: RawMatch[] = [];
  try { matches = await getTeamMatches(teamId, 15); } catch { return null; }
  const played = matches.filter((m) => m.score?.fullTime?.home != null && m.score?.fullTime?.away != null);
  if (played.length < 4) return null;
  let scored = 0, conceded = 0, points = 0, scoredHome = 0, concededHome = 0, homePlayed = 0, scoredAway = 0, concededAway = 0, awayPlayed = 0;
  const chrono = [...played].sort((a, b) => new Date(a.utcDate).getTime() - new Date(b.utcDate).getTime());
  const form: Array<'W' | 'D' | 'L'> = [];
  for (const m of chrono) {
    const isHome = m.homeTeam.id === teamId;
    const gf = (isHome ? m.score?.fullTime?.home : m.score?.fullTime?.away) ?? 0;
    const ga = (isHome ? m.score?.fullTime?.away : m.score?.fullTime?.home) ?? 0;
    scored += gf; conceded += ga;
    if (isHome) { scoredHome += gf; concededHome += ga; homePlayed++; } else { scoredAway += gf; concededAway += ga; awayPlayed++; }
    if (gf > ga) { points += 3; form.push('W'); } else if (gf === ga) { points += 1; form.push('D'); } else { form.push('L'); }
  }
  const n = played.length;
  return { id: String(teamId), name: meta.shortName || meta.name, logo: meta.crest, elo: 1500 + (points / n - 1.4) * 220 + ((scored - conceded) / n) * 60, avgScored: scored / n, avgConceded: conceded / n, avgScoredHome: homePlayed > 0 ? scoredHome / homePlayed : 0, avgScoredAway: awayPlayed > 0 ? scoredAway / awayPlayed : 0, avgConcededHome: homePlayed > 0 ? concededHome / homePlayed : 0, avgConcededAway: awayPlayed > 0 ? concededAway / awayPlayed : 0, form: form.slice(-5), hasData: true };
}

function buildFormAndSplits(matches: RawMatch[]) {
  const sorted = [...matches].sort((a, b) => new Date(a.utcDate).getTime() - new Date(b.utcDate).getTime());
  const form = new Map<number, Array<'W' | 'D' | 'L'>>();
  const splits = new Map<number, { sh: number; ch: number; hp: number; sa: number; ca: number; ap: number }>();
  const ensureSplit = (id: number) => { if (!splits.has(id)) splits.set(id, { sh: 0, ch: 0, hp: 0, sa: 0, ca: 0, ap: 0 }); return splits.get(id)!; };
  const pushForm = (id: number, r: 'W' | 'D' | 'L') => { const arr = form.get(id) ?? []; arr.push(r); form.set(id, arr.slice(-5)); };
  for (const m of sorted) {
    const h = m.score?.fullTime?.home; const a = m.score?.fullTime?.away;
    if (h == null || a == null) continue;
    const hs = ensureSplit(m.homeTeam.id); hs.sh += h; hs.ch += a; hs.hp++;
    const as_ = ensureSplit(m.awayTeam.id); as_.sa += a; as_.ca += h; as_.ap++;
    if (h > a) { pushForm(m.homeTeam.id, 'W'); pushForm(m.awayTeam.id, 'L'); }
    else if (h < a) { pushForm(m.homeTeam.id, 'L'); pushForm(m.awayTeam.id, 'W'); }
    else { pushForm(m.homeTeam.id, 'D'); pushForm(m.awayTeam.id, 'D'); }
  }
  return { form, splits };
}

function fallbackTeam(raw: { id: number; name: string; shortName: string; crest: string }): Team {
  return { id: String(raw.id), name: raw.shortName || raw.name, logo: raw.crest, elo: 1500, avgScored: 1.3, avgConceded: 1.3, avgScoredHome: 0, avgScoredAway: 0, avgConcededHome: 0, avgConcededAway: 0, form: [], hasData: false };
}

async function resolveTeam(raw: { id: number; name: string; shortName: string; crest: string }, stats: Map<number, Team>): Promise<Team> {
  const fromStandings = stats.get(raw.id);
  if (fromStandings) return { ...fromStandings };
  const fromHistory = await deriveTeamFromHistory(raw.id, raw);
  if (fromHistory) return fromHistory;
  return fallbackTeam(raw);
}

function normalizeH2H(rawH2H: RawMatch[], currentHomeId: number): H2HResult[] {
  return rawH2H.filter((m) => m.score?.fullTime?.home != null && m.score?.fullTime?.away != null)
    .sort((a, b) => new Date(a.utcDate).getTime() - new Date(b.utcDate).getTime()).slice(-10)
    .map((m) => {
      const isHome = m.homeTeam.id === currentHomeId;
      const homeGoals = (isHome ? m.score!.fullTime!.home : m.score!.fullTime!.away) ?? 0;
      const awayGoals = (isHome ? m.score!.fullTime!.away : m.score!.fullTime!.home) ?? 0;
      const outcome: H2HResult['outcome'] = homeGoals > awayGoals ? 'home' : homeGoals === awayGoals ? 'draw' : 'away';
      return { date: m.utcDate.slice(0, 10), homeGoals, awayGoals, outcome };
    });
}

async function toFixture(raw: RawMatch, stats: Map<number, Team>, form: Map<number, Array<'W' | 'D' | 'L'>>, splits: Map<number, { sh: number; ch: number; hp: number; sa: number; ca: number; ap: number }>, odds: MarketOdds | null, h2h: H2HResult[]): Promise<Fixture> {
  const home = await resolveTeam(raw.homeTeam, stats);
  const away = await resolveTeam(raw.awayTeam, stats);
  home.form = form.get(raw.homeTeam.id) ?? home.form;
  away.form = form.get(raw.awayTeam.id) ?? away.form;
  const hs = splits.get(raw.homeTeam.id);
  if (hs && hs.hp > 0) { home.avgScoredHome = hs.sh / hs.hp; home.avgConcededHome = hs.ch / hs.hp; }
  const as_ = splits.get(raw.awayTeam.id);
  if (as_ && as_.ap > 0) { away.avgScoredAway = as_.sa / as_.ap; away.avgConcededAway = as_.ca / as_.ap; }
  return { id: String(raw.id), league: raw.competition.name, leagueCode: raw.competition.code, leagueLogo: raw.competition.emblem, kickoff: raw.utcDate, status: raw.status, home, away, odds, h2h };
}

export async function getNormalizedFixtures(dateFrom: string, dateTo: string): Promise<Fixture[]> {
  let raw: RawMatch[] = [];
  try { raw = (await getMatches(dateFrom, dateTo)).matches; } catch { return []; }
  const upcoming = raw.filter((m) => m.status === 'SCHEDULED' || m.status === 'TIMED');
  if (upcoming.length === 0) return [];
  const byComp = new Map<string, RawMatch[]>();
  for (const m of upcoming) { if (!COMPETITIONS.includes(m.competition.code)) continue; const arr = byComp.get(m.competition.code) ?? []; arr.push(m); byComp.set(m.competition.code, arr); }
  const recentFrom = addDays(dateFrom, -45); const recentTo = addDays(dateFrom, 1);
  const fixtures: Fixture[] = [];
  for (const [code, matches] of byComp) {
    let stats = new Map<number, Team>(); let form = new Map<number, Array<'W' | 'D' | 'L'>>(); let splits = new Map<number, { sh: number; ch: number; hp: number; sa: number; ca: number; ap: number }>(); let oddsEntries: OddsEntry[] = [];
    try { stats = buildTeamStats(await getStandings(code)); } catch { stats = new Map(); }
    try { const d = buildFormAndSplits(await getRecentMatches(code, recentFrom, recentTo)); form = d.form; splits = d.splits; } catch { form = new Map(); splits = new Map(); }
    try { oddsEntries = await getOddsForCompetition(code); } catch { oddsEntries = []; }
    for (const m of matches) {
      const odds = matchOdds(m.homeTeam.shortName || m.homeTeam.name, m.awayTeam.shortName || m.awayTeam.name, m.utcDate, oddsEntries);
      let h2h: H2HResult[] = [];
      try { h2h = normalizeH2H(await getH2H(m.homeTeam.id, m.awayTeam.id), m.homeTeam.id); } catch { h2h = []; }
      fixtures.push(await toFixture(m, stats, form, splits, odds, h2h));
    }
  }
  return fixtures;
}
