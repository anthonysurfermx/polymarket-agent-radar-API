---
name: find-opportunities
description: Combined intelligence workflow to find the best Polymarket trading opportunities. Chains smart money consensus, alpha signals, bond yields, and market analysis into ranked recommendations with edge calculation. Use when the user wants actionable trade ideas, asks "what should I bet on?", or wants a full market scan.
---

# Find Opportunities

A combined intelligence workflow that chains multiple Polymarket Agent Radar endpoints to find the best trading opportunities. This skill orchestrates smart money data, alpha signals, and bond yields into ranked, actionable recommendations.

## When to Use This Skill

- User asks "what should I bet on?"
- User wants the best opportunities on Polymarket right now
- User gives a budget and risk level (e.g., "$500, medium risk")
- User asks for a full market scan or top picks
- User wants actionable trade recommendations, not just data

## Prerequisites

- Base URL: `https://polymarket-agent-radar-api.vercel.app`
- Auth: `Authorization: Bearer bw_live_YOUR_KEY`
- Get a key at: https://defimexico.org/agentic-world

## Workflow

Follow these steps in order to build a comprehensive recommendation:

### Step 1: Get Smart Money Consensus

```bash
curl -H "Authorization: Bearer bw_live_xxx" \
  "https://polymarket-agent-radar-api.vercel.app/api/v1/smart-money?walletCount=50"
```

Extract:
- Top consensus markets (most trader overlap + capital)
- Edge opportunities (PROFIT vs UNDERWATER)
- Recent whale signals (what are they buying RIGHT NOW)

### Step 2: Get Alpha Signals

```bash
curl -H "Authorization: Bearer bw_live_xxx" \
  "https://polymarket-agent-radar-api.vercel.app/api/v1/smart-money/alpha"
```

Extract:
- Whale convergence signals (3+ traders on same market)
- Underwater accumulation (contrarian alpha)
- High conviction clusters

### Step 3: Get Bond Opportunities (for low-risk allocation)

```bash
curl -H "Authorization: Bearer bw_live_xxx" \
  "https://polymarket-agent-radar-api.vercel.app/api/v1/bonds?sort=apy&limit=5"
```

Extract:
- Top 5 bonds by APY for the "safe" portion of the portfolio

### Step 4: Deep Dive on Top Picks (optional)

For the top 2-3 markets from Steps 1-2, get detailed holder analysis:

```bash
curl -H "Authorization: Bearer bw_live_xxx" \
  "https://polymarket-agent-radar-api.vercel.app/api/v1/market/MARKET_SLUG"
```

### Step 5: Synthesize and Rank

Combine all data into ranked recommendations.

## How to Present Results

Structure your response as a ranked list of opportunities:

**For each opportunity include:**
1. Market question and current odds
2. Recommended side (YES/NO) and why
3. Smart money alignment: consensus %, trader count, capital direction
4. Edge: SM entry price vs current price (PROFIT/UNDERWATER)
5. Alpha signals: any convergence, accumulation, or conviction clusters
6. Risk level: LOW / MEDIUM / HIGH
7. Suggested allocation: percentage of budget

**Portfolio construction by risk level:**

- **Low risk**: 70% bonds + 20% high-consensus markets + 10% alpha signals
- **Medium risk**: 40% high-consensus + 30% alpha signals + 20% bonds + 10% contrarian
- **High risk**: 50% alpha signals + 30% contrarian (underwater accumulation) + 20% high-consensus

**Always end with:**
- Total number of markets scanned
- Data freshness (cached for 5 min)
- Disclaimer: this is intelligence, not financial advice

## Position Sizing (Half-Kelly)

For each opportunity, calculate suggested position size:

```
edge = (smartMoneyConsensus / 100) - marketPrice
kellyFraction = edge / (1 - marketPrice)
halfKelly = kellyFraction / 2
positionSize = min(halfKelly * budget, budget * 0.25)  // cap at 25%
```

## Important Notes

- Never suggest more than 25% of budget on a single market
- Cross-reference: if a market appears in BOTH consensus AND alpha, it's highest conviction
- UNDERWATER + still BUYING = strongest contrarian signal
- Smart money is not always right — present probabilities, not certainties
- This skill makes multiple API calls — be mindful of rate limits
