---
name: smart-money
description: Track what the top 50 PnL traders on Polymarket are buying and selling right now. Get consensus markets, alpha signals, whale convergence, and capital flow analysis. Use when the user asks about smart money, whale activity, what top traders are doing, or market consensus on Polymarket.
---

# Smart Money Tracker

Track the top 50 profitable traders on Polymarket in real-time. See where smart money is concentrating, which markets have trader overlap, and where whales are converging.

## When to Use This Skill

- User asks "what are whales buying on Polymarket?"
- User asks about smart money consensus or top trader positions
- User wants to know where the most profitable traders are concentrating capital
- User asks for alpha signals or convergence scores
- User wants to follow smart money into prediction markets

## Prerequisites

You need an API key from the Polymarket Agent Radar API.

- Base URL: `https://polymarket-agent-radar-api.vercel.app`
- Auth: `Authorization: Bearer bw_live_YOUR_KEY`
- Get a key at: https://defimexico.org/agentic-world

## Endpoints

### 1. Smart Money Consensus

Full scan of top traders — positions, capital flow, whale signals, edge tracker, portfolio insights.

```bash
curl -H "Authorization: Bearer bw_live_xxx" \
  "https://polymarket-agent-radar-api.vercel.app/api/v1/smart-money?category=OVERALL&timePeriod=MONTH&walletCount=50"
```

**Parameters:**
- `category` (optional): `OVERALL`, `POLITICS`, `CRYPTO`, `SPORTS`, `ENTERTAINMENT` — default: `OVERALL`
- `timePeriod` (optional): `DAY`, `WEEK`, `MONTH`, `SEASON`, `ALL` — default: `MONTH`
- `walletCount` (optional): number of top wallets to scan (max 50)

**Response contains:**
- `consensusMarkets` — markets where 2+ top traders overlap, ranked by capital
- `edgeOpportunities` — smart money avg entry price vs current market price (PROFIT = SM bought cheap; UNDERWATER = SM bought high)
- `recentSignals` — buy/sell trades from whales in last 72 hours
- `portfolioInsights` — concentration, hedges, conviction bets per trader
- `topTraders` — PnL, volume, positions for each scanned trader

### 2. Alpha Signals

Cross-referenced intelligence from multiple data streams — the highest-conviction signals.

```bash
curl -H "Authorization: Bearer bw_live_xxx" \
  "https://polymarket-agent-radar-api.vercel.app/api/v1/smart-money/alpha"
```

**Signal types detected:**
- **Whale Convergence** — 3+ traders independently buying the same outcome in 24h
- **Underwater Accumulation** — SM losing money but still buying (contrarian alpha)
- **Yield + Momentum** — Bond opportunity aligned with SM bullish consensus
- **High Conviction Cluster** — 2+ traders with >20% portfolio in same market
- **OI Surge + Consensus** — High open interest combined with SM consensus

### 3. Convergence Scores

How aligned are smart money traders on each market? High convergence = strong consensus.

```bash
curl -H "Authorization: Bearer bw_live_xxx" \
  "https://polymarket-agent-radar-api.vercel.app/api/v1/smart-money/convergence"
```

**Response contains:**
- `convergenceScores` — per-market alignment score (0-100)
- `markets` — conditionId, title, slug, traderCount, totalCapital, topOutcome

## How to Present Results

1. Lead with the strongest consensus markets (highest capital + most trader overlap)
2. Highlight EDGE: where SM is in PROFIT vs UNDERWATER — cross-reference with whale signals
3. Flag alpha signals by confidence level
4. Note divergences: when capital consensus and headcount consensus disagree, one whale may be going against the crowd
5. End with actionable takeaways: which 2-3 markets have the best risk/reward

## Important Notes

- Data is cached for 5 minutes on the API side
- UNDERWATER + still BUYING = DCA/conviction (bullish signal)
- UNDERWATER + SELLING = capitulation (bearish exit signal)
- Smart money is not always right — it's a signal, not a guarantee
