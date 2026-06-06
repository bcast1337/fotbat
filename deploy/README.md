# Edge FC — Football Intelligence

> Hybrid ELO + Poisson football prediction engine with value bet detection, Kelly staking, extended markets, and a personal bankroll tracker.

## 🏗️ Structure

```
edge-fc/
├── backend/          # Express API (Node.js + TypeScript)
│   ├── src/
│   │   ├── index.ts           # Entry point
│   │   ├── football-service.ts
│   │   └── lib/
│   │       ├── types.ts       # Shared domain types
│   │       ├── api-football.ts # football-data.org client
│   │       ├── odds-api.ts    # The Odds API client
│   │       ├── engine.ts      # ELO + Poisson model
│   │       ├── normalizer.ts  # Data transformation
│   │       ├── backtest.ts    # Walk-forward backtesting
│   │       ├── bet-tracker.ts # Personal bet tracker
│   │       └── cache.ts       # TTL cache
│   ├── package.json
│   └── tsconfig.json
└── frontend/         # React + Vite dashboard
    ├── src/
    │   ├── main.tsx
    │   ├── App.tsx
    │   ├── ui/               # Components
    │   └── data/api.ts       # Backend client
    ├── package.json
    └── vite.config.ts
```

## 🚀 Deploy on Railway

### Backend service
1. New Project → Deploy from GitHub repo → select `backend/` as root
2. Set env vars: `API_FOOTBALL_KEY`, `ODDS_API_KEY`
3. Build: `npm run build` | Start: `npm start`

### Frontend service
1. New Project → Deploy from GitHub repo → select `frontend/` as root
2. Set env var: `VITE_BACKEND_URL=https://your-backend.railway.app`
3. Build: `npm run build` | Start: `npm run preview`

## 🔑 Required API Keys

| Key | Source | Free tier |
|-----|--------|-----------|
| `API_FOOTBALL_KEY` | [football-data.org](https://www.football-data.org/client/register) | ✅ Free (10 req/min) |
| `ODDS_API_KEY` | [the-odds-api.com](https://the-odds-api.com) | ✅ Free (500 req/month) |

## 🧠 Model Features

- **Hybrid ELO + Poisson** — blended 60/40
- **Home/Away splits** — venue-specific scoring averages
- **Head-to-head adjustment** — up to ±12% probability nudge
- **League-specific home advantage** — PL/La Liga/Serie A/Bundesliga/Ligue 1
- **Extended markets** — O/U 1.5, 2.5, 3.5 · BTTS · Asian Handicap · Correct Scores
- **Kelly Criterion** — Full, Half, Quarter Kelly stake recommendations
- **Value detection** — edge > 3pp vs market implied probability
- **Walk-forward backtest** — no look-ahead bias, real results
- **Bankroll tracker** — personal P&L with equity curve
