import type { AppState } from "@/lib/types";
import { SYMBOLS, getSymbolInfo } from "@/lib/symbols";

function toUsd(amount: number, currency: "USD" | "CNY", fxUSDCNY: number) {
  if (currency === "USD") return amount;
  return amount / Math.max(0.0001, fxUSDCNY);
}

/** 持仓总市值（USD）、浮动盈亏（USD）、当日参考盈亏（USD，基于分时 open vs 现价） */
export function computePortfolioMetrics(state: AppState) {
  const fx = Math.max(0.0001, state.market.fxUSDCNY);

  let marketValueUsd = 0;
  let floatPnlUsd = 0;
  let dailyPnlUsd = 0;

  for (const s of SYMBOLS) {
    const p = state.positions[s.symbol];
    if (!p || p.shares <= 0) continue;

    const info = getSymbolInfo(s.symbol);
    if (!info) continue;

    const q = state.market.quotes[s.symbol]?.price ?? null;
    if (!q) continue;

    const meta = state.market.intradayMeta[s.symbol];
    const open = meta?.open ?? q;

    const valueNative = p.shares * q;
    const costNative = p.shares * p.avgCost;
    const mvUsd = toUsd(valueNative, info.currency, fx);
    const costUsd = toUsd(costNative, info.currency, fx);
    marketValueUsd += mvUsd;
    floatPnlUsd += mvUsd - costUsd;

    const dailyMoveNative = (q - open) * p.shares;
    dailyPnlUsd += toUsd(dailyMoveNative, info.currency, fx);
  }

  const totalAssetsUsd = state.cash + marketValueUsd;

  return {
    totalAssetsUsd,
    marketValueUsd,
    floatPnlUsd,
    dailyPnlUsd,
  };
}
