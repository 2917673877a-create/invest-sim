"use client";

import { useMemo } from "react";
import type { IntradayMeta, IntradayPoint } from "@/lib/types";
import { formatNumber } from "@/lib/format";

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

export function IntradayChart(props: {
  title: string;
  currencySymbol: "$" | "¥";
  series: IntradayPoint[];
  meta?: IntradayMeta | null;
  market?: "US" | "CN";
  height?: number;
}) {
  const h = props.height ?? 260;
  const w = 760;
  const pad = { l: 54, r: 56, t: 18, b: 34 };

  const data = props.series;
  const meta = props.meta ?? null;
  const prevClose = meta?.prevClose ?? (data[0]?.price ?? 0);

  const { minY, maxY, points, avgPoints, volBars, last, dirColors, refLines } = useMemo(() => {
    if (data.length === 0) {
      return {
        minY: 0,
        maxY: 1,
        points: "",
        avgPoints: "",
        volBars: [] as { x: number; y: number; hh: number; up: boolean }[],
        last: null as IntradayPoint | null,
        dirColors: { up: "rgba(239,68,68,0.9)", down: "rgba(34,197,94,0.9)" },
        refLines: [] as { y: number; label: string; color: string; dashed?: boolean }[],
      };
    }
    const prices = data.map((d) => d.price);
    const vwap = data.map((d) => d.vwap);
    const vols = data.map((d) => d.volume);
    const min = Math.min(...prices, ...vwap);
    const max = Math.max(...prices, ...vwap);
    const pc = prevClose || data[0]!.price;
    const limit = props.market === "CN" ? 0.1 : null;
    const limUp = limit ? pc * (1 + limit) : null;
    const limDn = limit ? pc * (1 - limit) : null;

    const span = Math.max(1e-6, max - min);
    const minY = Math.min(min - span * 0.08, limDn ?? Infinity, pc);
    const maxY = Math.max(max + span * 0.08, limUp ?? -Infinity, pc);

    const innerW = w - pad.l - pad.r;
    const innerH = h - pad.t - pad.b;

    const xAt = (i: number) => pad.l + (i / (data.length - 1)) * innerW;
    const yAt = (p: number) => pad.t + (1 - (p - minY) / (maxY - minY)) * innerH;

    const points = data.map((d, i) => `${xAt(i)},${yAt(d.price)}`).join(" ");
    const avgPoints = data.map((d, i) => `${xAt(i)},${yAt(d.vwap)}`).join(" ");

    const vmax = Math.max(...vols);
    const volH = 52;
    const volBars = data.map((d, i) => {
      const x = xAt(i);
      const hh = vmax ? (d.volume / vmax) * volH : 0;
      const y = h - pad.b - hh;
      const prev = data[Math.max(0, i - 1)]?.price ?? d.price;
      return { x, y, hh, up: d.price >= prev };
    });

    const last = data[data.length - 1]!;
    const up = last.price >= pc;
    const dirColors = {
      up: "rgba(239,68,68,0.92)", // CN apps often red up
      down: "rgba(34,197,94,0.92)",
      neutral: "rgba(120,120,120,0.9)",
    };

    const refLines: { y: number; label: string; color: string; dashed?: boolean }[] = [
      { y: yAt(pc), label: "昨收", color: "rgba(160,160,160,0.6)", dashed: true },
    ];
    if (limUp && limDn) {
      refLines.push({ y: yAt(limUp), label: "涨停", color: "rgba(239,68,68,0.45)", dashed: true });
      refLines.push({ y: yAt(limDn), label: "跌停", color: "rgba(34,197,94,0.45)", dashed: true });
    }

    return { minY, maxY, points, avgPoints, volBars, last, dirColors: { ...dirColors, up }, refLines };
  }, [data, h, pad.b, pad.l, pad.r, pad.t, prevClose, props.market]);

  const yLabels = useMemo(() => {
    const ticks = 4;
    const out: { y: number; v: number }[] = [];
    for (let i = 0; i <= ticks; i++) {
      const t = i / ticks;
      const v = maxY - (maxY - minY) * t;
      const y = pad.t + (h - pad.t - pad.b) * t;
      out.push({ y, v });
    }
    return out;
  }, [minY, maxY, h, pad.b, pad.t]);

  const lastPrice = last?.price ?? 0;
  const lastAvg = last?.vwap ?? 0;
  const changePct = prevClose ? ((lastPrice - prevClose) / Math.max(1e-6, prevClose)) * 100 : 0;
  const changeColor =
    changePct > 0 ? "text-rose-600 dark:text-rose-300" : changePct < 0 ? "text-emerald-600 dark:text-emerald-300" : "text-zinc-500";

  return (
    <div className="rounded-2xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-black">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="text-sm font-medium">{props.title}</div>
        <div className={`text-xs ${changeColor}`}>
          最新 {props.currencySymbol}
          {formatNumber(lastPrice, 3)} · 均价 {props.currencySymbol}
          {formatNumber(lastAvg, 3)} · 涨跌 {formatNumber(changePct, 2)}%
          {meta ? (
            <span className="ml-2 text-zinc-500">
              开 {props.currencySymbol}
              {formatNumber(meta.open, 2)} 高 {props.currencySymbol}
              {formatNumber(meta.high, 2)} 低 {props.currencySymbol}
              {formatNumber(meta.low, 2)}
            </span>
          ) : null}
        </div>
      </div>

      <div className="mt-3 overflow-x-auto">
        <svg viewBox={`0 0 ${w} ${h}`} className="min-w-[760px]">
          {/* grid */}
          {yLabels.map((t, i) => (
            <g key={i}>
              <line
                x1={pad.l}
                y1={t.y}
                x2={w - pad.r}
                y2={t.y}
                stroke="rgba(120,120,120,0.18)"
                strokeWidth="1"
              />
              <text x={8} y={t.y + 4} fontSize="11" fill="rgba(120,120,120,0.85)">
                {props.currencySymbol}
                {formatNumber(t.v, 2)}
              </text>
              {prevClose ? (
                <text x={w - pad.r + 6} y={t.y + 4} fontSize="11" fill="rgba(120,120,120,0.85)">
                  {formatNumber(((t.v - prevClose) / Math.max(1e-6, prevClose)) * 100, 2)}%
                </text>
              ) : null}
            </g>
          ))}

          {/* reference lines */}
          {(refLines ?? []).map((r, idx) => (
            <g key={idx}>
              <line
                x1={pad.l}
                y1={r.y}
                x2={w - pad.r}
                y2={r.y}
                stroke={r.color}
                strokeWidth="1"
                strokeDasharray={r.dashed ? "4 4" : undefined}
              />
              <text x={w - pad.r - 34} y={r.y - 4} fontSize="10" fill={r.color}>
                {r.label}
              </text>
            </g>
          ))}

          {/* volume bars */}
          {volBars.map((b, i) => (
            <line
              key={i}
              x1={b.x}
              y1={h - pad.b}
              x2={b.x}
              y2={clamp(b.y, pad.t, h - pad.b)}
              stroke={b.up ? "rgba(239,68,68,0.35)" : "rgba(34,197,94,0.35)"}
              strokeWidth="1"
            />
          ))}

          {/* avg line */}
          <polyline fill="none" stroke="rgba(234,179,8,0.9)" strokeWidth="2" points={avgPoints} />

          {/* price line */}
          <polyline
            fill="none"
            stroke={dirColors.up ? "rgba(239,68,68,0.92)" : "rgba(34,197,94,0.92)"}
            strokeWidth="2"
            points={points}
          />

          {/* x-axis */}
          <line
            x1={pad.l}
            y1={h - pad.b}
            x2={w - pad.r}
            y2={h - pad.b}
            stroke="rgba(120,120,120,0.25)"
            strokeWidth="1"
          />
          <text x={pad.l} y={h - 10} fontSize="11" fill="rgba(120,120,120,0.85)">
            开盘
          </text>
          <text x={w - pad.r - 24} y={h - 10} fontSize="11" fill="rgba(120,120,120,0.85)">
            收盘
          </text>
        </svg>
      </div>

      <div className="mt-2 text-xs text-zinc-500">
        折线=最新价（红涨绿跌），黄线=均价（近似 VWAP），底部=红绿量柱，右侧刻度=相对昨收涨跌幅。
      </div>
    </div>
  );
}

