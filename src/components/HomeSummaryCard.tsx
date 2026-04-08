"use client";

import { useMemo } from "react";
import type { AppState } from "@/lib/types";
import { computePortfolioMetrics } from "@/lib/portfolio-metrics";
import { formatMoney, formatNumber } from "@/lib/format";

function signedMoney(amount: number) {
  const sign = amount > 0 ? "+" : amount < 0 ? "−" : "";
  const abs = Math.abs(amount);
  return `${sign}${formatMoney(abs, "USD")}`;
}

export function HomeSummaryCard(props: { state: AppState }) {
  const m = useMemo(() => computePortfolioMetrics(props.state), [props.state]);

  const floatColor =
    m.floatPnlUsd > 0
      ? "text-rose-400"
      : m.floatPnlUsd < 0
        ? "text-sky-400"
        : "text-zinc-400";
  const dailyColor =
    m.dailyPnlUsd > 0
      ? "text-rose-400"
      : m.dailyPnlUsd < 0
        ? "text-sky-400"
        : "text-zinc-400";

  return (
    <div className="rounded-2xl border border-white/10 bg-black p-6 text-white shadow-lg">
      <div className="grid grid-cols-2 gap-x-8 gap-y-6">
        <div>
          <div className="text-xs text-zinc-400">总资产</div>
          <div className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">
            {formatNumber(m.totalAssetsUsd, 2)}
          </div>
        </div>
        <div>
          <div className="text-xs text-zinc-400">浮动盈亏</div>
          <div className={`mt-1 text-2xl font-semibold tracking-tight tabular-nums ${floatColor}`}>
            {signedMoney(m.floatPnlUsd)}
          </div>
        </div>
        <div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400">
            <span>总市值</span>
            <span className="rounded border border-white/20 px-1.5 py-0.5 text-[10px] text-zinc-300">
              无AI交易
            </span>
          </div>
          <div className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">
            {formatNumber(m.marketValueUsd, 2)}
          </div>
        </div>
        <div>
          <div className="flex items-center gap-1 text-xs text-zinc-400">
            <span>当日参考盈亏</span>
            <span
              className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-zinc-500 text-[10px] text-zinc-400"
              title="按当日开盘价相对现价估算，仅供参考"
            >
              i
            </span>
          </div>
          <div className={`mt-1 text-2xl font-semibold tracking-tight tabular-nums ${dailyColor}`}>
            {signedMoney(m.dailyPnlUsd)}
          </div>
        </div>
      </div>
      <p className="mt-4 text-[11px] leading-relaxed text-zinc-500">
        现金与持仓均以 USD 汇总；当日参考盈亏使用分时「开盘」与当前价对比估算。
      </p>
    </div>
  );
}
