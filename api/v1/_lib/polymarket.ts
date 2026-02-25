// ============================================================================
// Polymarket Service - Server-Side Port
// ============================================================================
// Server-side port of polymarket.service.ts using absolute URLs.
// No localStorage, no onProgress callbacks.
// ============================================================================

import type {
  AgentMetrics,
  RecentTrade,
  PolymarketPosition,
  MarketInfo,
  EventInfo,
  SubMarket,
  MarketHolder,
  PricePoint,
  OutcomePriceHistory,
  BondOpportunity,
  LeaderboardEntry,
  OrderBook,
  OrderBookLevel,
  MarketSpread,
  ClosedPosition,
} from './types';

// ---------------------------------------------------------------------------
// Base URLs (absolute, server-side)
// ---------------------------------------------------------------------------

const DATA_URL = 'https://data-api.polymarket.com';
const GAMMA_URL = 'https://gamma-api.polymarket.com';
const CLOB_URL = 'https://clob.polymarket.com';

// ---------------------------------------------------------------------------
// Helpers
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
// URL parsing utilities (exported separately)
// ---------------------------------------------------------------------------

export function parseMarketUrl(url: string): string | null {
  try {
    const u = new URL(url);
    if (!u.hostname.includes('polymarket.com')) return null;
    const parts = u.pathname.split('/').filter(Boolean);
    // /event/<slug> or /event/<slug>/<market-slug>
    if (parts[0] === 'event' && parts.length >= 2) {
      return parts[parts.length - 1];
    }
    return null;
  } catch {
    return null;
  }
}

export function parseEventSlug(url: string): string | null {
  try {
    const u = new URL(url);
    if (!u.hostname.includes('polymarket.com')) return null;
    const parts = u.pathname.split('/').filter(Boolean);
    if (parts[0] === 'event' && parts.length >= 2) {
      return parts[1];
    }
    return null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Polymarket Service
// ---------------------------------------------------------------------------

export const polymarketService = {
  // -------------------------------------------------------------------------
  // getAgentMetrics
  // -------------------------------------------------------------------------
  async getAgentMetrics(address: string): Promise<AgentMetrics> {
    try {
      const [positionsRes, tradesRes, valueRes] = await Promise.all([
        fetch(`${DATA_URL}/positions?user=${address}&limit=500&sortBy=CURRENT&sortDirection=DESC`),
        fetch(`${DATA_URL}/trades?user=${address}&limit=100`),
        fetch(`${DATA_URL}/value?user=${address}`),
      ]);

      const positionsData = await positionsRes.json();
      const tradesData = await tradesRes.json();
      const valueData = await valueRes.json();

      let positionsValue = 0;
      let totalPnl = 0;
      let openPositions = 0;

      if (Array.isArray(positionsData)) {
        openPositions = positionsData.length;
        positionsValue = positionsData.reduce(
          (acc: number, p: any) => acc + (parseFloat(p.currentValue) || 0),
          0,
        );
        totalPnl = positionsData.reduce(
          (acc: number, p: any) => acc + (parseFloat(p.cashPnl) || 0),
          0,
        );
      }

      let portfolioValue = 0;
      if (Array.isArray(valueData) && valueData.length > 0) {
        portfolioValue = valueData[0].value || 0;
      }

      let volume = 0;
      let lastActive: string | null = null;
      let lastTradeTitle: string | null = null;
      let pseudonym: string | null = null;
      let recentTrades: RecentTrade[] = [];

      if (Array.isArray(tradesData) && tradesData.length > 0) {
        const firstTrade = tradesData[0];
        lastActive = new Date(firstTrade.timestamp * 1000).toISOString();
        lastTradeTitle = firstTrade.title || null;
        pseudonym = firstTrade.pseudonym || firstTrade.name || null;
        volume = tradesData.reduce(
          (acc: number, t: any) => acc + parseFloat(t.size) * parseFloat(t.price),
          0,
        );
        recentTrades = tradesData.slice(0, 50).map((t: any) => ({
          title: t.title || '',
          outcome: t.outcome || '',
          side: t.side as 'BUY' | 'SELL',
          size: parseFloat(t.size) || 0,
          price: parseFloat(t.price) || 0,
          usdcSize: parseFloat(t.usdcSize) || 0,
          timestamp: t.timestamp || 0,
          transactionHash: t.transactionHash || '',
          slug: t.slug || t.eventSlug || '',
        }));
      }

      return {
        address,
        positionsValue,
        portfolioValue,
        profitPnL: totalPnl || null,
        volumeTraded: volume,
        openPositions,
        lastActive,
        lastTradeTitle,
        pseudonym,
        recentTrades,
      };
    } catch (error) {
      return {
        address,
        positionsValue: 0,
        portfolioValue: 0,
        profitPnL: null,
        volumeTraded: 0,
        openPositions: 0,
        lastActive: null,
        lastTradeTitle: null,
        pseudonym: null,
        recentTrades: [],
      };
    }
  },

  // -------------------------------------------------------------------------
  // getMarketBySlug
  // -------------------------------------------------------------------------
  async getMarketBySlug(slug: string): Promise<MarketInfo | null> {
    try {
      const res = await fetch(`${GAMMA_URL}/markets?slug=${slug}&limit=1`);
      const data = await res.json();

      if (!Array.isArray(data) || data.length === 0) {
        const eventRes = await fetch(`${GAMMA_URL}/events?slug=${slug}&limit=1`);
        const eventData = await eventRes.json();

        if (Array.isArray(eventData) && eventData.length > 0) {
          const markets = eventData[0].markets || [];
          if (markets.length > 0) {
            const m = markets[0];
            return {
              conditionId: m.conditionId || '',
              question: m.question || eventData[0].title || '',
              slug: m.slug || slug,
              volume: parseFloat(m.volume) || 0,
              outcomePrices: JSON.parse(m.outcomePrices || '[]'),
              outcomes: JSON.parse(m.outcomes || '[]'),
              image: m.image || eventData[0].image || '',
              endDate: m.endDate || '',
            };
          }
        }
        return null;
      }

      const m = data[0];
      return {
        conditionId: m.conditionId || '',
        question: m.question || '',
        slug: m.slug || slug,
        volume: parseFloat(m.volume) || 0,
        outcomePrices: JSON.parse(m.outcomePrices || '[]'),
        outcomes: JSON.parse(m.outcomes || '[]'),
        image: m.image || '',
        endDate: m.endDate || '',
      };
    } catch {
      return null;
    }
  },

  // -------------------------------------------------------------------------
  // getEventBySlug
  // -------------------------------------------------------------------------
  async getEventBySlug(slug: string): Promise<EventInfo | null> {
    try {
      const res = await fetch(`${GAMMA_URL}/events?slug=${slug}&limit=1`);
      const data = await res.json();

      if (!Array.isArray(data) || data.length === 0) return null;

      const ev = data[0];
      const rawMarkets = ev.markets || [];

      const markets: SubMarket[] = rawMarkets.map((m: any) => ({
        conditionId: m.conditionId || '',
        question: m.question || '',
        slug: m.slug || '',
        groupItemTitle: m.groupItemTitle || m.question || '',
        volume: parseFloat(m.volume) || 0,
        yesPrice: (() => {
          try {
            const prices = JSON.parse(m.outcomePrices || '[]');
            return parseFloat(prices[0]) || 0;
          } catch {
            return 0;
          }
        })(),
        active: m.active !== false,
        closed: m.closed === true,
        clobTokenId: (() => {
          try {
            const ids = JSON.parse(m.clobTokenIds || '[]');
            return ids[0] || '';
          } catch {
            return '';
          }
        })(),
      }));

      return {
        title: ev.title || '',
        slug: ev.slug || slug,
        image: ev.image || '',
        volume: parseFloat(ev.volume) || 0,
        volume24hr: parseFloat(ev.volume24hr) || 0,
        liquidity: parseFloat(ev.liquidity) || 0,
        endDate: ev.endDate || '',
        markets,
      };
    } catch {
      return null;
    }
  },

  // -------------------------------------------------------------------------
  // getMarketHolders
  // -------------------------------------------------------------------------
  async getMarketHolders(conditionId: string): Promise<MarketHolder[]> {
    try {
      const data = await fetchJSON(
        `${DATA_URL}/holders?market=${conditionId}&limit=100&sortBy=AMOUNT&sortDirection=DESC`,
      );

      if (!Array.isArray(data)) return [];

      return data.map((h: any) => ({
        address: h.proxyWallet || h.address || '',
        pseudonym: h.pseudonym || h.name || '',
        amount: parseFloat(h.amount) || 0,
        outcome: h.outcome || '',
      }));
    } catch {
      return [];
    }
  },

  // -------------------------------------------------------------------------
  // getAgentPositions
  // -------------------------------------------------------------------------
  async getAgentPositions(
    address: string,
    limit: number = 100,
  ): Promise<PolymarketPosition[]> {
    try {
      const data = await fetchJSON(
        `${DATA_URL}/positions?user=${address}&limit=${limit}&sortBy=CURRENT&sortDirection=DESC`,
      );

      if (!Array.isArray(data)) return [];

      return data.map((p: any) => ({
        conditionId: p.conditionId || '',
        title: p.title || '',
        outcome: p.outcome || '',
        size: parseFloat(p.size) || 0,
        avgPrice: parseFloat(p.avgPrice) || 0,
        curPrice: parseFloat(p.curPrice) || 0,
        currentValue: parseFloat(p.currentValue) || 0,
        cashPnl: parseFloat(p.cashPnl) || 0,
        percentPnl: parseFloat(p.percentPnl) || 0,
        slug: p.slug || '',
        eventSlug: p.eventSlug || '',
      }));
    } catch {
      return [];
    }
  },

  // -------------------------------------------------------------------------
  // getEventPriceHistory
  // -------------------------------------------------------------------------
  async getEventPriceHistory(
    markets: SubMarket[],
    maxOutcomes: number = 10,
  ): Promise<OutcomePriceHistory[]> {
    try {
      const activeMarkets = markets
        .filter((m) => m.clobTokenId && m.active && !m.closed)
        .slice(0, maxOutcomes);

      if (activeMarkets.length === 0) return [];

      const results: OutcomePriceHistory[] = [];

      for (const m of activeMarkets) {
        try {
          const data = await fetchJSON(
            `${CLOB_URL}/prices-history?market=${m.clobTokenId}&interval=max&fidelity=60`,
          );

          if (data && data.history && Array.isArray(data.history)) {
            results.push({
              label: m.groupItemTitle || m.question,
              history: data.history.map((h: any) => ({
                t: h.t || 0,
                p: h.p || 0,
              })),
            });
          }
        } catch {
          // Skip failed fetches
        }
      }

      return results;
    } catch {
      return [];
    }
  },

  // -------------------------------------------------------------------------
  // getRecentTradesForWallet
  // -------------------------------------------------------------------------
  async getRecentTradesForWallet(
    address: string,
    limit: number = 100,
  ): Promise<RecentTrade[]> {
    try {
      const data = await fetchJSON(
        `${DATA_URL}/trades?user=${address}&limit=${limit}`,
      );

      if (!Array.isArray(data)) return [];

      return data.map((t: any) => ({
        title: t.title || '',
        outcome: t.outcome || '',
        side: t.side as 'BUY' | 'SELL',
        size: parseFloat(t.size) || 0,
        price: parseFloat(t.price) || 0,
        usdcSize: parseFloat(t.usdcSize) || 0,
        timestamp: t.timestamp || 0,
        transactionHash: t.transactionHash || '',
        slug: t.slug || t.eventSlug || '',
      }));
    } catch {
      return [];
    }
  },

  // -------------------------------------------------------------------------
  // getMarketPrices
  // -------------------------------------------------------------------------
  async getMarketPrices(conditionIds: string[]): Promise<Map<string, number>> {
    const prices = new Map<string, number>();
    try {
      const ids = conditionIds.slice(0, 20).join(',');
      const data = await fetchJSON(
        `${GAMMA_URL}/markets?condition_ids=${ids}&limit=20`,
      );
      if (Array.isArray(data)) {
        for (const m of data) {
          const outcomePrices = JSON.parse(m.outcomePrices || '[]');
          if (outcomePrices.length > 0) {
            prices.set(m.conditionId, parseFloat(outcomePrices[0]) || 0);
          }
        }
      }
    } catch { /* fallback: use curPrice from positions */ }
    return prices;
  },

  // -------------------------------------------------------------------------
  // getBondMarkets
  // -------------------------------------------------------------------------
  async getBondMarkets(
    options: {
      minPrice?: number;
      maxPrice?: number;
      minVolume?: number;
      minLiquidity?: number;
      maxDaysToEnd?: number;
      limit?: number;
    } = {},
  ): Promise<BondOpportunity[]> {
    const {
      minPrice = 0.9,
      maxPrice = 0.99,
      minVolume = 10000,
      minLiquidity = 5000,
      maxDaysToEnd = 90,
      limit = 50,
    } = options;

    try {
      const data = await fetchJSON(
        `${GAMMA_URL}/markets?closed=false&active=true&limit=200&order=volume24hr&ascending=false`,
      );

      if (!Array.isArray(data)) return [];

      const now = Date.now();
      const bonds: BondOpportunity[] = [];

      for (const m of data) {
        try {
          const prices = JSON.parse(m.outcomePrices || '[]');
          const yesPrice = parseFloat(prices[0]) || 0;
          const noPrice = parseFloat(prices[1]) || 0;
          const volume = parseFloat(m.volume) || 0;
          const volume24hr = parseFloat(m.volume24hr) || 0;
          const liquidity = parseFloat(m.liquidity) || 0;
          const endDate = m.endDate || '';
          const endMs = endDate ? new Date(endDate).getTime() : 0;
          const hoursToEnd = endMs > now ? (endMs - now) / (1000 * 60 * 60) : 0;
          const daysToEnd = hoursToEnd / 24;

          if (volume < minVolume || liquidity < minLiquidity) continue;
          if (daysToEnd <= 0 || daysToEnd > maxDaysToEnd) continue;

          let safeSide: 'YES' | 'NO';
          let safePrice: number;
          let otherPrice: number;

          if (yesPrice >= minPrice && yesPrice <= maxPrice) {
            safeSide = 'YES';
            safePrice = yesPrice;
            otherPrice = noPrice;
          } else if (noPrice >= minPrice && noPrice <= maxPrice) {
            safeSide = 'NO';
            safePrice = noPrice;
            otherPrice = yesPrice;
          } else {
            continue;
          }

          const returnPct = ((1 - safePrice) / safePrice) * 100;
          const apy = daysToEnd > 0 ? (returnPct / daysToEnd) * 365 : 0;
          const spread = Math.abs(yesPrice - noPrice);

          bonds.push({
            conditionId: m.conditionId || '',
            question: m.question || '',
            slug: m.slug || '',
            eventSlug: m.eventSlug || '',
            image: m.image || '',
            safeSide,
            safePrice,
            otherPrice,
            returnPct,
            apy,
            spread,
            volume,
            volume24hr,
            liquidity,
            endDate,
            hoursToEnd,
            daysToEnd,
            holdersCount: parseInt(m.holdersCount) || 0,
          });
        } catch {
          // Skip malformed markets
        }
      }

      bonds.sort((a, b) => b.apy - a.apy);
      return bonds.slice(0, limit);
    } catch {
      return [];
    }
  },

  // -------------------------------------------------------------------------
  // getLeaderboard
  // -------------------------------------------------------------------------
  async getLeaderboard(
    category: string = 'profit',
    timePeriod: string = 'all',
    limit: number = 50,
  ): Promise<LeaderboardEntry[]> {
    try {
      const data = await fetchJSON(
        `${DATA_URL}/v1/leaderboard?category=${category}&timePeriod=${timePeriod}&limit=${limit}`,
      );

      if (!Array.isArray(data)) return [];

      return data.map((entry: any, idx: number) => ({
        rank: entry.rank || idx + 1,
        proxyWallet: entry.proxyWallet || '',
        userName: entry.userName || entry.pseudonym || '',
        profileImage: entry.profileImage || '',
        volume: parseFloat(entry.volume) || 0,
        pnl: parseFloat(entry.pnl) || 0,
        xUsername: entry.xUsername || '',
      }));
    } catch {
      return [];
    }
  },

  // -------------------------------------------------------------------------
  // getOrderBook
  // -------------------------------------------------------------------------
  async getOrderBook(tokenId: string): Promise<OrderBook | null> {
    try {
      const data = await fetchJSON(`${CLOB_URL}/book?token_id=${tokenId}`);

      if (!data || (!data.bids && !data.asks)) return null;

      const bids: OrderBookLevel[] = (data.bids || []).map((b: any) => ({
        price: parseFloat(b.price) || 0,
        size: parseFloat(b.size) || 0,
      }));

      const asks: OrderBookLevel[] = (data.asks || []).map((a: any) => ({
        price: parseFloat(a.price) || 0,
        size: parseFloat(a.size) || 0,
      }));

      const bestBid = bids.length > 0 ? bids[0].price : 0;
      const bestAsk = asks.length > 0 ? asks[0].price : 0;
      const spread = bestAsk > 0 && bestBid > 0 ? bestAsk - bestBid : 0;
      const midpoint = bestAsk > 0 && bestBid > 0 ? (bestAsk + bestBid) / 2 : 0;
      const bidDepth = bids.reduce((acc, b) => acc + b.size, 0);
      const askDepth = asks.reduce((acc, a) => acc + a.size, 0);

      return { bids, asks, spread, midpoint, bidDepth, askDepth };
    } catch {
      return null;
    }
  },

  // -------------------------------------------------------------------------
  // getSpreads
  // -------------------------------------------------------------------------
  async getSpreads(tokenIds: string[]): Promise<MarketSpread[]> {
    try {
      const results: MarketSpread[] = [];

      for (const tokenId of tokenIds) {
        try {
          const data = await fetchJSON(`${CLOB_URL}/spread?token_id=${tokenId}`);

          if (data && typeof data === 'object') {
            results.push({
              tokenId,
              spread: parseFloat(data.spread) || 0,
              midpoint: parseFloat(data.mid) || 0,
              bestBid: parseFloat(data.bid) || 0,
              bestAsk: parseFloat(data.ask) || 0,
            });
          }
        } catch {
          // Skip failed fetches
        }
      }

      return results;
    } catch {
      return [];
    }
  },

  // -------------------------------------------------------------------------
  // getMidpoints
  // -------------------------------------------------------------------------
  async getMidpoints(tokenIds: string[]): Promise<Record<string, number>> {
    try {
      const result: Record<string, number> = {};

      for (const tokenId of tokenIds) {
        try {
          const data = await fetchJSON(`${CLOB_URL}/midpoint?token_id=${tokenId}`);

          if (data && data.mid !== undefined) {
            result[tokenId] = parseFloat(data.mid) || 0;
          }
        } catch {
          // Skip failed fetches
        }
      }

      return result;
    } catch {
      return {};
    }
  },

  // -------------------------------------------------------------------------
  // getOpenInterest
  // -------------------------------------------------------------------------
  async getOpenInterest(conditionId: string): Promise<number> {
    try {
      const data = await fetchJSON(
        `${DATA_URL}/open-interest?condition_id=${conditionId}`,
      );
      return parseFloat(data?.openInterest) || parseFloat(data?.open_interest) || 0;
    } catch {
      return 0;
    }
  },

  // -------------------------------------------------------------------------
  // getBatchOpenInterest
  // -------------------------------------------------------------------------
  async getBatchOpenInterest(conditionIds: string[]): Promise<Map<string, number>> {
    const oiMap = new Map<string, number>();
    for (let i = 0; i < conditionIds.length; i += 5) {
      const batch = conditionIds.slice(i, i + 5);
      const results = await Promise.allSettled(
        batch.map(async (id) => {
          const oi = await polymarketService.getOpenInterest(id);
          return { id, oi };
        })
      );
      for (const r of results) {
        if (r.status === 'fulfilled' && r.value.oi > 0) {
          oiMap.set(r.value.id, r.value.oi);
        }
      }
    }
    return oiMap;
  },

  // -------------------------------------------------------------------------
  // getClosedPositions
  // -------------------------------------------------------------------------
  async getClosedPositions(
    address: string,
    limit: number = 100,
  ): Promise<ClosedPosition[]> {
    try {
      const data = await fetchJSON(
        `${DATA_URL}/closed-positions?user=${address}&limit=${limit}`,
      );

      if (!Array.isArray(data)) return [];

      return data.map((p: any) => ({
        conditionId: p.conditionId || '',
        title: p.title || '',
        outcome: p.outcome || '',
        size: parseFloat(p.size) || 0,
        avgPrice: parseFloat(p.avgPrice) || 0,
        settlePrice: parseFloat(p.settlePrice) || 0,
        pnl: parseFloat(p.cashPnl) || parseFloat(p.pnl) || 0,
        isWin: (parseFloat(p.cashPnl) || parseFloat(p.pnl) || 0) > 0,
        resolvedAt: p.resolvedAt || p.settledAt || '',
      }));
    } catch {
      return [];
    }
  },

  // -------------------------------------------------------------------------
  // getRewardPercentages
  // -------------------------------------------------------------------------
  async getRewardPercentages(): Promise<any> {
    try {
      return await fetchJSON(`${CLOB_URL}/reward-percentages`);
    } catch {
      return [];
    }
  },

  // -------------------------------------------------------------------------
  // getCurrentRewards
  // -------------------------------------------------------------------------
  async getCurrentRewards(): Promise<any> {
    try {
      return await fetchJSON(`${CLOB_URL}/current-rewards`);
    } catch {
      return [];
    }
  },
};
