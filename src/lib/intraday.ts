import type { IntradayMeta, IntradayPoint, OrderBook } from "./types";
import { getSymbolInfo } from "./symbols";
import { isMarketOpen, nextSimulatedPrice } from "./simulate";

function seededRand(seed: number) {
  // mulberry32
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function dayKey(ts: number, timeZone: string) {
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

function sessionTimelineMinutes(market: "US" | "CN") {
  if (market === "US") return 390; // 09:30-16:00
  // CN: 09:30-11:30 + lunch gap (90 min) + 13:00-15:00 => 120 + 90 + 120 = 330
  return 330;
}

function isTradingMinuteCN(localMinuteFromOpen: number) {
  // 0..119 trade, 120..209 lunch break (90min), 210..329 trade
  return localMinuteFromOpen < 120 || localMinuteFromOpen >= 210;
}

export function ensureIntradaySeries(args: {
  symbol: string;
  now: number;
  anchorPrice: number;
  prev?: IntradayPoint[];
}): { series: IntradayPoint[]; meta: IntradayMeta } {
  const info = getSymbolInfo(args.symbol);
  const market = info?.market ?? "US";
  const tz = market === "US" ? "America/New_York" : "Asia/Shanghai";
  const key = dayKey(args.now, tz);
  const existing = args.prev ?? [];
  if (existing.length > 0) {
    // if already for today, keep
    const prevKey = dayKey(existing[0]!.ts, tz);
    if (prevKey === key) {
      const prices = existing.map((p) => p.price);
      const meta: IntradayMeta = {
        dayKey: key,
        prevClose: existing[0]!.price,
        open: existing[0]!.price,
        high: Math.max(...prices),
        low: Math.min(...prices),
      };
      return { series: existing, meta };
    }
  }

  const mins = sessionTimelineMinutes(market);
  const seed = Math.floor(args.anchorPrice * 100) ^ hashString(args.symbol + key);
  const rnd = seededRand(seed);

  const startTs = args.now - mins * 60_000;
  // Use a synthetic "prev close" around anchor.
  const prevClose = Math.max(0.01, args.anchorPrice * (0.995 + rnd() * 0.01));
  let price = prevClose;
  let cumPV = 0;
  let cumV = 0;
  const out: IntradayPoint[] = [];
  let high = price;
  let low = price;

  for (let i = 0; i < mins; i++) {
    if (market === "CN" && !isTradingMinuteCN(i)) {
      // Lunch break: keep flat, near-zero volume
      out.push({ ts: startTs + i * 60_000, price, vwap: cumV ? cumPV / cumV : price, volume: 0 });
      continue;
    }

    // Intraday volatility profile: higher at open/close
    const x = i / (mins - 1);
    const profile = 0.8 + 1.6 * Math.abs(x - 0.5); // U-shape
    const baseVol = info?.currency === "CNY" ? 0.0025 : 0.002;
    const vol = baseVol * profile;
    const drift = 0;

    // Use deterministic pseudo-random shocks
    const shockProb = 0.001 + 0.002 * profile;
    const shock = rnd() < shockProb ? (rnd() < 0.5 ? -1 : 1) * (0.01 + rnd() * 0.02) : 0;
    price = Math.max(0.01, price * Math.exp(drift + vol * (rnd() - 0.5) * 2 + shock));

    const volume = Math.floor(100 + rnd() * 900 * profile);
    cumPV += price * volume;
    cumV += volume;
    const vwap = cumV > 0 ? cumPV / cumV : price;

    out.push({
      ts: startTs + i * 60_000,
      price,
      vwap,
      volume,
    });

    high = Math.max(high, price);
    low = Math.min(low, price);
  }

  const meta: IntradayMeta = {
    dayKey: key,
    prevClose,
    open: out.find((p) => p.volume > 0)?.price ?? prevClose,
    high,
    low,
  };

  return { series: out, meta };
}

export function tickIntraday(args: {
  symbol: string;
  now: number;
  lastPrice: number;
  series: IntradayPoint[];
}): { series: IntradayPoint[]; meta: Pick<IntradayMeta, "high" | "low"> } {
  const info = getSymbolInfo(args.symbol);
  const market = info?.market ?? "US";
  const open = isMarketOpen(market, args.now);
  const vol = open ? (info?.currency === "CNY" ? 0.0018 : 0.0015) : (info?.currency === "CNY" ? 0.0002 : 0.00015);

  const nextPrice = nextSimulatedPrice(args.lastPrice, {
    volatilityPerTick: vol,
    shockProb: open ? 0.0015 : 0.0002,
    shockSize: info?.currency === "CNY" ? 0.02 : 0.015,
  });

  const n = args.series.length;
  if (n === 0) return { series: args.series, meta: { high: nextPrice, low: nextPrice } };

  // Update last minute bar in-place.
  const last = args.series[n - 1]!;
  const volume = last.volume === 0 ? 0 : Math.max(1, Math.floor(last.volume * (0.95 + Math.random() * 0.1)));
  const cumPV = args.series.reduce((s, p) => s + p.price * p.volume, 0) - last.price * last.volume + nextPrice * volume;
  const cumV = args.series.reduce((s, p) => s + p.volume, 0) - last.volume + volume;
  const vwap = cumV > 0 ? cumPV / cumV : nextPrice;

  const out = args.series.slice();
  out[n - 1] = { ...last, price: nextPrice, volume, vwap };
  const prices = out.filter((p) => p.volume > 0).map((p) => p.price);
  const hi = prices.length ? Math.max(...prices) : nextPrice;
  const lo = prices.length ? Math.min(...prices) : nextPrice;
  return { series: out, meta: { high: hi, low: lo } };
}

export function makeOrderBook(args: {
  symbol: string;
  mid: number;
  lotSize: number;
}): OrderBook {
  const now = Date.now();
  const levels = 10;
  const tick = Math.max(0.01, args.mid * 0.0002); // ~2 bps tick for display
  const bids = Array.from({ length: levels }, (_, i) => {
    const price = args.mid - tick * (i + 1);
    const size = args.lotSize * Math.max(1, Math.floor(1 + Math.random() * 20 * (1 - i / levels)));
    return { price: Math.max(0.01, price), size };
  });
  const asks = Array.from({ length: levels }, (_, i) => {
    const price = args.mid + tick * (i + 1);
    const size = args.lotSize * Math.max(1, Math.floor(1 + Math.random() * 20 * (1 - i / levels)));
    return { price, size };
  });
  return { asOf: now, bids, asks };
}

function hashString(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

