/**
 * Domain types shared across the football intelligence backend.
 */

/** A team with its dynamic strength rating and rolling scoring profile. */
export type Team = {
  id: string;
  name: string;
  logo?: string;
  /** Derived strength rating (ELO-like). */
  elo: number;
  /** Average goals scored per match this season (all). */
  avgScored: number;
  /** Average goals conceded per match this season (all). */
  avgConceded: number;
  /** Average goals scored at home / in away fixtures (last 8). */
  avgScoredHome: number;
  avgScoredAway: number;
  /** Average goals conceded at home / in away fixtures (last 8). */
  avgConcededHome: number;
  avgConcededAway: number;
  /** Recent form, most recent last. */
  form: Array<'W' | 'D' | 'L'>;
  /**
   * Whether this team has enough real data (standings or recent results) to
   * back its strength rating. When false, predictions are flagged as having
   * insufficient data and value detection is suppressed.
   */
  hasData: boolean;
};

/** Bookmaker decimal odds for the three main outcomes. */
export type MarketOdds = {
  home: number;
  draw: number;
  away: number;
};

/** Confidence the engine has in the data behind a prediction. */
export type DataQuality = 'full' | 'partial' | 'insufficient';

/** A single head-to-head result. */
export type H2HResult = {
  date: string;
  homeGoals: number;
  awayGoals: number;
  outcome: 'home' | 'draw' | 'away';
};

/** A fixture ready to be analyzed. */
export type Fixture = {
  id: string;
  league: string;
  leagueCode: string;
  leagueLogo?: string;
  kickoff: string;
  status: string;
  home: Team;
  away: Team;
  odds: MarketOdds | null;
  h2h: H2HResult[];
};

/** Outcome probabilities as fractions summing to ~1. */
export type OutcomeProbabilities = {
  home: number;
  draw: number;
  away: number;
};

/** Over/Under goal markets. */
export type GoalMarkets = {
  over25: number;
  under25: number;
  over15: number;
  under15: number;
  over35: number;
  under35: number;
  btts: number;       // both teams to score probability
  bttsFail: number;   // at least one team scores 0
};

/** Asian handicap probabilities for common lines. */
export type AsianHandicap = {
  homeMinusHalf: number;    // home -0.5 (home wins)
  homePlusHalf: number;     // home +0.5 (draw or home wins)
  awayMinusHalf: number;    // away -0.5 (away wins)
  awayPlusHalf: number;     // away +0.5 (draw or away wins)
  homeMinus1: number;       // home -1 (home wins by 2+)
  homePlus1: number;        // home +1 (home wins or draws)
};

/** Top correct score probabilities from the Poisson grid. */
export type CorrectScoreGrid = Array<{ score: string; probability: number }>;

/** Kelly Criterion stake recommendation for a single outcome. */
export type KellyStake = {
  outcome: 'home' | 'draw' | 'away' | 'over25' | 'under25' | 'btts';
  modelProbability: number;
  odds: number;
  edgePercentage: number;
  kellyFraction: number;    // raw Kelly fraction (0-1)
  halfKelly: number;        // conservative half-Kelly (recommended)
  quarterKelly: number;     // ultra-conservative quarter-Kelly
};

/** The fully analyzed, explainable prediction for a fixture. */
export type Prediction = {
  fixtureId: string;
  match: string;
  league: string;
  leagueCode: string;
  leagueLogo?: string;
  kickoff: string;
  homeName: string;
  awayName: string;
  homeLogo?: string;
  awayLogo?: string;
  homeForm: Array<'W' | 'D' | 'L'>;
  awayForm: Array<'W' | 'D' | 'L'>;
  odds: MarketOdds | null;
  /** How reliable the underlying data is for this prediction. */
  dataQuality: DataQuality;
  probabilities: { home: number; draw: number; away: number };
  expectedGoals: { home: number; away: number };
  likelyScore: string;
  confidenceScore: number;
  valueBet: boolean;
  bestValue: {
    outcome: 'home' | 'draw' | 'away';
    edgePercentage: number;
    modelProbability: number;
    impliedProbability: number;
    odds: number;
  } | null;
  edges: Array<{
    outcome: 'home' | 'draw' | 'away';
    modelProbability: number;
    impliedProbability: number;
    edgePercentage: number;
  }>;
  /** Extended goal markets derived from the Poisson grid. */
  goalMarkets: GoalMarkets;
  /** Top 6 correct score probabilities. */
  correctScores: CorrectScoreGrid;
  /** Asian handicap probabilities. */
  asianHandicap: AsianHandicap;
  /** Kelly Criterion stake recommendations (where edge > 0). */
  kellyStakes: KellyStake[];
  /** Head-to-head summary (last 5). */
  h2hSummary: {
    played: number;
    homeWins: number;
    draws: number;
    awayWins: number;
    avgGoals: number;
    bttsRate: number;
  };
  /** League home advantage factor (league-specific). */
  homeAdvantageFactor: number;
  explanation: string[];
};

/** A single bet logged in the tracker. */
export type TrackedBet = {
  id: string;
  fixtureId: string;
  match: string;
  league: string;
  kickoff: string;
  market: string;
  outcome: string;
  odds: number;
  stake: number;
  modelProbability: number;
  edgePercentage: number;
  status: 'pending' | 'won' | 'lost' | 'void';
  pnl: number;
  createdAt: string;
};

/** Bankroll tracker summary. */
export type BankrollSummary = {
  initialBankroll: number;
  currentBankroll: number;
  totalStaked: number;
  totalPnl: number;
  roi: number;
  winRate: number;
  activeBets: number;
  settledBets: number;
  bestBet: TrackedBet | null;
  worstBet: TrackedBet | null;
  pnlCurve: number[];
};
