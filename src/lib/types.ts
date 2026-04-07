export type SymbolInfo = {
  symbol: string; // internal symbol, e.g. "AAPL"
  stooqSymbol?: string; // e.g. "aapl.us"
  name: string;
  currency: "USD" | "CNY";
  market: "US" | "CN";
  lotSize?: number; // A-shares often 100; ETFs etc vary
};

export type Quote = {
  symbol: string;
  price: number;
  asOf: number; // epoch ms
  source: "stooq" | "simulated";
};

export type IntradayPoint = {
  ts: number; // epoch ms
  price: number; // in symbol currency
  vwap: number; // intraday average (approx)
  volume: number; // arbitrary units
};

export type IntradayMeta = {
  dayKey: string;
  prevClose: number; // in symbol currency
  open: number; // in symbol currency
  high: number; // in symbol currency
  low: number; // in symbol currency
};

export type OrderBookLevel = {
  price: number; // in symbol currency
  size: number; // shares
};

export type OrderBook = {
  asOf: number;
  bids: OrderBookLevel[]; // desc
  asks: OrderBookLevel[]; // asc
};

export type Position = {
  symbol: string;
  shares: number; // integer shares
  avgCost: number; // average cost per share (in symbol currency)
  lots: {
    shares: number;
    cost: number; // total cost in symbol currency (shares * price)
    buyDayKey: string; // YYYY-MM-DD in market timezone
  }[];
};

export type TradeSide = "BUY" | "SELL";

export type Trade = {
  id: string;
  ts: number; // epoch ms
  symbol: string;
  side: TradeSide;
  shares: number;
  price: number; // in symbol currency
  currency: "USD" | "CNY";
  feeUsd: number; // fee charged in USD (account base)
  amountUsd: number; // gross amount converted to USD (shares*price +/-)
};

export type AppState = {
  initialCash: number | null;
  cash: number; // USD base
  positions: Record<string, Position>;
  trades: Trade[];
  market: {
    mode: "stooq+sim" | "sim";
    autoTick: boolean;
    quotes: Record<string, Quote>;
    lastRefreshTs: number | null;
    fxUSDCNY: number; // 1 USD = X CNY
    intraday: Record<string, IntradayPoint[]>; // per symbol
    intradayMeta: Record<string, IntradayMeta>; // per symbol
    orderBooks: Record<string, OrderBook>; // per symbol
  };
};

