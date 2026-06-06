import type { Fixture } from '../engine/types.js';

/**
 * Realistic mock fixtures with team strength profiles and bookmaker odds.
 * These mirror the normalized shape the real data layer (football API + odds
 * API) would produce, so the engine and UI work identically once wired to live
 * data sources.
 */
export const mockFixtures: Fixture[] = [
  {
    id: 'epl-1',
    league: 'Premier League',
    kickoff: '2024-05-12T14:00:00Z',
    home: {
      id: 'mci',
      name: 'Man City',
      elo: 2010,
      avgScored: 2.6,
      avgConceded: 0.9,
      form: ['W', 'W', 'W', 'D', 'W'],
    },
    away: {
      id: 'whu',
      name: 'West Ham',
      elo: 1720,
      avgScored: 1.3,
      avgConceded: 1.7,
      form: ['L', 'D', 'L', 'W', 'L'],
    },
    odds: { home: 1.28, draw: 6.0, away: 9.5 },
  },
  {
    id: 'epl-2',
    league: 'Premier League',
    kickoff: '2024-05-12T16:30:00Z',
    home: {
      id: 'ars',
      name: 'Arsenal',
      elo: 1950,
      avgScored: 2.3,
      avgConceded: 1.0,
      form: ['W', 'W', 'D', 'W', 'W'],
    },
    away: {
      id: 'liv',
      name: 'Liverpool',
      elo: 1940,
      avgScored: 2.2,
      avgConceded: 1.1,
      form: ['W', 'D', 'W', 'W', 'L'],
    },
    odds: { home: 2.4, draw: 3.6, away: 2.8 },
  },
  {
    id: 'laliga-1',
    league: 'La Liga',
    kickoff: '2024-05-12T18:00:00Z',
    home: {
      id: 'getafe',
      name: 'Getafe',
      elo: 1660,
      avgScored: 1.1,
      avgConceded: 1.2,
      form: ['D', 'L', 'D', 'W', 'D'],
    },
    away: {
      id: 'rsoc',
      name: 'Real Sociedad',
      elo: 1790,
      avgScored: 1.6,
      avgConceded: 1.1,
      form: ['W', 'W', 'L', 'D', 'W'],
    },
    odds: { home: 3.2, draw: 3.0, away: 2.3 },
  },
  {
    id: 'seriea-1',
    league: 'Serie A',
    kickoff: '2024-05-12T19:45:00Z',
    home: {
      id: 'inter',
      name: 'Inter',
      elo: 1925,
      avgScored: 2.4,
      avgConceded: 0.8,
      form: ['W', 'W', 'W', 'W', 'D'],
    },
    away: {
      id: 'torino',
      name: 'Torino',
      elo: 1700,
      avgScored: 1.0,
      avgConceded: 1.0,
      form: ['D', 'D', 'L', 'D', 'W'],
    },
    odds: { home: 1.55, draw: 4.0, away: 6.5 },
  },
  {
    id: 'bundes-1',
    league: 'Bundesliga',
    kickoff: '2024-05-12T13:30:00Z',
    home: {
      id: 'leverkusen',
      name: 'Leverkusen',
      elo: 1960,
      avgScored: 2.5,
      avgConceded: 0.9,
      form: ['W', 'W', 'W', 'W', 'W'],
    },
    away: {
      id: 'bochum',
      name: 'Bochum',
      elo: 1580,
      avgScored: 1.2,
      avgConceded: 2.0,
      form: ['L', 'L', 'D', 'L', 'L'],
    },
    odds: { home: 1.18, draw: 7.5, away: 13.0 },
  },
  {
    id: 'ligue1-1',
    league: 'Ligue 1',
    kickoff: '2024-05-12T19:00:00Z',
    home: {
      id: 'lens',
      name: 'Lens',
      elo: 1780,
      avgScored: 1.5,
      avgConceded: 1.2,
      form: ['W', 'D', 'W', 'L', 'D'],
    },
    away: {
      id: 'monaco',
      name: 'Monaco',
      elo: 1840,
      avgScored: 1.9,
      avgConceded: 1.3,
      form: ['W', 'W', 'D', 'W', 'L'],
    },
    odds: { home: 2.9, draw: 3.5, away: 2.35 },
  },
];
