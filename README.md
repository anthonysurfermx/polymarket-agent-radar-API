<p align="center">
  <img src="public/api-announcement.svg" alt="Polymarket Agent Radar API" width="700" />
</p>

<h1 align="center">Polymarket Agent Radar API</h1>

<p align="center">
  <strong>Smart Money Intelligence Engine for Prediction Markets</strong>
  <br />
  Bot Detection &bull; Smart Money Tracking &bull; Alpha Signals &bull; AI Analysis
  <br /><br />
  <a href="https://polymarket-agent-radar-api.vercel.app/api/v1/health"><img src="https://img.shields.io/badge/status-live-brightgreen" alt="Status: Live" /></a>
  <a href="#endpoints"><img src="https://img.shields.io/badge/endpoints-13-blue" alt="13 Endpoints" /></a>
  <a href="#ai-agent-skills"><img src="https://img.shields.io/badge/skills-5-purple" alt="5 Skills" /></a>
  <a href="#authentication"><img src="https://img.shields.io/badge/auth-API%20key-orange" alt="Auth: API Key" /></a>
</p>

---

## What is Agent Radar?

Agent Radar is a REST API that provides real-time intelligence for Polymarket prediction markets. It scans token holders, detects bot manipulation, tracks smart money movements, computes convergence scores, and surfaces alpha signals.

Built by [DeFi Mexico](https://github.com/anthonysurfermx/defi-mexico-hub). Powers [BetWhisper.ai](https://betwhisper.ai).

## Quick Start

```bash
# Health check (no auth required)
curl https://polymarket-agent-radar-api.vercel.app/api/v1/health

# Authenticated request
curl -H "Authorization: Bearer bw_live_YOUR_KEY" \
  https://polymarket-agent-radar-api.vercel.app/api/v1/bonds
```

## Endpoints

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/api/v1/health` | Health check (no auth) |
| `GET` | `/api/v1/usage` | Current key usage stats |
| `GET` | `/api/v1/smart-money` | Full scan: leaderboard + consensus + edge + signals + portfolios + AI scores |
| `GET` | `/api/v1/smart-money/alpha` | Alpha signals only |
| `GET` | `/api/v1/smart-money/convergence` | Convergence scores only |
| `GET` | `/api/v1/wallet/:address` | Wallet analysis: metrics + positions + bot detection + strategy |
| `GET` | `/api/v1/market/:slug` | Market info + holders + bot detection |
| `GET` | `/api/v1/trader/:address/reliability` | Trader reliability score |
| `GET` | `/api/v1/bonds` | Bond opportunities sorted by APY |
| `GET` | `/api/v1/orderbook/:tokenId` | Order book depth |
| `GET` | `/api/v1/open-interest/:conditionId` | Open interest for a market |
| `GET` | `/api/v1/open-interest?conditionIds=id1,id2` | Batch open interest |
| `POST` | `/api/v1/explain` | AI analysis with SSE streaming |

## Authentication

All endpoints (except `/health`) require an API key in the `Authorization` header:

```
Authorization: Bearer bw_live_YOUR_KEY_HERE
```

### Tiers

| Tier | Daily Limit | Use Case |
|------|-------------|----------|
| Free | 50 req/day | Testing & evaluation |
| Pro | 1,000 req/day | Production apps |
| Enterprise | 10,000 req/day | High-volume integrations |

Rate limit headers are included in every response:
- `X-RateLimit-Limit`
- `X-RateLimit-Remaining`
- `X-RateLimit-Reset`

## Intelligence Features

### 7-Signal Bot Detection
Behavioral fingerprinting with 5 strategy archetypes (Market Maker, Hybrid, Sniper, Momentum, Ghost Whale) and 4 classification tiers (bot, likely-bot, mixed, human).

### Smart Money Tracking
Scans up to 50 top PnL traders from the Polymarket leaderboard. Tracks positions, detects consensus markets, analyzes portfolio construction, and surfaces whale entry/exit signals.

### AI Scores
- **Convergence Score** (0-100): 5-component score measuring trader consensus, edge, momentum, and quality
- **Alpha Signals**: 5 cross-referenced signal types, confidence-ranked
- **Trader Reliability**: Win rate, PnL consistency, and diversification scoring

### AI Explain (SSE)
Stream AI-powered analysis for 10 different contexts: wallet, market, exchange-metrics, smart money signals, edge, portfolios, bonds, and alpha.

## AI Agent Skills

Install Polymarket intelligence directly into your AI coding agent. Works with Claude Code, Cursor, Windsurf, Copilot, and any agent that supports the skills standard.

```bash
# Install all skills
npx skills add anthonysurfermx/polymarket-agent-radar-API --all

# Or install individually
npx skills add anthonysurfermx/polymarket-agent-radar-API --skill smart-money
npx skills add anthonysurfermx/polymarket-agent-radar-API --skill wallet-scanner
npx skills add anthonysurfermx/polymarket-agent-radar-API --skill market-analyzer
npx skills add anthonysurfermx/polymarket-agent-radar-API --skill bond-scanner
npx skills add anthonysurfermx/polymarket-agent-radar-API --skill find-opportunities
```

### Available Skills

| Skill | Description |
|-------|-------------|
| `smart-money` | Track top 50 PnL traders — consensus, alpha signals, whale convergence |
| `wallet-scanner` | 7-signal bot detection + strategy classification on any wallet |
| `market-analyzer` | Deep market analysis — holders, bot rate, order book, open interest |
| `bond-scanner` | Find near-certain positions with APY calculation |
| `find-opportunities` | Combined workflow — chains all endpoints into ranked trade recommendations |

### Usage Example

After installing, just ask your AI agent naturally:

- *"What are the whales buying on Polymarket?"*
- *"Is wallet 0xABC a bot?"*
- *"Find me low-risk bond opportunities"*
- *"I have $1,000 and medium risk tolerance — what should I bet on?"*
- *"Analyze the Bitcoin 100k market on Polymarket"*

The agent will call the API endpoints automatically and present the intelligence.

## Tech Stack

- **Runtime**: Vercel Serverless Functions
- **Auth**: Supabase (shared with DeFi Mexico Hub)
- **AI**: Anthropic Claude (for `/explain` endpoint)
- **Data**: Polymarket Data API, Gamma API, CLOB API

## Environment Variables

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
ANTHROPIC_API_KEY=your-anthropic-key
```

## License

MIT

---

<p align="center">
  <strong>Powered by <a href="https://github.com/anthonysurfermx/defi-mexico-hub">DeFi Mexico</a></strong>
</p>
