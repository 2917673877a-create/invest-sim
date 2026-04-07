import type { Quote } from "./types";
import { getSymbolInfo } from "./symbols";

function parseStooqClose(csv: string): { close: number; ts: number } | null {
  // Format:
  // Symbol,Date,Time,Open,High,Low,Close,Volume
  // AAPL.US,2026-04-06,22:00:10,xxx,...
  const lines = csv.trim().split(/\r?\n/);
  if (lines.length < 2) return null;
  const header = lines[0].split(",");
  const closeIdx = header.findIndex((h) => h.toLowerCase() === "close");
  const dateIdx = header.findIndex((h) => h.toLowerCase() === "date");
  const timeIdx = header.findIndex((h) => h.toLowerCase() === "time");
  if (closeIdx < 0) return null;

  const last = lines[lines.length - 1].split(",");
  const close = Number(last[closeIdx]);
  if (!Number.isFinite(close)) return null;

  const dateStr = dateIdx >= 0 ? last[dateIdx] : "";
  const timeStr = timeIdx >= 0 ? last[timeIdx] : "";
  const ts = Date.parse(`${dateStr}T${timeStr}Z`);
  return { close, ts: Number.isFinite(ts) ? ts : Date.now() };
}

export async function fetchQuoteFromStooq(symbol: string): Promise<Quote | null> {
  const info = getSymbolInfo(symbol);
  if (!info?.stooqSymbol) return null;

  // Using Stooq "q/l" CSV as a front-end reachable data source.
  // Note: may not be real-time and may fail due to CORS/network; caller should fall back.
  const url = `https://stooq.com/q/l/?s=${encodeURIComponent(
    info.stooqSymbol
  )}&f=sd2t2ohlcv&h&e=csv`;

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return null;
  const text = await res.text();
  const parsed = parseStooqClose(text);
  if (!parsed) return null;

  return {
    symbol,
    price: parsed.close,
    asOf: parsed.ts,
    source: "stooq",
  };
}

