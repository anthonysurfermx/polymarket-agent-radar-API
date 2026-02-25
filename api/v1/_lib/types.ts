// ============================================================================
// Polymarket Agent Radar API - Shared Types
// ============================================================================

// ---------------------------------------------------------------------------
// Core Market Types (from polymarket.service.ts)
// ---------------------------------------------------------------------------

export interface MarketInfo {
  conditionId: string;
  question: string;
  slug: string;
  volume: number;
  outcomePrices: string[];
  outcomes: string[];
  image: string;
  endDate: string;
}

export interface SubMarket {
  conditionId: string;
  question: string;
  slug: string;
  groupItemTitle: string;
  volume: number;
  yesPrice: number;
  active: boolean;
  closed: boolean;
  clobTokenId: string;
}

export interface EventInfo {
  title: string;
  slug: string;
  image: string;
  volume: number;
  volume24hr: number;
  liquidity: number;
  endDate: string;
  markets: SubMarket[];
}

export interface MarketHolder {
  address: string;
  pseudonym: string;
  amount: number;
  outcome: string;
}

export interface PricePoint {
  t: number;
  p: number;
}

export interface OutcomePriceHistory {
  label: string;
  history: PricePoint[];
}

// ---------------------------------------------------------------------------
// Position & Trade Types (from polymarket.service.ts)
// ---------------------------------------------------------------------------

export interface PolymarketPosition {
  conditionId: string;
  title: string;
  outcome: string;
  size: number;
  avgPrice: number;
  curPrice: number;
  currentValue: number;
  cashPnl: number;
  percentPnl: number;
  slug: string;
  eventSlug: string;
}

export interface RecentTrade {
  title: string;
  outcome: string;
  side: 'BUY' | 'SELL';
  size: number;
  price: number;
  usdcSize: number;
  timestamp: number;
  transactionHash: string;
  slug: string;
}

export interface ClosedPosition {
  conditionId: string;
  title: string;
  outcome: string;
  size: number;
  avgPrice: number;
  settlePrice: number;
  pnl: number;
  isWin: boolean;
  resolvedAt: string;
}

// ---------------------------------------------------------------------------
// Agent & Metrics Types (from polymarket.service.ts)
// ---------------------------------------------------------------------------

export interface AgentMetrics {
  address: string;
  positionsValue: number;
  portfolioValue: number;
  profitPnL: number | null;
  volumeTraded: number;
  openPositions: number;
  lastActive: string | null;
  lastTradeTitle: string | null;
  pseudonym: string | null;
  recentTrades: RecentTrade[];
}

export interface LeaderboardEntry {
  rank: number;
  proxyWallet: string;
  userName: string;
  profileImage: string;
  volume: number;
  pnl: number;
  xUsername: string;
}

// ---------------------------------------------------------------------------
// Smart Money Types (from polymarket.service.ts)
// ---------------------------------------------------------------------------

export interface OutcomeBias {
  outcome: string;
  capital: number;
  headcount: number;
}

export interface SmartMoneyTrader {
  address: string;
  name: string;
  profileImage: string;
  rank: number;
  pnl: number;
  volume: number;
  outcome: string;
  positionValue: number;
  entryPrice: number;
  currentPnl: number;
  xUsername: string;
}

export interface SmartMoneyMarket {
  conditionId: string;
  title: string;
  slug: string;
  traderCount: number;
  totalCapital: number;
  topOutcome: string;
  topOutcomeCapitalPct: number;
  topOutcomeHeadPct: number;
  capitalConsensus: number;
  headConsensus: number;
  outcomeBias: OutcomeBias[];
  avgPnl: number;
  currentPrice: number;
  traders: SmartMoneyTrader[];
  avgEntryPrice: number;
  entryPriceMin: number;
  entryPriceMax: number;
  marketPrice: number;
  edgePercent: number;
  edgeDirection: 'PROFIT' | 'UNDERWATER' | 'NEUTRAL';
}

export interface WhaleSignal {
  traderName: string;
  traderRank: number;
  traderPnl: number;
  address: string;
  marketTitle: string;
  marketSlug: string;
  outcome: string;
  side: 'BUY' | 'SELL';
  size: number;
  price: number;
  usdcSize: number;
  timestamp: number;
  hoursAgo: number;
  conviction: number;
}

export interface TraderPortfolio {
  address: string;
  name: string;
  rank: number;
  pnl: number;
  totalValue: number;
  positionCount: number;
  topPosition: { title: string; value: number; pctOfPortfolio: number } | null;
  concentration: number;
  categories: { category: string; capital: number; count: number }[];
  hedges: { market: string; yesCapital: number; noCapital: number }[];
  convictionBets: { title: string; value: number; pctOfPortfolio: number; outcome: string }[];
}

// ---------------------------------------------------------------------------
// Bond Opportunity (from polymarket.service.ts)
// ---------------------------------------------------------------------------

export interface BondOpportunity {
  conditionId: string;
  question: string;
  slug: string;
  eventSlug: string;
  image: string;
  safeSide: 'YES' | 'NO';
  safePrice: number;
  otherPrice: number;
  returnPct: number;
  apy: number;
  spread: number;
  volume: number;
  volume24hr: number;
  liquidity: number;
  endDate: string;
  hoursToEnd: number;
  daysToEnd: number;
  holdersCount: number;
}

// ---------------------------------------------------------------------------
// Order Book & Market Microstructure (from polymarket.service.ts)
// ---------------------------------------------------------------------------

export interface OrderBookLevel {
  price: number;
  size: number;
}

export interface OrderBook {
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  spread: number;
  midpoint: number;
  bidDepth: number;
  askDepth: number;
}

export interface MarketSpread {
  tokenId: string;
  spread: number;
  midpoint: number;
  bestBid: number;
  bestAsk: number;
}

export interface OpenInterest {
  conditionId: string;
  openInterest: number;
}

export interface MarketReward {
  conditionId: string;
  rewardRate: number;
  rewardApy: number;
}

// ---------------------------------------------------------------------------
// Bot Detection Types (from polymarket-detector.ts)
// ---------------------------------------------------------------------------

export interface BotSignals {
  intervalRegularity: number;
  splitMergeRatio: number;
  sizingConsistency: number;
  activity24h: number;
  winRateExtreme: number;
  marketConcentration: number;
  ghostWhale: number;
  bothSidesBonus: number;
}

export type StrategyType = 'MARKET_MAKER' | 'HYBRID' | 'SNIPER' | 'MOMENTUM' | 'UNCLASSIFIED';

export interface StrategyProfile {
  type: StrategyType;
  label: string;
  confidence: number;
  description: string;
  avgROI: number;
  sizeCV: number;
  bimodal: boolean;
  directionalBias: number;
}

export interface BotDetectionResult {
  address: string;
  botScore: number;
  signals: BotSignals;
  classification: 'bot' | 'likely-bot' | 'mixed' | 'human';
  strategy: StrategyProfile;
  tradeCount: number;
  mergeCount: number;
  activeHours: number;
  bothSidesPercent: number;
}

export interface MarketContext {
  holderAmount?: number;
  totalMarketVolume?: number;
}

export type SignalProgress = {
  phase: 'fetching' | 'analyzing';
  signal?: string;
  signals: Partial<BotSignals>;
  tradeCount?: number;
  mergeCount?: number;
};

// ---------------------------------------------------------------------------
// Alpha Signal Types (new)
// ---------------------------------------------------------------------------

export interface AlphaSignal {
  id: string;
  type:
    | 'WHALE_CONVERGENCE'
    | 'UNDERWATER_ACCUMULATION'
    | 'YIELD_MOMENTUM'
    | 'HIGH_CONVICTION_CLUSTER'
    | 'OI_SURGE_CONSENSUS';
  title: string;
  description: string;
  confidence: number;
  markets: string[];
  traders: string[];
  suggestedAction: string;
}

export interface ConvergenceScore {
  score: number;
  tier: 'STRONG' | 'MODERATE' | 'WEAK';
  breakdown: {
    consensus: number;
    edge: number;
    momentum: number;
    validation: number;
    quality: number;
  };
}

export interface TraderReliability {
  score: number;
  tier: 'RELIABLE' | 'MODERATE' | 'UNPROVEN';
}

// ---------------------------------------------------------------------------
// API Context (new)
// ---------------------------------------------------------------------------

export interface ApiContext {
  keyId: string;
  tier: 'free' | 'pro' | 'enterprise';
  dailyLimit: number;
  currentCount: number;
}
