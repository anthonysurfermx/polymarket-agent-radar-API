---
name: bond-scanner
description: Find near-certain Polymarket positions that act as bonds — high probability outcomes with calculable APY and return. Use when the user asks about low-risk opportunities, yield on Polymarket, bond-like positions, safe bets, or wants to earn yield on prediction markets.
---

# Bond Scanner

Find "bond" opportunities on Polymarket — markets trading at 90-99¢ where the outcome is near-certain. Calculate APY based on time to resolution and return percentage.

## When to Use This Skill

- User asks about low-risk or safe opportunities on Polymarket
- User wants yield or APY from prediction markets
- User asks "where can I earn yield on Polymarket?"
- User is looking for bond-like fixed income positions
- User wants to deploy capital with minimal risk

## Prerequisites

- Base URL: `https://polymarket-agent-radar-api.vercel.app`
- Auth: `Authorization: Bearer bw_live_YOUR_KEY`
- Get a key at: https://defimexico.org/agentic-world

## Endpoint

```bash
curl -H "Authorization: Bearer bw_live_xxx" \
  "https://polymarket-agent-radar-api.vercel.app/api/v1/bonds?minPrice=0.90&maxPrice=0.99&minLiquidity=500&sort=apy&limit=20"
```

**Parameters:**
- `minPrice` (optional, default: 0.90) — minimum bond price (0.90 = 90¢)
- `maxPrice` (optional, default: 0.99) — maximum bond price (0.99 = 99¢)
- `minLiquidity` (optional, default: 500) — minimum liquidity in USD
- `minVolume` (optional, default: 1000) — minimum trading volume in USD
- `limit` (optional, default: 100) — max results
- `sort` (optional, default: 'apy') — sort by: `apy`, `return`, `liquidity`, or `volume`

**Response contains:**
- `data` — array of bond opportunities, each with:
  - `market` — question, slug, end date
  - `side` — YES or NO
  - `price` — current price (e.g., 0.95 = buy at 95¢, collect $1)
  - `returnPct` — return percentage (e.g., 5.26% for 95¢ bond)
  - `apy` — annualized return based on time to resolution
  - `liquidity` — available liquidity
  - `volume` — trading volume
  - `holders` — number of position holders
  - `timeLeft` — human-readable time to resolution
- `meta.count` — number of bonds found
- `meta.filters` — applied filter values

## How to Present Results

1. Rank by APY — highest annualized return first
2. For each bond show: market question, price, return %, APY, liquidity, time to resolution
3. Flag risks: low liquidity (hard to fill), very short time (may be priced in), low holder count (thin market)
4. Check if the "safe" outcome could realistically NOT happen — that's the risk
5. Recommend whether to spread across multiple bonds or concentrate
6. Note that $1,000+ deployments need sufficient liquidity to fill

## Example Interpretation

A bond at 96¢ with 15 days to resolution:
- Return: 4.17% (buy at 96¢, collect $1.00)
- APY: ~101% annualized
- Risk: 4% chance the "certain" outcome doesn't happen
- Check: is $5,000 in liquidity enough for your position size?

## Important Notes

- Bonds are NOT risk-free — "near-certain" is not "certain"
- APY is theoretical (assumes you can repeat the trade at same rate)
- Always check liquidity before sizing your position
- Shorter time to resolution = higher APY but less absolute return
- Markets can resolve unexpectedly — black swan risk exists
