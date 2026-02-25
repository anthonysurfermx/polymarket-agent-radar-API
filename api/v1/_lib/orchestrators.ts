import { polymarketService } from './polymarket';
import { aggregateSmartMoney, computeConvergenceScores, computeAlphaSignals, computeTraderReliability } from './compute';
import type {
  LeaderboardEntry, PolymarketPosition, SmartMoneyMarket, WhaleSignal,
  TraderPortfolio, ConvergenceScore, AlphaSignal, TraderReliability, BondOpportunity,
} from './types';

export interface SmartMoneyScanResult {
  leaderboard: LeaderboardEntry[];
  markets: SmartMoneyMarket[];
  convergenceScores: Record<string, ConvergenceScore>;
  whaleSignals: WhaleSignal[];
  traderPortfolios: TraderPortfolio[];
  traderReliability: Record<string, TraderReliability>;
  alphaSignals: AlphaSignal[];
  openInterest: Record<string, number>;
  meta: {
    category: string;
    timePeriod: string;
    tradersScanned: number;
    computedAt: string;
  };
}

export async function smartMoneyScan(options: {
  category?: string;
  timePeriod?: string;
  walletCount?: number;
} = {}): Promise<SmartMoneyScanResult> {
  const category = options.category || 'OVERALL';
  const timePeriod = options.timePeriod || 'MONTH';
  const walletCount = options.walletCount || 50;

  // 1. Fetch leaderboard
  const leaderboard = await polymarketService.getLeaderboard(category, timePeriod, walletCount);
  if (leaderboard.length === 0) {
    throw new Error('Failed to fetch leaderboard data');
  }

  // 2. Fetch positions for all traders (batched, 5 at a time)
  const BATCH_SIZE = 5;
  const positionsByTrader = new Map<string, PolymarketPosition[]>();

  for (let i = 0; i < leaderboard.length; i += BATCH_SIZE) {
    const batch = leaderboard.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map(async (trader) => {
        const positions = await polymarketService.getAgentPositions(trader.proxyWallet);
        const active = positions.filter(p => p.currentValue > 0.5);
        return { wallet: trader.proxyWallet, positions: active };
      })
    );
    for (const r of results) {
      if (r.status === 'fulfilled') {
        positionsByTrader.set(r.value.wallet, r.value.positions);
      }
    }
  }

  // 3. Aggregate smart money markets
  const markets = aggregateSmartMoney(leaderboard, positionsByTrader);

  // 4. Fetch market prices for edge tracker
  const conditionIds = markets.slice(0, 20).map(m => m.conditionId).filter(Boolean);
  const marketPrices = await polymarketService.getMarketPrices(conditionIds);
  for (const m of markets) {
    const mktPrice = marketPrices.get(m.conditionId);
    if (mktPrice !== undefined && mktPrice > 0) {
      m.marketPrice = mktPrice;
      if (m.avgEntryPrice > 0) {
        m.edgePercent = Math.round((mktPrice - m.avgEntryPrice) * 100);
        m.edgeDirection = m.edgePercent > 3 ? 'PROFIT' : m.edgePercent < -3 ? 'UNDERWATER' : 'NEUTRAL';
      }
    }
  }

  // 5. Fetch whale signals (top 15 traders)
  const whaleSignals: WhaleSignal[] = [];
  const now = Date.now() / 1000;
  const tradeBatch = leaderboard.slice(0, 15);
  for (let i = 0; i < tradeBatch.length; i += 5) {
    const batch = tradeBatch.slice(i, i + 5);
    const tradeResults = await Promise.allSettled(
      batch.map(t => polymarketService.getRecentTradesForWallet(t.proxyWallet, 30))
    );
    tradeResults.forEach((r, idx) => {
      if (r.status !== 'fulfilled') return;
      const trader = batch[idx];
      const traderPositions = positionsByTrader.get(trader.proxyWallet) || [];
      const portfolioValue = traderPositions.reduce((a, p) => a + p.currentValue, 0);
      for (const trade of r.value) {
        const hoursAgo = (now - trade.timestamp) / 3600;
        if (hoursAgo > 72) continue;
        const conviction = portfolioValue > 0 ? Math.round((trade.usdcSize / portfolioValue) * 100) : 0;
        whaleSignals.push({
          traderName: trader.userName || `${trader.proxyWallet.slice(0, 6)}...`,
          traderRank: trader.rank,
          traderPnl: trader.pnl,
          address: trader.proxyWallet,
          marketTitle: trade.title,
          marketSlug: trade.slug,
          outcome: trade.outcome,
          side: trade.side,
          size: trade.size,
          price: trade.price,
          usdcSize: trade.usdcSize,
          timestamp: trade.timestamp,
          hoursAgo: Math.round(hoursAgo),
          conviction,
        });
      }
    });
  }
  whaleSignals.sort((a, b) => b.timestamp - a.timestamp);

  // 6. Build portfolio analysis (top 30 traders)
  const traderPortfolios: TraderPortfolio[] = [];
  for (const trader of leaderboard.slice(0, 30)) {
    const positions = positionsByTrader.get(trader.proxyWallet) || [];
    if (positions.length === 0) continue;
    const totalValue = positions.reduce((a, p) => a + p.currentValue, 0);
    if (totalValue < 1) continue;

    const shares = positions.map(p => p.currentValue / totalValue);
    const hhi = shares.reduce((a, s) => a + s * s, 0);
    const concentration = Math.round(hhi * 100);

    const sorted = [...positions].sort((a, b) => b.currentValue - a.currentValue);
    const topPos = sorted[0];

    const convictionBets = sorted
      .filter(p => (p.currentValue / totalValue) > 0.15)
      .map(p => ({
        title: p.title,
        value: p.currentValue,
        pctOfPortfolio: Math.round((p.currentValue / totalValue) * 100),
        outcome: p.outcome,
      }));

    const byCondition = new Map<string, PolymarketPosition[]>();
    for (const p of positions) {
      const key = p.conditionId || p.title;
      const arr = byCondition.get(key) || [];
      arr.push(p);
      byCondition.set(key, arr);
    }
    const hedges: TraderPortfolio['hedges'] = [];
    for (const [, posGroup] of byCondition) {
      const outcomes = new Set(posGroup.map(p => p.outcome));
      if (outcomes.size > 1) {
        const yesCapital = posGroup.filter(p => p.outcome.toLowerCase() === 'yes').reduce((a, p) => a + p.currentValue, 0);
        const noCapital = posGroup.filter(p => p.outcome.toLowerCase() !== 'yes').reduce((a, p) => a + p.currentValue, 0);
        hedges.push({ market: posGroup[0].title, yesCapital, noCapital });
      }
    }

    traderPortfolios.push({
      address: trader.proxyWallet,
      name: trader.userName || `${trader.proxyWallet.slice(0, 6)}...`,
      rank: trader.rank,
      pnl: trader.pnl,
      totalValue,
      positionCount: positions.length,
      topPosition: topPos ? { title: topPos.title, value: topPos.currentValue, pctOfPortfolio: Math.round((topPos.currentValue / totalValue) * 100) } : null,
      concentration,
      categories: [],
      hedges,
      convictionBets,
    });
  }
  traderPortfolios.sort((a, b) => b.totalValue - a.totalValue);

  // 7. CLOB enrichment: OI + closed positions
  const conditionIdsForOI = markets.slice(0, 20).map(m => m.conditionId).filter(Boolean);
  const [oiMap, closedResults] = await Promise.all([
    polymarketService.getBatchOpenInterest(conditionIdsForOI),
    Promise.allSettled(
      leaderboard.slice(0, 10).map(async (t) => {
        const closed = await polymarketService.getClosedPositions(t.proxyWallet, 50);
        const wins = closed.filter(c => c.isWin).length;
        const losses = closed.filter(c => !c.isWin).length;
        const totalPnl = closed.reduce((a, c) => a + c.pnl, 0);
        return { address: t.proxyWallet, wins, losses, totalPnl };
      })
    ),
  ]);

  const closedPositionsMap = new Map<string, { wins: number; losses: number; totalPnl: number }>();
  for (const r of closedResults) {
    if (r.status === 'fulfilled') {
      closedPositionsMap.set(r.value.address, { wins: r.value.wins, losses: r.value.losses, totalPnl: r.value.totalPnl });
    }
  }

  // 8. Compute convergence scores
  const convergenceMap = computeConvergenceScores(markets, whaleSignals, oiMap, closedPositionsMap);

  // 9. Fetch bonds for alpha signal cross-reference
  let bondMarkets: BondOpportunity[] = [];
  try {
    bondMarkets = await polymarketService.getBondMarkets({ minPrice: 0.90, maxPrice: 0.99 });
  } catch { /* non-critical */ }

  // 10. Compute alpha signals
  const alphaSignals = computeAlphaSignals(markets, whaleSignals, bondMarkets, traderPortfolios, oiMap);

  // 11. Compute trader reliability
  const reliabilityMap: Record<string, TraderReliability> = {};
  for (const portfolio of traderPortfolios) {
    const positions = positionsByTrader.get(portfolio.address) || [];
    const cp = closedPositionsMap.get(portfolio.address);
    const closedArr = cp ? Array.from({ length: cp.wins }, () => ({ isWin: true, pnl: cp.totalPnl / (cp.wins + cp.losses) })).concat(
      Array.from({ length: cp.losses }, () => ({ isWin: false, pnl: -cp.totalPnl / (cp.wins + cp.losses) }))
    ) : [];
    reliabilityMap[portfolio.address] = computeTraderReliability(portfolio.address, positions, closedArr);
  }

  // Convert maps to records for JSON serialization
  const convergenceRecords: Record<string, ConvergenceScore> = {};
  for (const [k, v] of convergenceMap) convergenceRecords[k] = v;

  const oiRecords: Record<string, number> = {};
  for (const [k, v] of oiMap) oiRecords[k] = v;

  return {
    leaderboard,
    markets,
    convergenceScores: convergenceRecords,
    whaleSignals,
    traderPortfolios,
    traderReliability: reliabilityMap,
    alphaSignals,
    openInterest: oiRecords,
    meta: {
      category,
      timePeriod,
      tradersScanned: leaderboard.length,
      computedAt: new Date().toISOString(),
    },
  };
}
