---
name: market-analyzer
description: Deep analysis of any Polymarket prediction market — top holders, bot detection on holders, order book depth, and open interest. Use when the user asks about a specific market, wants to analyze a prediction market, check who holds positions, or evaluate market structure on Polymarket.
---

# Market Analyzer

Analyze any Polymarket prediction market by its slug. Get top 50 holders with bot detection on the top 10, order book data, and open interest metrics.

## When to Use This Skill

- User mentions a specific Polymarket market or asks about a prediction
- User wants to know who holds positions in a market
- User asks about bot activity or agent rate in a specific market
- User wants order book depth or liquidity analysis
- User asks about open interest on a market

## Prerequisites

- Base URL: `https://polymarket-agent-radar-api.vercel.app`
- Auth: `Authorization: Bearer bw_live_YOUR_KEY`
- Get a key at: https://defimexico.org/agentic-world

## Endpoints

### 1. Market Details + Holder Scan

Full market analysis with bot detection on top holders.

```bash
curl -H "Authorization: Bearer bw_live_xxx" \
  "https://polymarket-agent-radar-api.vercel.app/api/v1/market/will-bitcoin-reach-100k-march"
```

The slug is the market's URL identifier on Polymarket (e.g., `will-bitcoin-reach-100k-march`).

**Response contains:**

`data.market`:
- `question` — the prediction question
- `slug` — URL identifier
- `volume` — total trading volume
- `liquidity` — current liquidity
- `endDate` — market resolution date
- `outcomes` — price/probability for each outcome

`data.holders`:
- Top 50 position holders with address, side, amount

`data.botDetection`:
- Bot analysis results on top 10 holders
- Per-holder: classification, botScore, strategy
- Aggregate: agent rate, strategy distribution, capital by side

### 2. Order Book

Bid/ask depth for a specific token in the market.

```bash
curl -H "Authorization: Bearer bw_live_xxx" \
  "https://polymarket-agent-radar-api.vercel.app/api/v1/orderbook/TOKEN_ID"
```

**Response contains:**
- `data` — full order book with bids and asks

### 3. Open Interest

How much capital is locked in a market.

```bash
# Single market
curl -H "Authorization: Bearer bw_live_xxx" \
  "https://polymarket-agent-radar-api.vercel.app/api/v1/open-interest/CONDITION_ID"

# Batch (up to 50 markets)
curl -H "Authorization: Bearer bw_live_xxx" \
  "https://polymarket-agent-radar-api.vercel.app/api/v1/open-interest?conditionIds=ID1,ID2,ID3"
```

**Response contains:**
- `data.openInterest` — total open interest value
- For batch: object mapping conditionId → openInterest

## How to Present Results

1. Start with the market question, current odds, volume, and liquidity
2. Show agent-to-human ratio among top holders — high bot rate = more efficient pricing
3. Identify which side (YES/NO) bots are concentrated on
4. Note dominant strategies among holders (Market Makers = liquidity providers, Snipers = informed bets)
5. Flag if smart money is aligned or divided
6. End with verdict: is this market fairly priced? Where is the edge?

## Important Notes

- Bot detection runs on top 10 holders only (for performance)
- Market slugs can be found on polymarket.com URLs
- High agent rate (>60%) suggests efficient pricing — harder to find edge
- Low agent rate (<20%) suggests less sophisticated market — potential mispricing
