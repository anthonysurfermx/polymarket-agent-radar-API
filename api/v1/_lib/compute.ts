// ============================================================================
// Polymarket Agent Radar API - Pure Computation Functions
// No React dependencies. Pure data → data transformations.
// ============================================================================

import type {
  SmartMoneyMarket,
  LeaderboardEntry,
  PolymarketPosition,
  OutcomeBias,
  WhaleSignal,
  TraderPortfolio,
  BondOpportunity,
  ConvergenceScore,
  AlphaSignal,
  TraderReliability,
} from './types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatUSD(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(0)}`;
}

// ---------------------------------------------------------------------------
// 1. aggregateSmartMoney
//    Groups positions by conditionId to produce market-level aggregation.
// ---------------------------------------------------------------------------

export function aggregateSmartMoney(
  leaderboard: LeaderboardEntry[],
  positionsByTrader: Map<string, PolymarketPosition[]>,
): SmartMoneyMarket[] {
  const marketMap = new Map<
    string,
    {
      conditionId: string;
      title: string;
      slug: string;
      traders: SmartMoneyMarket['traders'];
      outcomeCapital: Map<string, number>;
      outcomeHeadcount: Map<string, number>;
      totalPnl: number;
      latestPrice: number;
      totalEntryWeighted: number;
      totalEntryCapital: number;
      entryPriceMin: number;
      entryPriceMax: number;
    }
  >();

  for (const trader of leaderboard) {
    const positions = positionsByTrader.get(trader.proxyWallet) || [];
    for (const pos of positions) {
      const key = pos.conditionId || pos.title;
      if (!key || pos.currentValue < 0.5) continue;

      let entry = marketMap.get(key);
      if (!entry) {
        entry = {
          conditionId: pos.conditionId,
          title: pos.title,
          slug: pos.slug || pos.eventSlug,
          traders: [],
          outcomeCapital: new Map(),
          outcomeHeadcount: new Map(),
          totalPnl: 0,
          latestPrice: pos.curPrice,
          totalEntryWeighted: 0,
          totalEntryCapital: 0,
          entryPriceMin: Infinity,
          entryPriceMax: 0,
        };
        marketMap.set(key, entry);
      }

      const side = pos.outcome || 'Unknown';
      entry.outcomeCapital.set(
        side,
        (entry.outcomeCapital.get(side) || 0) + pos.currentValue,
      );
      entry.outcomeHeadcount.set(
        side,
        (entry.outcomeHeadcount.get(side) || 0) + 1,
      );
      entry.totalPnl += pos.cashPnl;
      if (pos.curPrice > 0) entry.latestPrice = pos.curPrice;
      if (pos.avgPrice > 0 && pos.currentValue > 0) {
        entry.totalEntryWeighted += pos.avgPrice * pos.currentValue;
        entry.totalEntryCapital += pos.currentValue;
        entry.entryPriceMin = Math.min(entry.entryPriceMin, pos.avgPrice);
        entry.entryPriceMax = Math.max(entry.entryPriceMax, pos.avgPrice);
      }

      entry.traders.push({
        address: trader.proxyWallet,
        name:
          trader.userName ||
          `${trader.proxyWallet.slice(0, 6)}...${trader.proxyWallet.slice(-4)}`,
        profileImage: trader.profileImage,
        rank: trader.rank,
        pnl: trader.pnl,
        volume: trader.volume,
        outcome: side,
        positionValue: pos.currentValue,
        entryPrice: pos.avgPrice,
        currentPnl: pos.cashPnl,
        xUsername: trader.xUsername,
      });
    }
  }

  const results: SmartMoneyMarket[] = [];
  for (const entry of marketMap.values()) {
    if (entry.traders.length < 2) continue;

    const totalCapital = Array.from(entry.outcomeCapital.values()).reduce(
      (a, b) => a + b,
      0,
    );
    const totalHeads = Array.from(entry.outcomeHeadcount.values()).reduce(
      (a, b) => a + b,
      0,
    );
    const outcomeBias: OutcomeBias[] = [];
    for (const [outcome, capital] of entry.outcomeCapital) {
      outcomeBias.push({
        outcome,
        capital,
        headcount: entry.outcomeHeadcount.get(outcome) || 0,
      });
    }
    outcomeBias.sort((a, b) => b.capital - a.capital);

    const top = outcomeBias[0];
    const topCapitalPct =
      totalCapital > 0
        ? Math.round((top.capital / totalCapital) * 100)
        : 0;
    const topHeadPct =
      totalHeads > 0
        ? Math.round((top.headcount / totalHeads) * 100)
        : 0;

    const capitalConsensus = Math.round(
      Math.abs(topCapitalPct - 100 / outcomeBias.length) *
        (outcomeBias.length / (outcomeBias.length - 1)),
    );
    const headConsensus = Math.round(
      Math.abs(topHeadPct - 100 / outcomeBias.length) *
        (outcomeBias.length / (outcomeBias.length - 1)),
    );

    results.push({
      conditionId: entry.conditionId,
      title: entry.title,
      slug: entry.slug,
      traderCount: entry.traders.length,
      totalCapital,
      topOutcome: top.outcome,
      topOutcomeCapitalPct: topCapitalPct,
      topOutcomeHeadPct: topHeadPct,
      capitalConsensus: Math.min(capitalConsensus, 100),
      headConsensus: Math.min(headConsensus, 100),
      outcomeBias,
      avgPnl: entry.totalPnl / entry.traders.length,
      currentPrice: entry.latestPrice,
      traders: entry.traders.sort((a, b) => b.positionValue - a.positionValue),
      avgEntryPrice:
        entry.totalEntryCapital > 0
          ? entry.totalEntryWeighted / entry.totalEntryCapital
          : 0,
      entryPriceMin:
        entry.entryPriceMin === Infinity ? 0 : entry.entryPriceMin,
      entryPriceMax: entry.entryPriceMax,
      marketPrice: entry.latestPrice,
      edgePercent: 0,
      edgeDirection: 'NEUTRAL' as const,
    });
  }

  results.sort((a, b) => {
    if (b.traderCount !== a.traderCount) return b.traderCount - a.traderCount;
    return b.capitalConsensus - a.capitalConsensus;
  });

  return results;
}

// ---------------------------------------------------------------------------
// 2. computeConvergenceScores
//    5-component score: consensus (25), edge (20), momentum (20),
//    validation (15), quality (20).
// ---------------------------------------------------------------------------

export function computeConvergenceScores(
  markets: SmartMoneyMarket[],
  whaleSignals: WhaleSignal[],
  openInterestMap: Map<string, number>,
  closedPositionsMap: Map<
    string,
    { wins: number; losses: number; totalPnl: number }
  >,
): Map<string, ConvergenceScore> {
  const map = new Map<string, ConvergenceScore>();
  if (markets.length === 0) return map;

  for (const market of markets) {
    // 1. Consensus (25 pts)
    const capitalScore = (market.capitalConsensus / 100) * 12;
    const headScore = (market.headConsensus / 100) * 8;
    const capitalBonus =
      market.totalCapital > 50000
        ? 5
        : market.totalCapital > 10000
          ? 3
          : market.totalCapital > 1000
            ? 1
            : 0;
    const consensus = Math.min(capitalScore + headScore + capitalBonus, 25);

    // 2. Edge (20 pts)
    let edge = 10;
    if (market.edgeDirection === 'PROFIT')
      edge = Math.min(10 + market.edgePercent * 0.5, 20);
    else if (market.edgeDirection === 'UNDERWATER')
      edge = Math.max(0, 5 - Math.abs(market.edgePercent) * 0.3);

    // 3. Momentum (20 pts)
    const marketSignals = whaleSignals.filter(
      (s) => s.marketSlug === market.slug || s.marketTitle === market.title,
    );
    const recentBuys = marketSignals.filter(
      (s) => s.side === 'BUY' && s.hoursAgo <= 24,
    );
    const recentSells = marketSignals.filter(
      (s) => s.side === 'SELL' && s.hoursAgo <= 24,
    );
    const buyVol = recentBuys.reduce((a, s) => a + s.usdcSize, 0);
    const sellVol = recentSells.reduce((a, s) => a + s.usdcSize, 0);
    const momentumRatio = buyVol / (buyVol + sellVol + 1);
    let momentum = 0;
    if (recentBuys.length >= 2) momentum += 8;
    if (momentumRatio > 0.7) momentum += 8;
    else if (momentumRatio > 0.5) momentum += 4;
    if (recentBuys.some((s) => s.conviction >= 15)) momentum += 4;
    momentum = Math.min(momentum, 20);

    // 4. Validation (15 pts)
    const oi = openInterestMap.get(market.conditionId) || 0;
    const oiScore =
      oi > 500000
        ? 8
        : oi > 100000
          ? 6
          : oi > 10000
            ? 4
            : oi > 0
              ? 2
              : 0;
    const traderScore =
      market.traderCount >= 8
        ? 7
        : market.traderCount >= 5
          ? 5
          : market.traderCount >= 3
            ? 3
            : 1;
    const validation = Math.min(oiScore + traderScore, 15);

    // 5. Trader Quality (20 pts)
    const traderWinRates = market.traders
      .map((t) => {
        const cp = closedPositionsMap.get(t.address);
        if (!cp || cp.wins + cp.losses === 0) return null;
        return cp.wins / (cp.wins + cp.losses);
      })
      .filter((v): v is number => v !== null);
    const avgWinRate =
      traderWinRates.length > 0
        ? traderWinRates.reduce((a, b) => a + b, 0) / traderWinRates.length
        : 0.5;
    const winRateScore =
      avgWinRate >= 0.65
        ? 12
        : avgWinRate >= 0.55
          ? 8
          : avgWinRate >= 0.45
            ? 5
            : 2;
    const pnlScore =
      market.avgPnl > 0 ? Math.min((market.avgPnl / 500) * 8, 8) : 0;
    const quality = Math.min(winRateScore + pnlScore, 20);

    const score = Math.round(consensus + edge + momentum + validation + quality);
    const tier: ConvergenceScore['tier'] =
      score >= 75 ? 'STRONG' : score >= 45 ? 'MODERATE' : 'WEAK';

    map.set(market.conditionId, {
      score,
      tier,
      breakdown: {
        consensus: Math.round(consensus),
        edge: Math.round(edge),
        momentum: Math.round(momentum),
        validation: Math.round(validation),
        quality: Math.round(quality),
      },
    });
  }

  return map;
}

// ---------------------------------------------------------------------------
// 3. computeAlphaSignals
//    5 signal types: WHALE_CONVERGENCE, UNDERWATER_ACCUMULATION,
//    YIELD_MOMENTUM, HIGH_CONVICTION_CLUSTER, OI_SURGE_CONSENSUS
// ---------------------------------------------------------------------------

export function computeAlphaSignals(
  markets: SmartMoneyMarket[],
  whaleSignals: WhaleSignal[],
  bondMarkets: BondOpportunity[],
  traderPortfolios: TraderPortfolio[],
  openInterestMap: Map<string, number>,
): AlphaSignal[] {
  if (markets.length === 0) return [];
  const signals: AlphaSignal[] = [];

  // Signal 1: WHALE CONVERGENCE
  for (const market of markets) {
    const recentBuys = whaleSignals.filter(
      (s) =>
        (s.marketSlug === market.slug || s.marketTitle === market.title) &&
        s.side === 'BUY' &&
        s.hoursAgo <= 24,
    );
    const uniqueTraders = [...new Set(recentBuys.map((s) => s.address))];
    if (uniqueTraders.length >= 3) {
      const names = [...new Set(recentBuys.map((s) => s.traderName))];
      const totalUsd = recentBuys.reduce((a, s) => a + s.usdcSize, 0);
      signals.push({
        id: `whale-${market.conditionId}`,
        type: 'WHALE_CONVERGENCE',
        title: market.title,
        description: `${uniqueTraders.length} top traders bought ${market.topOutcome} in the last 24h for ${formatUSD(totalUsd)}`,
        confidence: Math.min(uniqueTraders.length * 20, 100),
        markets: [market.title],
        traders: names.slice(0, 5),
        suggestedAction: `Coordinated whale entry from ${uniqueTraders.length} traders. High probability of movement.`,
      });
    }
  }

  // Signal 2: UNDERWATER ACCUMULATION
  for (const market of markets.filter((m) => m.edgeDirection === 'UNDERWATER')) {
    const recentBuys = whaleSignals.filter(
      (s) =>
        (s.marketSlug === market.slug || s.marketTitle === market.title) &&
        s.side === 'BUY' &&
        s.hoursAgo <= 48,
    );
    if (recentBuys.length >= 1) {
      const avgConviction =
        recentBuys.reduce((a, s) => a + s.conviction, 0) / recentBuys.length;
      const names = [...new Set(recentBuys.map((s) => s.traderName))];
      signals.push({
        id: `underwater-${market.conditionId}`,
        type: 'UNDERWATER_ACCUMULATION',
        title: market.title,
        description: `Smart money is ${Math.abs(market.edgePercent)}pts underwater but still buying (${recentBuys.length} recent buys)`,
        confidence: Math.min(50 + Math.round(avgConviction), 100),
        markets: [market.title],
        traders: names.slice(0, 5),
        suggestedAction: `Contrarian accumulation. Whales averaging down — strong conviction signal.`,
      });
    }
  }

  // Signal 3: YIELD + MOMENTUM
  for (const bond of bondMarkets) {
    const matchingMarket = markets.find(
      (m) => m.conditionId === bond.conditionId,
    );
    if (matchingMarket && matchingMarket.capitalConsensus >= 60) {
      const bondSideMatch =
        (bond.safeSide === 'YES' &&
          matchingMarket.topOutcome.toLowerCase() === 'yes') ||
        (bond.safeSide === 'NO' &&
          matchingMarket.topOutcome.toLowerCase() === 'no');
      if (bondSideMatch) {
        signals.push({
          id: `yield-${bond.conditionId}`,
          type: 'YIELD_MOMENTUM',
          title: bond.question,
          description: `Bond yield ${bond.returnPct.toFixed(1)}% (${bond.apy.toFixed(0)}% APY) backed by ${matchingMarket.traderCount} traders with ${matchingMarket.capitalConsensus}% consensus`,
          confidence: Math.min(
            matchingMarket.capitalConsensus +
              Math.round(bond.returnPct * 5),
            100,
          ),
          markets: [bond.question],
          traders: matchingMarket.traders.slice(0, 3).map((t) => t.name),
          suggestedAction: `Double conviction: guaranteed yield + aligned smart money. Low risk.`,
        });
      }
    }
  }

  // Signal 4: HIGH CONVICTION CLUSTER
  const convictionMap = new Map<
    string,
    { traders: string[]; avgConviction: number; totalConviction: number }
  >();
  for (const portfolio of traderPortfolios) {
    for (const bet of portfolio.convictionBets) {
      if (bet.pctOfPortfolio >= 20) {
        const existing = convictionMap.get(bet.title) || {
          traders: [],
          avgConviction: 0,
          totalConviction: 0,
        };
        existing.traders.push(portfolio.name);
        existing.totalConviction += bet.pctOfPortfolio;
        existing.avgConviction =
          existing.totalConviction / existing.traders.length;
        convictionMap.set(bet.title, existing);
      }
    }
  }
  for (const [market, data] of convictionMap) {
    if (data.traders.length >= 2) {
      signals.push({
        id: `conviction-${market.slice(0, 20)}`,
        type: 'HIGH_CONVICTION_CLUSTER',
        title: market,
        description: `${data.traders.length} traders have >${Math.round(data.avgConviction)}% of their portfolio in this market`,
        confidence: Math.min(
          data.traders.length * 25 + Math.round(data.avgConviction),
          100,
        ),
        markets: [market],
        traders: data.traders.slice(0, 5),
        suggestedAction: `Maximum collective conviction. Top traders are all-in here.`,
      });
    }
  }

  // Signal 5: OI SURGE + CONSENSUS
  for (const market of markets) {
    const oi = openInterestMap.get(market.conditionId) || 0;
    if (oi > 100000 && market.capitalConsensus >= 70) {
      signals.push({
        id: `oi-${market.conditionId}`,
        type: 'OI_SURGE_CONSENSUS',
        title: market.title,
        description: `${formatUSD(oi)} in Open Interest + ${market.capitalConsensus}% smart money consensus`,
        confidence: Math.min(
          Math.round((oi / 1000000) * 30 + market.capitalConsensus),
          100,
        ),
        markets: [market.title],
        traders: market.traders.slice(0, 3).map((t) => t.name),
        suggestedAction: `Institutional signal. High capital at risk + aligned whales.`,
      });
    }
  }

  return signals.sort((a, b) => b.confidence - a.confidence);
}

// ---------------------------------------------------------------------------
// 4. computeTraderReliability
//    Simplified reliability score for a single trader.
//    Components: Win Rate (40), PnL (25), Diversification (20), Data (15).
// ---------------------------------------------------------------------------

export function computeTraderReliability(
  address: string,
  positions: PolymarketPosition[],
  closedPositions: { isWin: boolean; pnl: number }[],
): TraderReliability {
  const wins = closedPositions.filter((c) => c.isWin).length;
  const losses = closedPositions.filter((c) => !c.isWin).length;
  const totalResolved = wins + losses;
  const totalPnl = closedPositions.reduce((a, c) => a + c.pnl, 0);

  // Win Rate (0-40)
  let winRateScore = 0;
  if (totalResolved > 0) {
    const winRate = wins / totalResolved;
    winRateScore = Math.min(
      Math.max(0, ((winRate - 0.4) / 0.3) * 40),
      40,
    );
    if (totalResolved < 5) winRateScore *= 0.5;
    else if (totalResolved < 10) winRateScore *= 0.75;
  }

  // PnL (0-25)
  let pnlScore = 0;
  if (totalPnl > 0) pnlScore = Math.min((totalPnl / 2000) * 25, 25);

  // Diversification (0-20)
  const totalValue = positions.reduce((a, p) => a + p.currentValue, 0);
  let divScore = 10;
  if (totalValue > 0 && positions.length > 0) {
    const shares = positions.map((p) => p.currentValue / totalValue);
    const hhi = shares.reduce((a, s) => a + s * s, 0);
    const concentration = Math.round(hhi * 100);
    if (concentration >= 15 && concentration <= 50) divScore = 20;
    else if (concentration < 15) divScore = 12;
    else if (concentration <= 70) divScore = 8;
    else divScore = 3;
  }

  // Data Confidence (0-15)
  let dataScore = 0;
  if (totalResolved >= 10) dataScore += 8;
  else if (totalResolved >= 3) dataScore += 4;
  if (positions.length >= 3) dataScore += 4;
  dataScore = Math.min(dataScore + 3, 15);

  const score = Math.round(winRateScore + pnlScore + divScore + dataScore);
  const tier: TraderReliability['tier'] =
    score >= 65 ? 'RELIABLE' : score >= 35 ? 'MODERATE' : 'UNPROVEN';

  return { score, tier };
}
