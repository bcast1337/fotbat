import type { OddsEntry } from './odds-api.js';
import type { MarketOdds } from './types.js';

/**
 * Fuzzy matcher that links football-data.org fixtures to The Odds API events.
 *
 * The two providers use different team-name spellings (e.g. "Man City" vs
 * "Manchester City"), so we normalize names and match on token overlap plus
 * kickoff-time proximity.
 */

/** Normalize a team name for comparison. */
function normalize(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(fc|cf|afc|ac|ss|sc|club|de|cd|rc|calcio)\b/g, '')
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Token-overlap similarity between two names (0-1). */
function similarity(a: string, b: string): number {
  const ta = new Set(normalize(a).split(' ').filter(Boolean));
  const tb = new Set(normalize(b).split(' ').filter(Boolean));
  if (ta.size === 0 || tb.size === 0) return 0;
  let shared = 0;
  for (const t of ta) if (tb.has(t)) shared += 1;
  return shared / Math.max(ta.size, tb.size);
}

/**
 * Find the best odds match for a fixture among a competition's odds entries.
 *
 * @param homeName - fixture home team name.
 * @param awayName - fixture away team name.
 * @param kickoff - fixture kickoff ISO string.
 * @param entries - odds entries for the competition.
 * @returns matched market odds, or null if no confident match.
 */
export function matchOdds(
  homeName: string,
  awayName: string,
  kickoff: string,
  entries: OddsEntry[]
): MarketOdds | null {
  const kickoffTime = new Date(kickoff).getTime();
  let best: { score: number; odds: MarketOdds } | null = null;

  for (const entry of entries) {
    const homeSim = similarity(homeName, entry.home);
    const awaySim = similarity(awayName, entry.away);
    const nameScore = (homeSim + awaySim) / 2;
    // Require both sides to be a reasonable match.
    if (homeSim < 0.34 || awaySim < 0.34) continue;
    // Kickoff within 24h gets a small bonus; beyond that, penalize.
    const hoursApart = Math.abs(new Date(entry.commence).getTime() - kickoffTime) / 3.6e6;
    const timeScore = hoursApart <= 24 ? 0.2 : -0.2;
    const score = nameScore + timeScore;
    if (!best || score > best.score) {
      best = { score, odds: entry.odds };
    }
  }

  return best && best.score >= 0.5 ? best.odds : null;
}
