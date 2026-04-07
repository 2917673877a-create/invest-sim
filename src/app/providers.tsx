"use client";

import React, { createContext, useContext, useEffect, useMemo, useReducer } from "react";
import type { AppState, Trade } from "@/lib/types";
import { SYMBOLS, getSymbolInfo } from "@/lib/symbols";
import { clearState, loadState, saveState } from "@/lib/storage";
import { fetchQuoteFromStooq } from "@/lib/market";
import { simulateTick } from "@/lib/simulate";
import { ensureIntradaySeries, makeOrderBook, tickIntraday } from "@/lib/intraday";
import { isMarketOpen } from "@/lib/simulate";

type Action =
  | { type: "INIT_FROM_STORAGE"; state: AppState }
  | { type: "SET_INITIAL_CASH"; amount: number }
  | { type: "RESET_ALL" }
  | { type: "SET_MARKET_MODE"; mode: AppState["market"]["mode"] }
  | { type: "SET_AUTO_TICK"; value: boolean }
  | {
      type: "SET_QUOTES";
      quotes: AppState["market"]["quotes"];
      lastRefreshTs: number;
      fxUSDCNY?: number;
      intraday?: AppState["market"]["intraday"];
      intradayMeta?: AppState["market"]["intradayMeta"];
      orderBooks?: AppState["market"]["orderBooks"];
    }
  | { type: "BUY"; symbol: string; shares: number }
  | { type: "SELL"; symbol: string; shares: number };

const defaultState: AppState = {
  initialCash: null,
  cash: 0,
  positions: {},
  trades: [],
  market: {
    mode: "stooq+sim",
    autoTick: true,
    quotes: {},
    lastRefreshTs: null,
    fxUSDCNY: 7.2,
    intraday: {},
    intradayMeta: {},
    orderBooks: {},
  },
};

function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function toUsd(amount: number, currency: "USD" | "CNY", fxUSDCNY: number) {
  if (currency === "USD") return amount;
  return amount / Math.max(0.0001, fxUSDCNY);
}

function calcFeeUsd(args: { market: "US" | "CN"; side: "BUY" | "SELL"; notionalUsd: number }) {
  // Simplified fee model:
  // - US: commission 0.02% with $1 min
  // - CN: commission 0.03% (both sides) + stamp duty 0.1% on sells
  const n = Math.max(0, args.notionalUsd);
  if (args.market === "US") {
    return Math.max(1, n * 0.0002);
  }
  const commission = Math.max(0.2, n * 0.0003);
  const stamp = args.side === "SELL" ? n * 0.001 : 0;
  return commission + stamp;
}

function applySlippage(price: number, side: "BUY" | "SELL") {
  const slip = 0.0005; // 5 bps
  return side === "BUY" ? price * (1 + slip) : price * (1 - slip);
}

function getDayKey(ts: number, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(ts));
  const m: Record<string, string> = {};
  for (const p of parts) m[p.type] = p.value;
  return `${m.year}-${m.month}-${m.day}`;
}

function roundToTick(price: number, tick: number, side: "BUY" | "SELL") {
  if (tick <= 0) return price;
  const n = price / tick;
  const r = side === "BUY" ? Math.ceil(n) : Math.floor(n);
  return Math.max(tick, r * tick);
}

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "INIT_FROM_STORAGE":
      return action.state;
    case "SET_INITIAL_CASH": {
      const amt = Math.max(0, Number(action.amount) || 0);
      return {
        ...state,
        initialCash: amt,
        cash: amt,
        positions: {},
        trades: [],
      };
    }
    case "RESET_ALL":
      return { ...defaultState };
    case "SET_MARKET_MODE":
      return { ...state, market: { ...state.market, mode: action.mode } };
    case "SET_AUTO_TICK":
      return { ...state, market: { ...state.market, autoTick: action.value } };
    case "SET_QUOTES":
      return {
        ...state,
        market: {
          ...state.market,
          quotes: action.quotes,
          lastRefreshTs: action.lastRefreshTs,
          fxUSDCNY: action.fxUSDCNY ?? state.market.fxUSDCNY,
          intraday: action.intraday ?? state.market.intraday,
          intradayMeta: action.intradayMeta ?? state.market.intradayMeta,
          orderBooks: action.orderBooks ?? state.market.orderBooks,
        },
      };
    case "BUY": {
      const shares = Math.floor(action.shares);
      if (!Number.isFinite(shares) || shares <= 0) return state;
      const info = getSymbolInfo(action.symbol);
      if (!info) return state;
      const now = Date.now();
      if (!isMarketOpen(info.market, now)) return state;
      const quote = state.market.quotes[action.symbol];
      if (!quote?.price || quote.price <= 0) return state;
      const tick = info.market === "US" ? 0.01 : 0.01;
      let execPrice = applySlippage(quote.price, "BUY");
      execPrice = roundToTick(execPrice, tick, "BUY");

      // Limit up/down for CN (±10% based on prevClose)
      if (info.market === "CN") {
        const pc = state.market.intradayMeta[action.symbol]?.prevClose ?? quote.price;
        const up = pc * 1.1;
        if (execPrice >= up - 1e-6) return state;
      }
      const gross = shares * execPrice; // in symbol currency
      const grossUsd = toUsd(gross, info.currency, state.market.fxUSDCNY);
      const feeUsd = calcFeeUsd({ market: info.market, side: "BUY", notionalUsd: grossUsd });
      const totalUsd = grossUsd + feeUsd;
      if (state.cash < totalUsd) return state;

      const prev = state.positions[action.symbol];
      const prevShares = prev?.shares ?? 0;
      const prevCost = (prev?.avgCost ?? 0) * prevShares; // in symbol currency
      const newShares = prevShares + shares;
      const newAvg = newShares > 0 ? (prevCost + gross) / newShares : 0;
      const tz = info.market === "US" ? "America/New_York" : "Asia/Shanghai";
      const buyDayKey = getDayKey(now, tz);
      const nextLots = [...(prev?.lots ?? [])];
      nextLots.push({ shares, cost: gross, buyDayKey });

      const trade: Trade = {
        id: uid(),
        ts: Date.now(),
        symbol: action.symbol,
        side: "BUY",
        shares,
        price: execPrice,
        currency: info.currency,
        feeUsd,
        amountUsd: grossUsd,
      };

      return {
        ...state,
        cash: state.cash - totalUsd,
        positions: {
          ...state.positions,
          [action.symbol]: { symbol: action.symbol, shares: newShares, avgCost: newAvg, lots: nextLots },
        },
        trades: [trade, ...state.trades],
      };
    }
    case "SELL": {
      const shares = Math.floor(action.shares);
      if (!Number.isFinite(shares) || shares <= 0) return state;
      const info = getSymbolInfo(action.symbol);
      if (!info) return state;
      const now = Date.now();
      if (!isMarketOpen(info.market, now)) return state;
      const quote = state.market.quotes[action.symbol];
      if (!quote?.price || quote.price <= 0) return state;
      const prev = state.positions[action.symbol];
      const prevShares = prev?.shares ?? 0;
      if (prevShares < shares) return state;

      const tick = info.market === "US" ? 0.01 : 0.01;
      let execPrice = applySlippage(quote.price, "SELL");
      execPrice = roundToTick(execPrice, tick, "SELL");

      if (info.market === "CN") {
        const pc = state.market.intradayMeta[action.symbol]?.prevClose ?? quote.price;
        const dn = pc * 0.9;
        if (execPrice <= dn + 1e-6) return state;
      }

      // T+1 for CN: shares bought today cannot be sold
      let sellableShares = prevShares;
      let nextLots = prev?.lots ?? [];
      if (info.market === "CN") {
        const todayKey = getDayKey(now, "Asia/Shanghai");
        const eligible = nextLots.filter((l) => l.buyDayKey < todayKey);
        sellableShares = eligible.reduce((s, l) => s + l.shares, 0);
        if (sellableShares < shares) return state;

        // FIFO reduce eligible lots
        let remainingToSell = shares;
        const updatedLots: typeof nextLots = [];
        for (const lot of nextLots) {
          if (lot.buyDayKey >= todayKey) {
            updatedLots.push(lot);
            continue;
          }
          if (remainingToSell <= 0) {
            updatedLots.push(lot);
            continue;
          }
          const take = Math.min(lot.shares, remainingToSell);
          const leftShares = lot.shares - take;
          const leftCost = lot.cost * (leftShares / lot.shares);
          remainingToSell -= take;
          if (leftShares > 0) updatedLots.push({ ...lot, shares: leftShares, cost: leftCost });
        }
        nextLots = updatedLots;
      } else {
        // US: allow T+0; reduce lots if present, else keep empty
        if (nextLots.length > 0) {
          let remainingToSell = shares;
          const updatedLots: typeof nextLots = [];
          for (const lot of nextLots) {
            if (remainingToSell <= 0) {
              updatedLots.push(lot);
              continue;
            }
            const take = Math.min(lot.shares, remainingToSell);
            const leftShares = lot.shares - take;
            const leftCost = lot.cost * (leftShares / lot.shares);
            remainingToSell -= take;
            if (leftShares > 0) updatedLots.push({ ...lot, shares: leftShares, cost: leftCost });
          }
          nextLots = updatedLots;
        }
      }

      const gross = shares * execPrice; // in symbol currency
      const grossUsd = toUsd(gross, info.currency, state.market.fxUSDCNY);
      const feeUsd = calcFeeUsd({ market: info.market, side: "SELL", notionalUsd: grossUsd });
      const netUsd = Math.max(0, grossUsd - feeUsd);
      const remaining = prevShares - shares;

      const trade: Trade = {
        id: uid(),
        ts: Date.now(),
        symbol: action.symbol,
        side: "SELL",
        shares,
        price: execPrice,
        currency: info.currency,
        feeUsd,
        amountUsd: grossUsd,
      };

      const nextPositions = { ...state.positions };
      if (remaining === 0) delete nextPositions[action.symbol];
      else {
        const totalCost = nextLots.reduce((s, l) => s + l.cost, 0);
        const avgCost = remaining > 0 ? totalCost / remaining : 0;
        nextPositions[action.symbol] = { ...prev, shares: remaining, avgCost, lots: nextLots };
      }

      return {
        ...state,
        cash: state.cash + netUsd,
        positions: nextPositions,
        trades: [trade, ...state.trades],
      };
    }
    default:
      return state;
  }
}

type AppContextValue = {
  state: AppState;
  setInitialCash: (amount: number) => void;
  resetAll: () => void;
  refreshQuotes: () => Promise<void>;
  setMarketMode: (mode: AppState["market"]["mode"]) => void;
  setAutoTick: (value: boolean) => void;
  buy: (symbol: string, shares: number) => { ok: boolean; error?: string };
  sell: (symbol: string, shares: number) => { ok: boolean; error?: string };
  symbols: string[];
};

const Ctx = createContext<AppContextValue | null>(null);

export function AppProviders({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, defaultState);
  const symbols = useMemo(() => SYMBOLS.map((s) => s.symbol), []);

  // Load from localStorage once
  useEffect(() => {
    const loaded = loadState();
    if (loaded) {
      const patched: AppState = {
        ...loaded,
        market: {
          ...loaded.market,
          fxUSDCNY: loaded.market.fxUSDCNY ?? defaultState.market.fxUSDCNY,
          intraday: loaded.market.intraday ?? {},
          intradayMeta: loaded.market.intradayMeta ?? {},
          orderBooks: loaded.market.orderBooks ?? {},
        },
      };
      // Migrate old positions without lots
      const migratedPositions: AppState["positions"] = {};
      for (const [sym, p] of Object.entries(patched.positions ?? {})) {
        if ((p as any).lots) migratedPositions[sym] = p as any;
        else {
          const info = getSymbolInfo(sym);
          const tz = info?.market === "US" ? "America/New_York" : "Asia/Shanghai";
          const dayKey = getDayKey(Date.now(), tz);
          migratedPositions[sym] = {
            ...p,
            lots: p.shares > 0 ? [{ shares: p.shares, cost: p.shares * p.avgCost, buyDayKey: dayKey }] : [],
          };
        }
      }
      patched.positions = migratedPositions;
      dispatch({ type: "INIT_FROM_STORAGE", state: patched });
    } else {
      // First run default: $200,000 initial cash
      dispatch({ type: "SET_INITIAL_CASH", amount: 200000 });
      // Seed initial quotes so UI isn't empty
      const seeded = simulateTick({}, symbols, { fxUSDCNY: defaultState.market.fxUSDCNY });
      const fx = seeded["USD/CNY"]?.price ?? defaultState.market.fxUSDCNY;
      dispatch({
        type: "SET_QUOTES",
        quotes: seeded,
        lastRefreshTs: Date.now(),
        fxUSDCNY: fx,
        intraday: {},
        intradayMeta: {},
        orderBooks: {},
      });
    }
  }, []);

  // Persist
  useEffect(() => {
    saveState(state);
  }, [state]);

  // Auto-tick simulation
  useEffect(() => {
    if (!state.market.autoTick) return;
    const id = window.setInterval(() => {
      const next = simulateTick(state.market.quotes, symbols, { fxUSDCNY: state.market.fxUSDCNY });
      const fx = next["USD/CNY"]?.price ?? state.market.fxUSDCNY;
      const now = Date.now();
      const nextIntraday: AppState["market"]["intraday"] = { ...state.market.intraday };
      const nextIntradayMeta: AppState["market"]["intradayMeta"] = { ...state.market.intradayMeta };
      const nextBooks: AppState["market"]["orderBooks"] = { ...state.market.orderBooks };

      for (const sym of symbols) {
        const q = next[sym]?.price;
        if (!q) continue;
        const ensured = ensureIntradaySeries({
          symbol: sym,
          now,
          anchorPrice: q,
          prev: nextIntraday[sym],
        });
        const ticked = tickIntraday({ symbol: sym, now, lastPrice: q, series: ensured.series });
        nextIntraday[sym] = ticked.series;
        nextIntradayMeta[sym] = {
          ...(ensured.meta ?? { dayKey: "", prevClose: q, open: q, high: q, low: q }),
          high: ticked.meta.high,
          low: ticked.meta.low,
        };

        const info = getSymbolInfo(sym);
        nextBooks[sym] = makeOrderBook({ symbol: sym, mid: q, lotSize: info?.lotSize ?? 1 });
      }

      dispatch({
        type: "SET_QUOTES",
        quotes: next,
        lastRefreshTs: now,
        fxUSDCNY: fx,
        intraday: nextIntraday,
        intradayMeta: nextIntradayMeta,
        orderBooks: nextBooks,
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [state.market.autoTick, state.market.quotes, symbols]);

  const refreshQuotes = async () => {
    if (state.market.mode === "sim") {
      const next = simulateTick(state.market.quotes, symbols, { fxUSDCNY: state.market.fxUSDCNY });
      const fx = next["USD/CNY"]?.price ?? state.market.fxUSDCNY;
      dispatch({ type: "SET_QUOTES", quotes: next, lastRefreshTs: Date.now(), fxUSDCNY: fx });
      return;
    }

    const out: AppState["market"]["quotes"] = { ...state.market.quotes };
    await Promise.all(
      symbols.map(async (s) => {
        try {
          const q = await fetchQuoteFromStooq(s);
          if (q) out[s] = q;
        } catch {
          // ignore; fallback remains
        }
      })
    );

    // If nothing fetched, fall back to a simulated tick so UI isn't empty.
    const hasAny = Object.keys(out).length > 0;
    const merged = hasAny ? out : simulateTick(state.market.quotes, symbols, { fxUSDCNY: state.market.fxUSDCNY });
    const fxQuote = merged["USD/CNY"]?.price ?? state.market.fxUSDCNY;

    dispatch({ type: "SET_QUOTES", quotes: merged, lastRefreshTs: Date.now(), fxUSDCNY: fxQuote });
  };

  const setInitialCash = (amount: number) => dispatch({ type: "SET_INITIAL_CASH", amount });
  const setMarketMode = (mode: AppState["market"]["mode"]) => dispatch({ type: "SET_MARKET_MODE", mode });
  const setAutoTick = (value: boolean) => dispatch({ type: "SET_AUTO_TICK", value });

  const resetAll = () => {
    clearState();
    dispatch({ type: "RESET_ALL" });
  };

  const buy = (symbol: string, shares: number) => {
    const info = getSymbolInfo(symbol);
    if (!info) return { ok: false, error: "标的不存在" };
    const now = Date.now();
    if (!isMarketOpen(info.market, now)) return { ok: false, error: "当前非交易时段，无法成交" };
    const q = state.market.quotes[symbol]?.price;
    if (!q) return { ok: false, error: "暂无报价，请先刷新/等待更新" };
    if (info.market === "CN") {
      const pc = state.market.intradayMeta[symbol]?.prevClose ?? q;
      if (q >= pc * 1.1 - 1e-6) return { ok: false, error: "涨停附近，模拟中不可买入" };
      if (shares % (info.lotSize ?? 1) !== 0) return { ok: false, error: `A 股需按整手成交（${info.lotSize ?? 1} 股）` };
    }
    dispatch({ type: "BUY", symbol, shares });
    return { ok: true };
  };

  const sell = (symbol: string, shares: number) => {
    const info = getSymbolInfo(symbol);
    if (!info) return { ok: false, error: "标的不存在" };
    const now = Date.now();
    if (!isMarketOpen(info.market, now)) return { ok: false, error: "当前非交易时段，无法成交" };
    const q = state.market.quotes[symbol]?.price;
    if (!q) return { ok: false, error: "暂无报价，请先刷新/等待更新" };
    const pos = state.positions[symbol];
    if (!pos || pos.shares < shares) return { ok: false, error: "可卖数量不足" };
    if (info.market === "CN") {
      const pc = state.market.intradayMeta[symbol]?.prevClose ?? q;
      if (q <= pc * 0.9 + 1e-6) return { ok: false, error: "跌停附近，模拟中不可卖出" };
      const todayKey = getDayKey(now, "Asia/Shanghai");
      const sellable = (pos.lots ?? []).filter((l) => l.buyDayKey < todayKey).reduce((s, l) => s + l.shares, 0);
      if (sellable < shares) return { ok: false, error: `A 股 T+1：今日买入不可卖出（可卖 ${sellable} 股）` };
      if (shares % (info.lotSize ?? 1) !== 0) return { ok: false, error: `A 股需按整手成交（${info.lotSize ?? 1} 股）` };
    }
    dispatch({ type: "SELL", symbol, shares });
    return { ok: true };
  };

  const value: AppContextValue = {
    state,
    setInitialCash,
    resetAll,
    refreshQuotes,
    setMarketMode,
    setAutoTick,
    buy,
    sell,
    symbols,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useApp must be used within AppProviders");
  return v;
}

