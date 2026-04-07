"use client";

import { useMemo } from "react";
import { useApp } from "@/app/providers";
import { SYMBOLS, getSymbolInfo } from "@/lib/symbols";
import { formatMoney, formatNumber } from "@/lib/format";

export default function PortfolioPage() {
  const { state, refreshQuotes } = useApp();

  const rows = useMemo(() => {
    return SYMBOLS.map((s) => {
      const p = state.positions[s.symbol];
      const q = state.market.quotes[s.symbol]?.price ?? null;
      const shares = p?.shares ?? 0;
      const avg = p?.avgCost ?? 0;
      const valueNative = q ? shares * q : 0;
      const costNative = shares * avg;
      const pnlNative = valueNative - costNative;
      const fx = Math.max(0.0001, state.market.fxUSDCNY);
      const valueUsd = s.currency === "USD" ? valueNative : valueNative / fx;
      const costUsd = s.currency === "USD" ? costNative : costNative / fx;
      const pnlUsd = valueUsd - costUsd;
      return {
        symbol: s.symbol,
        name: s.name,
        currency: s.currency,
        shares,
        avg,
        price: q,
        valueUsd,
        pnlUsd,
      };
    }).filter((r) => r.shares > 0 || r.price !== null);
  }, [state.positions, state.market.quotes]);

  const positionsValue = rows.reduce((sum, r) => sum + r.valueUsd, 0);
  const total = state.cash + positionsValue;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10">
      <h1 className="text-xl font-semibold tracking-tight">资产</h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        现金 + 持仓市值 = 总资产。报价来自公开拉取（可能延迟）并叠加前端模拟波动。
      </p>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-black/10 bg-white p-5 dark:border-white/10 dark:bg-black">
          <div className="text-sm font-medium">资产概览</div>
          <div className="mt-3 space-y-2 text-sm">
            <div className="flex items-baseline justify-between">
              <span className="text-zinc-600 dark:text-zinc-400">现金</span>
              <span className="font-semibold">{formatMoney(state.cash, "USD")}</span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-zinc-600 dark:text-zinc-400">持仓市值</span>
              <span className="font-semibold">{formatMoney(positionsValue, "USD")}</span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-zinc-600 dark:text-zinc-400">总资产</span>
              <span className="font-semibold">{formatMoney(total, "USD")}</span>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button
              className="rounded-lg border border-black/10 px-3 py-2 text-sm hover:bg-zinc-50 dark:border-white/10 dark:hover:bg-zinc-900"
              onClick={refreshQuotes}
            >
              刷新报价
            </button>
          </div>
          <div className="mt-3 text-xs text-zinc-500">
            最近更新：{state.market.lastRefreshTs ? new Date(state.market.lastRefreshTs).toLocaleString() : "未更新"}
          </div>
        </div>

        <div className="rounded-2xl border border-black/10 bg-white p-5 dark:border-white/10 dark:bg-black lg:col-span-2">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium">持仓明细</div>
            <div className="text-xs text-zinc-500">按当前报价估值</div>
          </div>

          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-zinc-500">
                <tr className="border-b border-black/10 dark:border-white/10">
                  <th className="py-2">标的</th>
                  <th className="py-2">股数</th>
                  <th className="py-2">均价</th>
                  <th className="py-2">现价</th>
                  <th className="py-2">市值</th>
                  <th className="py-2">浮盈亏</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td className="py-3 text-zinc-500" colSpan={6}>
                      暂无持仓（可去交易页买入）
                    </td>
                  </tr>
                ) : (
                  rows.map((r) => {
                    const info = getSymbolInfo(r.symbol);
                    const pnlColor =
                      r.pnlUsd > 0
                        ? "text-emerald-700 dark:text-emerald-300"
                        : r.pnlUsd < 0
                          ? "text-rose-700 dark:text-rose-300"
                          : "text-zinc-600 dark:text-zinc-400";
                    return (
                      <tr key={r.symbol} className="border-b border-black/5 dark:border-white/5">
                        <td className="py-2">
                          <div className="font-medium">{r.symbol}</div>
                          <div className="text-xs text-zinc-500">{info?.name ?? ""}</div>
                        </td>
                        <td className="py-2">{r.shares}</td>
                        <td className="py-2">
                          {r.currency === "USD" ? "$" : "¥"}
                          {formatNumber(r.avg, 2)}
                        </td>
                        <td className="py-2">
                          {r.price ? (
                            <>
                              {r.currency === "USD" ? "$" : "¥"}
                              {formatNumber(r.price, 2)}
                            </>
                          ) : (
                            <span className="text-xs text-zinc-500">暂无</span>
                          )}
                        </td>
                        <td className="py-2">{formatMoney(r.valueUsd, "USD")}</td>
                        <td className={`py-2 font-medium ${pnlColor}`}>
                          {formatMoney(r.pnlUsd, "USD")}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-black/10 bg-white p-5 dark:border-white/10 dark:bg-black">
        <div className="text-sm font-medium">最近交易（最多 10 条）</div>
        <div className="mt-3 space-y-2 text-sm">
          {state.trades.slice(0, 10).length === 0 ? (
            <div className="text-zinc-500">暂无交易</div>
          ) : (
            state.trades.slice(0, 10).map((t) => {
              const info = getSymbolInfo(t.symbol);
              return (
                <div
                  key={t.id}
                  className="flex flex-wrap items-center justify-between gap-2 border-b border-black/5 pb-2 dark:border-white/5"
                >
                  <div className="min-w-[240px]">
                    <div className="text-xs text-zinc-500">{new Date(t.ts).toLocaleString()}</div>
                    <div className="font-medium">
                      {t.side === "BUY" ? "买入" : "卖出"} {t.symbol}{" "}
                      <span className="text-xs text-zinc-500">{info?.name ?? ""}</span>
                    </div>
                  </div>
                  <div className="text-xs text-zinc-500">
                    {t.shares} 股 × {t.currency === "USD" ? "$" : "¥"}
                    {formatNumber(t.price, 2)}
                  </div>
                  <div className="font-semibold">{formatMoney(t.amountUsd, "USD")}</div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

