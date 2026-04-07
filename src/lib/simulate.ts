import type { Quote } from "./types";
import { getSymbolInfo } from "./symbols";

function getTimeParts(timeZone: string, ts: number) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(new Date(ts));
  const lookup = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return {
    weekday: lookup.weekday as string | undefined,
    hour: Number(lookup.hour),
    minute: Number(lookup.minute),
  };
}

function isWeekday(w?: string) {
  return w && w !== "Sat" && w !== "Sun";
}

export function isMarketOpen(market: "US" | "CN", ts: number) {
  if (market === "US") {
    const t = getTimeParts("America/New_York", ts);
    if (!isWeekday(t.weekday)) return false;
    const hhmm = t.hour * 60 + t.minute;
    // 09:30-16:00 ET (regular session, simplified)
    return hhmm >= 9 * 60 + 30 && hhmm < 16 * 60;
  }
  const t = getTimeParts("Asia/Shanghai", ts);
  if (!isWeekday(t.weekday)) return false;
  const hhmm = t.hour * 60 + t.minute;
  // 09:30-11:30, 13:00-15:00 CN (simplified)
  const morning = hhmm >= 9 * 60 + 30 && hhmm < 11 * 60 + 30;
  const afternoon = hhmm >= 13 * 60 && hhmm < 15 * 60;
  return morning || afternoon;
}

// Simple price simulation: geometric random walk around last price.
// This is NOT financial advice and is purely for demo/simulation.
export function nextSimulatedPrice(
  prev: number,
  opts?: { volatilityPerTick?: number; driftPerTick?: number; shockProb?: number; shockSize?: number }
) {
  const vol = opts?.volatilityPerTick ?? 0.003; // ~0.3% per tick
  const drift = opts?.driftPerTick ?? 0.0;
  const shockProb = opts?.shockProb ?? 0.003; // occasional jump
  const shockSize = opts?.shockSize ?? 0.03; // ~3% jump size
  const u = Math.random();
  const v = Math.random();
  const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); // N(0,1)
  let r = drift + vol * z;
  if (Math.random() < shockProb) {
    r += (Math.random() < 0.5 ? -1 : 1) * shockSize * (0.5 + Math.random());
  }
  const next = prev * Math.exp(r);
  return Math.max(0.01, next);
}

export function simulateTick(
  prevQuotes: Record<string, Quote>,
  symbols: string[],
  opts?: { fxUSDCNY?: number }
): Record<string, Quote> {
  const now = Date.now();
  const out: Record<string, Quote> = { ...prevQuotes };

  // Simulate FX (1 USD = X CNY)
  const prevFx = opts?.fxUSDCNY ?? 7.2;
  const fxQuoteSymbol = "USD/CNY";
  const fxPrev = prevQuotes[fxQuoteSymbol]?.price ?? prevFx;
  const fxNext = nextSimulatedPrice(fxPrev, { volatilityPerTick: 0.0005, shockProb: 0.0005, shockSize: 0.005 });
  out[fxQuoteSymbol] = { symbol: fxQuoteSymbol, price: fxNext, asOf: now, source: "simulated" };

  for (const s of symbols) {
    const info = getSymbolInfo(s);
    const market = info?.market ?? "US";
    const open = isMarketOpen(market, now);

    // Seed ranges more "market-like"
    const seed =
      info?.currency === "CNY"
        ? 10 + Math.random() * 90 // many A-shares in ~10-100 CNY range
        : 80 + Math.random() * 220; // US large caps often 80-300+

    const prev = prevQuotes[s]?.price ?? seed;

    // Volatility higher when market open; much lower when closed.
    const baseVol = info?.currency === "CNY" ? 0.004 : 0.003;
    const vol = open ? baseVol : baseVol * 0.15;
    const shockProb = open ? 0.004 : 0.0005;
    const shockSize = info?.currency === "CNY" ? 0.04 : 0.03;

    const price = nextSimulatedPrice(prev, { volatilityPerTick: vol, driftPerTick: 0.0, shockProb, shockSize });
    out[s] = { symbol: s, price, asOf: now, source: "simulated" };
  }
  return out;
}

