import express from 'express';
import { FootballService } from './football-service.js';
import { addBet, settleBet, deleteBet, getBets, getBankrollSummary } from './lib/bet-tracker.js';

/**
 * Express entry point for the Football Intelligence backend.
 *
 * Exposes a small REST API consumed by the dashboard:
 *  - GET /api/health           service + API-key status
 *  - GET /api/predictions      all analyzed fixtures (optional ?date=)
 *  - GET /api/value-bets       only value-bet fixtures (optional ?date=)
 *  - GET /api/stats            summary stats for the header
 *
 * CORS is enabled so the React app (served from a different origin in the
 * workspace and in production) can call it with credentials.
 */
export function run() {
  const app = express();
  const service = FootballService.from();
  const port = process.env.PORT || 3000;

  // Credentialed CORS: reflect origin + allow credentials.
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin) res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
      res.sendStatus(204);
      return;
    }
    next();
  });

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, apiConfigured: Boolean(process.env.API_FOOTBALL_KEY) });
  });

  const parseDays = (q: unknown): number =>
    typeof q === 'string' && !Number.isNaN(Number(q)) ? Number(q) : 7;
  const parseDate = (q: unknown): string | undefined =>
    typeof q === 'string' ? q : undefined;

  app.get('/api/predictions', async (req, res) => {
    try {
      res.json(await service.getPredictions(parseDate(req.query.from), parseDays(req.query.days)));
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.get('/api/value-bets', async (req, res) => {
    try {
      res.json(await service.getValueBets(parseDate(req.query.from), parseDays(req.query.days)));
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.get('/api/stats', async (req, res) => {
    try {
      res.json(await service.getStats(parseDate(req.query.from), parseDays(req.query.days)));
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.get('/api/backtest', async (_req, res) => {
    try {
      res.json(await service.getBacktestSummary());
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // ── Bet Tracker API ──────────────────────────────────────────────────────────

  app.use(express.json());

  app.get('/api/bets', (req, res) => {
    try {
      const status = req.query.status as string | undefined;
      const valid = ['pending', 'won', 'lost', 'void'] as const;
      const filter = valid.find((s) => s === status);
      res.json(getBets(filter));
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.post('/api/bets', (req, res) => {
    try {
      const bet = addBet(req.body);
      res.status(201).json(bet);
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  app.patch('/api/bets/:id', (req, res) => {
    try {
      const { status } = req.body as { status: 'won' | 'lost' | 'void' };
      const bet = settleBet(req.params.id, status);
      if (!bet) { res.status(404).json({ error: 'Bet not found' }); return; }
      res.json(bet);
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  app.delete('/api/bets/:id', (req, res) => {
    try {
      const ok = deleteBet(req.params.id);
      if (!ok) { res.status(404).json({ error: 'Bet not found' }); return; }
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.get('/api/bankroll', (req, res) => {
    try {
      const initial = Number(req.query.initial) || 1000;
      res.json(getBankrollSummary(initial));
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  const server = app.listen(port, () => {
    console.log(`🚀  Football Intelligence API ready at: http://localhost:${port}`);
  });

  return {
    port,
    stop: async () => {
      server.closeAllConnections();
      server.close();
    },
  };
}
