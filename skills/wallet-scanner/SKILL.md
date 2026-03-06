---
name: wallet-scanner
description: Analyze any Polymarket wallet for bot detection (7-signal system), strategy classification, P&L metrics, positions, and reliability score. Use when the user asks to scan a wallet, check if an address is a bot, analyze a trader's strategy, or evaluate a Polymarket address.
---

# Wallet Scanner

Scan any Polymarket wallet address to detect if it's a bot or human, classify its trading strategy, and evaluate its reliability. Uses a 7-signal bot detection system with 5 strategy archetypes.

## When to Use This Skill

- User provides a Polymarket wallet address and wants analysis
- User asks "is this wallet a bot?"
- User wants to know a trader's strategy, P&L, or win rate
- User asks about a specific trader's reliability or track record
- User wants to evaluate whether to copy-trade someone

## Prerequisites

- Base URL: `https://polymarket-agent-radar-api.vercel.app`
- Auth: `Authorization: Bearer bw_live_YOUR_KEY`
- Get a key at: https://defimexico.org/agentic-world

## Endpoints

### 1. Wallet Analysis

Full portfolio scan + bot detection + strategy classification.

```bash
curl -H "Authorization: Bearer bw_live_xxx" \
  "https://polymarket-agent-radar-api.vercel.app/api/v1/wallet/0x1234...abcd"
```

**Response contains:**

`data.metrics`:
- `portfolioValue` — current portfolio value in USD
- `profitPnL` — total profit/loss
- `winRate` — percentage of winning positions
- `tradeCount` — total trades executed

`data.positions`:
- Up to 200 current positions with title, outcome, value, PnL

`data.botDetection`:
- `botScore` — 0-100 composite score
- `classification` — `BOT`, `LIKELY_BOT`, `MIXED`, or `HUMAN`
- `signals` — individual signal scores (S1-S9):
  - S1: Interval Regularity (timing patterns)
  - S2: Split/Merge behavior (contract manipulation)
  - S3: Sizing Consistency (order sizing patterns)
  - S4: 24/7 Activity (never sleeps)
  - S5: Win Rate anomaly
  - S6: Market Concentration
  - S8: Maker/Taker ratio
  - S9: Fresh Wallet Detection
- `strategy` — classified archetype with confidence %

**Strategy Archetypes:**
- **MARKET_MAKER** ("The House") — provides liquidity on both sides, collects spread
- **SNIPER** ("Latency Arb") — exploits oracle lag, high ROI per trade
- **HYBRID** ("Spread + Alpha") — market-making base with directional overlays
- **MOMENTUM** ("Trend Rider") — scales into one direction following momentum
- **UNKNOWN** — not enough data to classify

### 2. Trader Reliability

Historical reliability score based on open + closed positions.

```bash
curl -H "Authorization: Bearer bw_live_xxx" \
  "https://polymarket-agent-radar-api.vercel.app/api/v1/trader/0x1234...abcd/reliability"
```

**Response contains:**
- Reliability metrics computed from up to 200 current + 100 closed positions
- Historical accuracy and consistency scores

## How to Present Results

1. Start with the classification: BOT / LIKELY_BOT / MIXED / HUMAN
2. Explain the strategy archetype and what it means for this wallet
3. Show key metrics: PnL, win rate, portfolio value
4. Highlight the strongest bot signals (highest individual scores)
5. Give a verdict: is this wallet worth following? What risks exist for copy-traders?

## Important Notes

- Bot score > 70 = very likely automated
- Bot score < 30 = very likely human
- 30-70 = mixed signals, look at individual S-scores
- Strategy classification requires sufficient trade history
- Some "bots" are sophisticated and profitable — being a bot is not inherently bad
