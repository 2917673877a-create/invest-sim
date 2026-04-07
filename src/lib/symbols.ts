import type { SymbolInfo } from "./types";

export const SYMBOLS: SymbolInfo[] = [
  // US stocks (USD)
  { symbol: "AAPL", stooqSymbol: "aapl.us", name: "Apple", currency: "USD", market: "US" },
  { symbol: "MSFT", stooqSymbol: "msft.us", name: "Microsoft", currency: "USD", market: "US" },
  { symbol: "GOOGL", stooqSymbol: "googl.us", name: "Alphabet", currency: "USD", market: "US" },
  { symbol: "AMZN", stooqSymbol: "amzn.us", name: "Amazon", currency: "USD", market: "US" },
  { symbol: "TSLA", stooqSymbol: "tsla.us", name: "Tesla", currency: "USD", market: "US" },
  { symbol: "NVDA", stooqSymbol: "nvda.us", name: "NVIDIA", currency: "USD", market: "US" },

  // China A-shares (CNY) - simulated quotes by default
  { symbol: "600519", name: "贵州茅台", currency: "CNY", market: "CN", lotSize: 100 },
  { symbol: "601318", name: "中国平安", currency: "CNY", market: "CN", lotSize: 100 },
  { symbol: "600036", name: "招商银行", currency: "CNY", market: "CN", lotSize: 100 },
  { symbol: "300750", name: "宁德时代", currency: "CNY", market: "CN", lotSize: 100 },
  { symbol: "000333", name: "美的集团", currency: "CNY", market: "CN", lotSize: 100 },
  { symbol: "601012", name: "隆基绿能", currency: "CNY", market: "CN", lotSize: 100 },
];

export function getSymbolInfo(symbol: string): SymbolInfo | undefined {
  return SYMBOLS.find((s) => s.symbol === symbol);
}

