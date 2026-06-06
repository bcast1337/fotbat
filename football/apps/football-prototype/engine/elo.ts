import type { Team } from './types.js';

/**
 * ELO-based team strength model.
 *
 * Converts the ELO rating difference between two teams into a win expectancy,
 * with a configurable home-field advantage applied to the home side.
 */

/** Home advantage expressed in ELO points. */
export const HOME_ADVANTAGE = 65;

/** K-factor controlling how fast ratings update after a result. */
export const K_FACTOR = 24;

/**
 * Compute the expected score (win expectancy, 0-1) for team A vs team B.
 *
 * @param eloA - rating of team A (advantage already applied if home).
 * @param eloB - rating of team B.
 * @returns expected result for A in the range 0-1.
 */
export function expectedScore(eloA: number, eloB: number): number {
  return 1 / (1 + Math.pow(10, (eloB - eloA) / 400));
}

/**
 * Derive a home/away strength split from two teams' ELO ratings.
 * Home advantage is added to the home rating before comparison.
 *
 * @param home - home team.
 * @param away - away team.
 * @returns object with home and away win expectancies (sum to 1).
 */
export function strengthSplit(home: Team, away: Team): { home: number; away: number } {
  const homeExp = expectedScore(home.elo + HOME_ADVANTAGE, away.elo);
  return { home: homeExp, away: 1 - homeExp };
}

/**
 * Update both teams' ELO ratings after a match result.
 *
 * @param home - home team (mutated copy returned).
 * @param away - away team (mutated copy returned).
 * @param homeGoals - goals scored by home team.
 * @param awayGoals - goals scored by away team.
 * @returns new team objects with updated ELO ratings.
 */
export function updateElo(
  home: Team,
  away: Team,
  homeGoals: number,
  awayGoals: number
): { home: Team; away: Team } {
  const expHome = expectedScore(home.elo + HOME_ADVANTAGE, away.elo);
  const expAway = 1 - expHome;
  const actualHome = homeGoals > awayGoals ? 1 : homeGoals === awayGoals ? 0.5 : 0;
  const actualAway = 1 - actualHome;
  // Goal-difference multiplier rewards decisive wins.
  const margin = Math.abs(homeGoals - awayGoals);
  const multiplier = Math.log(margin + 1) + 1;
  return {
    home: { ...home, elo: home.elo + K_FACTOR * multiplier * (actualHome - expHome) },
    away: { ...away, elo: away.elo + K_FACTOR * multiplier * (actualAway - expAway) },
  };
}
