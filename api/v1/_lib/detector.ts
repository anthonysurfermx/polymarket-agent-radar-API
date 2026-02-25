// Polymarket Agent Radar - Bot Detection Engine (Server-Side)
// Ported from polymarket-detector.ts for Vercel Edge/Serverless
// 7 behavioral signals + strategy classification

import type {
  BotSignals,
  BotDetectionResult,
  StrategyProfile,
  StrategyType,
  MarketContext,
} from './types';

const DATA_URL = 'https://data-api.polymarket.com';

// ---------------------------------------------------------------------------
// Weights & Utility Helpers
// ---------------------------------------------------------------------------

const WEIGHTS = {
  intervalRegularity: 0.20,
  splitMergeRatio: 0.25,
  sizingConsistency: 0.15,
  activity24h: 0.15,
  winRateExtreme: 0.15,
  marketConcentration: 0.10,
};

function coefficientOfVariation(values: number[]): number {
  if (values.length < 2) return 1;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  if (mean === 0) return 1;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance) / mean;
}

function scoreFromCV(cv: number, inverted: boolean): number {
  // inverted=true means low CV = high score (regular = bot)
  if (inverted) {
    if (cv < 0.3) return 90 + (0.3 - cv) / 0.3 * 10;
    if (cv < 0.7) return 40 + (0.7 - cv) / 0.4 * 50;
    return Math.max(0, 20 - (cv - 0.7) * 20);
  }
  return cv < 0.3 ? 90 : cv < 0.7 ? 50 : 10;
}

// ---------------------------------------------------------------------------
// Strategy Classification Utilities
// ---------------------------------------------------------------------------

/**
 * Lightweight bimodality detector using histogram bins.
 * Divides price range [0, 1] into 20 bins (0.05 each).
 * Returns true if two non-adjacent bins each hold >15% of trades.
 * O(N) single pass, zero dependencies.
 */
function isBimodal(
  prices: number[],
  minPeakVolumePct = 0.15,
  minBinSeparation = 2,
): boolean {
  if (prices.length < 20) return false;

  const BINS = 20;
  const histogram = new Array(BINS).fill(0);

  for (let i = 0; i < prices.length; i++) {
    const binIndex = Math.floor(Math.max(0, Math.min(0.9999, prices[i])) * BINS);
    histogram[binIndex]++;
  }

  const minPeakThreshold = prices.length * minPeakVolumePct;
  const peaks: number[] = [];

  for (let i = 0; i < BINS; i++) {
    if (histogram[i] < minPeakThreshold) continue;
    const left = i === 0 ? 0 : histogram[i - 1];
    const right = i === BINS - 1 ? 0 : histogram[i + 1];
    if (histogram[i] > left && (i === BINS - 1 || histogram[i] > right)) {
      peaks.push(i);
    }
  }

  if (peaks.length < 2) return false;
  for (let i = 0; i < peaks.length - 1; i++) {
    for (let j = i + 1; j < peaks.length; j++) {
      if (Math.abs(peaks[j] - peaks[i]) >= minBinSeparation) return true;
    }
  }
  return false;
}

/**
 * Compute average ROI from resolved positions.
 * ROI = (payout - cost) / cost. For binary markets, payout is $1 for winners.
 * Uses avgPrice as entry cost. Only counts positions with nonzero PnL.
 */
function computeAvgROI(positions: any[]): number {
  const resolved = positions.filter((p: any) => {
    const pnl = parseFloat(p.cashPnl || 0);
    const avg = parseFloat(p.avgPrice || 0);
    return pnl !== 0 && avg > 0;
  });
  if (resolved.length === 0) return 0;

  let totalROI = 0;
  for (const p of resolved) {
    const cost = parseFloat(p.avgPrice);
    const pnl = parseFloat(p.cashPnl);
    const size = parseFloat(p.size) || 1;
    // ROI = profit / invested capital
    totalROI += pnl / (cost * size);
  }
  return totalROI / resolved.length;
}

/**
 * Compute directional bias: how one-sided is this wallet?
 * Returns 0-100 where 100 = all positions on one side (YES or NO).
 */
function computeDirectionalBias(positions: any[]): number {
  if (positions.length === 0) return 0;
  const yesCount = positions.filter((p: any) => (p.outcome || '').toLowerCase() === 'yes').length;
  const noCount = positions.length - yesCount;
  const dominant = Math.max(yesCount, noCount);
  return Math.round((dominant / positions.length) * 100);
}

/**
 * Classify wallet trading strategy based on behavioral signals.
 * Uses refined heuristics from whale research:
 *   - MARKET_MAKER: both sides + low size variance + high merge activity
 *   - HYBRID: bimodal entries + moderate both-sides + some merges
 *   - SNIPER: directional + high ROI + low both-sides
 *   - MOMENTUM: directional + regular intervals + high concentration
 */
function classifyStrategy(
  trades: any[],
  positions: any[],
  mergeCount: number,
  bothSidesPercent: number,
  intervalRegularity: number,
  sizeCV: number,
): StrategyProfile {
  const entryPrices = trades
    .map((t: any) => parseFloat(t.price))
    .filter((p: number) => !isNaN(p) && p > 0 && p < 1);

  const bimodal = isBimodal(entryPrices);
  const avgROI = computeAvgROI(positions);
  const directionalBias = computeDirectionalBias(positions);
  const tradeCount = trades.length;
  const mergeRatio = tradeCount > 0 ? (mergeCount / (tradeCount + mergeCount)) * 100 : 0;

  const base = { avgROI: Math.round(avgROI * 100), sizeCV: Math.round(sizeCV * 100) / 100, bimodal, directionalBias };

  // Not enough data to classify
  if (tradeCount < 10 && positions.length < 5) {
    return { type: 'UNCLASSIFIED', label: 'Insufficient Data', confidence: 0, description: 'Not enough trade history to classify strategy', ...base };
  }

  // 1. MARKET MAKER: both sides >= 45%, merge ratio >= 15%, consistent sizing
  if (bothSidesPercent >= 45 && mergeRatio >= 15 && sizeCV < 0.8) {
    const conf = Math.min(95,
      Math.round((bothSidesPercent / 100) * 40 + (mergeRatio / 50) * 30 + (1 - Math.min(sizeCV, 1)) * 30)
    );
    return { type: 'MARKET_MAKER', label: 'The House', confidence: conf, description: 'Provides liquidity on both sides, collects spread. Consistent sizing, high merge activity.', ...base };
  }

  // 2. HYBRID: bimodal entry prices + moderate both-sides + some merge activity
  if (bimodal && bothSidesPercent >= 15 && mergeRatio >= 5) {
    const conf = Math.min(90,
      Math.round(40 + (bothSidesPercent > 30 ? 20 : 10) + (mergeRatio > 15 ? 20 : 10) + (bimodal ? 10 : 0))
    );
    return { type: 'HYBRID', label: 'Spread + Alpha', confidence: conf, description: 'Market-making base with directional overlays when model detects mispricing.', ...base };
  }

  // 3. SNIPER: directional, high ROI, low both-sides
  if (bothSidesPercent <= 10 && avgROI > 0.3 && directionalBias >= 70) {
    const conf = Math.min(90,
      Math.round((directionalBias / 100) * 30 + Math.min(avgROI * 40, 40) + (bothSidesPercent < 5 ? 20 : 10))
    );
    return { type: 'SNIPER', label: 'Latency Arb', confidence: conf, description: 'Directional bets capturing oracle lag. High ROI per trade, reacts to spot price moves.', ...base };
  }

  // 4. MOMENTUM: directional, regular intervals, high market concentration
  if (bothSidesPercent <= 15 && intervalRegularity >= 70 && directionalBias >= 80) {
    const conf = Math.min(85,
      Math.round((intervalRegularity / 100) * 40 + (directionalBias / 100) * 30 + 20)
    );
    return { type: 'MOMENTUM', label: 'Trend Rider', confidence: conf, description: 'Scales into one direction with rhythmic intervals. Follows short-term momentum.', ...base };
  }

  // 5. Softer fallbacks: check partial matches

  // Near-SNIPER: directional + decent ROI but intervals might be irregular
  if (bothSidesPercent <= 15 && avgROI > 0.15 && directionalBias >= 65) {
    return { type: 'SNIPER', label: 'Latency Arb', confidence: 45, description: 'Likely directional trader exploiting price lag. Moderate confidence.', ...base };
  }

  // Near-MARKET_MAKER: both sides but less merge activity
  if (bothSidesPercent >= 35 && sizeCV < 1.0) {
    return { type: 'MARKET_MAKER', label: 'The House', confidence: 40, description: 'Shows market-making behavior with both-sides positions. Moderate confidence.', ...base };
  }

  return { type: 'UNCLASSIFIED', label: 'Mixed Strategy', confidence: 20, description: 'Trading pattern does not match known archetypes clearly.', ...base };
}

// ---------------------------------------------------------------------------
// HTTP Helper
// ---------------------------------------------------------------------------

async function fetchJSON(url: string): Promise<any> {
  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Main Detection Engine
// ---------------------------------------------------------------------------

export async function detectBot(
  address: string,
  marketCtx?: MarketContext,
): Promise<BotDetectionResult> {
  const [tradesData, mergeData, positionsData] = await Promise.all([
    fetchJSON(`${DATA_URL}/trades?user=${address}&limit=500`),
    fetchJSON(`${DATA_URL}/activity?user=${address}&type=MERGE&limit=500`),
    fetchJSON(`${DATA_URL}/positions?user=${address}&limit=200`),
  ]);

  const trades: any[] = Array.isArray(tradesData) ? tradesData : [];
  const merges: any[] = Array.isArray(mergeData) ? mergeData : [];
  const positions: any[] = Array.isArray(positionsData) ? positionsData : [];

  // S1: Interval Regularity
  let s1 = 0;
  if (trades.length > 10) {
    const intervals: number[] = [];
    for (let i = 0; i < trades.length - 1; i++) {
      const diff = Math.abs(trades[i].timestamp - trades[i + 1].timestamp);
      if (diff > 0 && diff < 86400) intervals.push(diff);
    }
    if (intervals.length > 5) {
      const cv = coefficientOfVariation(intervals);
      // Bots with burst trading (like gabagool22) can have high CV but very short intervals
      const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      if (avgInterval < 30) {
        // Sub-30s average = machine speed regardless of CV
        s1 = 85 + Math.min(15, (30 - avgInterval) / 30 * 15);
      } else {
        s1 = scoreFromCV(cv, true);
      }
    }
  }

  // S2: SPLIT/MERGE Activity
  let s2 = 0;
  const mergeCount = merges.length;
  const tradeCount = trades.length;
  if (tradeCount > 0) {
    const ratio = mergeCount / (tradeCount + mergeCount);
    if (ratio > 0.3) s2 = 90 + Math.min(10, (ratio - 0.3) * 30);
    else if (ratio > 0.1) s2 = 40 + (ratio - 0.1) / 0.2 * 50;
    else if (mergeCount > 0) s2 = 10 + mergeCount * 2;
    else s2 = 0;
  }

  // Both-sides detection (bonus signal that amplifies S2)
  let bothSidesPercent = 0;
  if (positions.length > 0) {
    const conditionMap = new Map<string, Set<string>>();
    for (const p of positions) {
      const cid = p.conditionId || '';
      if (!conditionMap.has(cid)) conditionMap.set(cid, new Set());
      conditionMap.get(cid)!.add(p.outcome || '');
    }
    const totalConditions = conditionMap.size;
    const bothSides = Array.from(conditionMap.values()).filter(s => s.size > 1).length;
    bothSidesPercent = totalConditions > 0 ? (bothSides / totalConditions) * 100 : 0;
  }

  // Both-sides bonus: if >30% of positions are on both sides, boost S2
  const bothSidesBonus = bothSidesPercent > 50 ? 20 : bothSidesPercent > 30 ? 15 : bothSidesPercent > 10 ? 8 : 0;

  // S3: Position Sizing Consistency
  let s3 = 0;
  if (trades.length > 10) {
    const usdSizes = trades.map((t: any) => parseFloat(t.size) * parseFloat(t.price));
    const cv = coefficientOfVariation(usdSizes);
    s3 = scoreFromCV(cv, true);
  }

  // S4: 24/7 Activity
  let s4 = 0;
  let activeHours = 0;
  if (trades.length > 20) {
    const hourBuckets = new Set<number>();
    for (const t of trades) {
      const hour = new Date(t.timestamp * 1000).getUTCHours();
      hourBuckets.add(hour);
    }
    activeHours = hourBuckets.size;

    if (activeHours >= 22) s4 = 90 + (activeHours - 22) * 5;
    else if (activeHours >= 16) s4 = 30 + (activeHours - 16) / 6 * 60;
    else s4 = Math.max(0, (activeHours / 16) * 20);
  }

  // S5: Win Rate (from positions PnL)
  let s5 = 0;
  if (positions.length > 5) {
    const winners = positions.filter((p: any) => parseFloat(p.cashPnl || 0) > 0).length;
    const losers = positions.filter((p: any) => parseFloat(p.cashPnl || 0) < 0).length;
    const total = winners + losers;
    if (total > 0) {
      const winRate = winners / total;
      if (winRate > 0.85) s5 = 80 + (winRate - 0.85) / 0.15 * 20;
      else if (winRate > 0.65) s5 = 30 + (winRate - 0.65) / 0.2 * 50;
      else {
        // Per feedback: normal win rate should not penalize if other signals are strong
        s5 = 10;
      }
    }
  }

  // S6: Market Concentration
  let s6 = 0;
  if (trades.length > 10) {
    const categories = new Map<string, number>();
    for (const t of trades) {
      const slug = (t.slug || '').toLowerCase();
      let cat = 'other';
      if (slug.includes('up-or-down') || slug.includes('15-minute') || slug.includes('btc') || slug.includes('bitcoin') || slug.includes('ethereum') || slug.includes('eth') || slug.includes('solana') || slug.includes('sol')) {
        cat = 'crypto-shortterm';
      } else if (slug.includes('temperature') || slug.includes('weather') || slug.includes('rain') || slug.includes('snow')) {
        cat = 'weather';
      } else if (slug.includes('nba') || slug.includes('nfl') || slug.includes('epl') || slug.includes('mlb') || slug.includes('soccer') || slug.includes('football')) {
        cat = 'sports';
      } else if (slug.includes('trump') || slug.includes('biden') || slug.includes('election') || slug.includes('president')) {
        cat = 'politics';
      }
      categories.set(cat, (categories.get(cat) || 0) + 1);
    }

    const topCategory = Math.max(...categories.values());
    const concentration = topCategory / trades.length;

    if (concentration > 0.8) s6 = 70 + (concentration - 0.8) / 0.2 * 30;
    else if (concentration > 0.5) s6 = 30 + (concentration - 0.5) / 0.3 * 40;
    else s6 = Math.max(0, concentration * 40);
  }

  // S7: Ghost Whale Detection
  // Wallets with no/few trades but large positions = likely smart contract or programmatic
  let s7 = 0;
  if (trades.length <= 5) {
    // No trade history is suspicious if they hold positions
    if (positions.length > 0) {
      const totalPositionValue = positions.reduce((acc: number, p: any) => acc + (parseFloat(p.currentValue) || 0), 0);
      if (totalPositionValue > 50000) s7 = 95;
      else if (totalPositionValue > 10000) s7 = 80;
      else if (totalPositionValue > 1000) s7 = 60;
      else s7 = 30;
    }
    // If we have market context, use holder amount
    if (marketCtx?.holderAmount) {
      if (marketCtx.holderAmount > 50000) s7 = Math.max(s7, 95);
      else if (marketCtx.holderAmount > 10000) s7 = Math.max(s7, 80);
      else if (marketCtx.holderAmount > 1000) s7 = Math.max(s7, 60);
    }
  }

  // Compute sizeCV for strategy classification (reuse trades data)
  let sizeCV = 1;
  if (trades.length > 10) {
    const usdSizes = trades.map((t: any) => parseFloat(t.size) * parseFloat(t.price)).filter((v: number) => !isNaN(v));
    sizeCV = coefficientOfVariation(usdSizes);
  }

  // Final score: if ghost whale is active, use alternate weighting
  let rawScore: number;
  if (s7 > 0 && trades.length <= 5) {
    // Ghost whale mode: heavy weight on ghost signal since other signals have no data
    rawScore = s7 * 0.50 + s5 * 0.20 + s2 * 0.15 + bothSidesPercent * 0.15;
  } else {
    rawScore =
      s1 * WEIGHTS.intervalRegularity +
      s2 * WEIGHTS.splitMergeRatio +
      s3 * WEIGHTS.sizingConsistency +
      s4 * WEIGHTS.activity24h +
      s5 * WEIGHTS.winRateExtreme +
      s6 * WEIGHTS.marketConcentration;
  }

  const botScore = Math.min(100, Math.round(rawScore + bothSidesBonus));

  let classification: BotDetectionResult['classification'];
  if (botScore >= 80) classification = 'bot';
  else if (botScore >= 60) classification = 'likely-bot';
  else if (botScore >= 40) classification = 'mixed';
  else classification = 'human';

  // Strategy classification: what TYPE of bot/trader is this?
  const strategy = classifyStrategy(
    trades,
    positions,
    mergeCount,
    bothSidesPercent,
    s1,  // intervalRegularity score
    sizeCV,
  );

  return {
    address,
    botScore,
    signals: {
      intervalRegularity: Math.round(s1),
      splitMergeRatio: Math.round(s2),
      sizingConsistency: Math.round(s3),
      activity24h: Math.round(s4),
      winRateExtreme: Math.round(s5),
      marketConcentration: Math.round(s6),
      ghostWhale: Math.round(s7),
      bothSidesBonus: Math.round(bothSidesBonus),
    },
    classification,
    strategy,
    tradeCount,
    mergeCount,
    activeHours,
    bothSidesPercent: Math.round(bothSidesPercent),
  };
}
