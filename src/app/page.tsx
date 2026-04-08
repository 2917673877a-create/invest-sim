"use client";

import Link from "next/link";
import { SYMBOLS } from "@/lib/symbols";
import { formatMoney, formatNumber } from "@/lib/format";
import { useApp } from "./providers";
import { HomeSummaryCard } from "@/components/HomeSummaryCard";

export default function Home() {
  const { state, setInitialCash, resetAll, refreshQuotes, setMarketMode, setAutoTick } = useApp();
  const hasInit = state.initialCash !== null;
  const totalPositionsValue = Object.values(state.positions).reduce((sum, p) => {
    const q = state.market.quotes[p.symbol]?.price ?? 0;
    return sum + p.shares * q;
  }, 0);
  const total = state.cash + totalPositionsValue;

  const latestQuoteTs = state.market.lastRefreshTs ?? null;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10">
      <div className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-black">
        <h1 className="text-2xl font-semibold tracking-tight">模拟投资</h1>
        <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          所有逻辑在前端运行，使用本地模拟数据，支持静态导出部署到 Cloudflare
          Pages。
        </p>

        <div className="mt-6">
          <HomeSummaryCard state={state} />
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          <div className="rounded-2xl border border-black/10 p-4 dark:border-white/10">
            <div className="text-sm font-medium">资金</div>
            <div className="mt-3 grid gap-2">
              <div className="flex items-baseline justify-between">
                <div className="text-xs text-zinc-500">现金</div>
                <div className="font-semibold">{formatMoney(state.cash, "USD")}</div>
              </div>
              <div className="flex items-baseline justify-between">
                <div className="text-xs text-zinc-500">持仓市值</div>
                <div className="font-semibold">{formatMoney(totalPositionsValue, "USD")}</div>
              </div>
              <div className="flex items-baseline justify-between">
                <div className="text-xs text-zinc-500">总资产</div>
                <div className="font-semibold">{formatMoney(total, "USD")}</div>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                className="rounded-lg bg-black px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
                onClick={() => {
                  const raw = prompt("请输入初始资金（USD）", hasInit ? String(state.initialCash ?? 0) : "200000");
                  if (!raw) return;
                  const amt = Number(raw);
                  if (!Number.isFinite(amt) || amt < 0) return;
                  setInitialCash(amt);
                }}
              >
                {hasInit ? "重设初始资金" : "设置初始资金"}
              </button>
              <button
                className="rounded-lg border border-black/10 px-3 py-2 text-sm hover:bg-zinc-50 dark:border-white/10 dark:hover:bg-zinc-900"
                onClick={resetAll}
              >
                清空全部数据
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-black/10 p-4 dark:border-white/10">
            <div className="text-sm font-medium">行情数据</div>
            <div className="mt-3 grid gap-2 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-zinc-600 dark:text-zinc-400">USD/CNY</span>
                <span className="text-xs text-zinc-500">
                  {state.market.fxUSDCNY ? formatNumber(state.market.fxUSDCNY, 4) : "—"}
                </span>
              </div>
              <label className="flex items-center justify-between gap-3">
                <span className="text-zinc-600 dark:text-zinc-400">数据源</span>
                <select
                  className="rounded-lg border border-black/10 bg-transparent px-2 py-1 text-sm dark:border-white/10"
                  value={state.market.mode}
                  onChange={(e) => setMarketMode(e.target.value as any)}
                >
                  <option value="stooq+sim">Stooq 拉取 + 模拟波动</option>
                  <option value="sim">纯模拟</option>
                </select>
              </label>
              <label className="flex items-center justify-between gap-3">
                <span className="text-zinc-600 dark:text-zinc-400">自动更新</span>
                <input
                  type="checkbox"
                  checked={state.market.autoTick}
                  onChange={(e) => setAutoTick(e.target.checked)}
                />
              </label>
              <div className="flex items-center justify-between gap-3">
                <span className="text-zinc-600 dark:text-zinc-400">最近更新</span>
                <span className="text-xs text-zinc-500">
                  {latestQuoteTs ? new Date(latestQuoteTs).toLocaleString() : "未更新"}
                </span>
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <button
                className="rounded-lg border border-black/10 px-3 py-2 text-sm hover:bg-zinc-50 dark:border-white/10 dark:hover:bg-zinc-900"
                onClick={refreshQuotes}
              >
                手动刷新
              </button>
            </div>
            <p className="mt-3 text-xs leading-5 text-zinc-500">
              说明：公开数据源在前端可能受网络/CORS 影响；如果拉取失败会自动使用模拟行情继续运行。
            </p>
          </div>

          <div className="rounded-2xl border border-black/10 p-4 dark:border-white/10">
            <div className="text-sm font-medium">模拟标的</div>
            <div className="mt-3 grid gap-2">
              {SYMBOLS.map((s) => {
                const q = state.market.quotes[s.symbol]?.price;
                return (
                  <div key={s.symbol} className="flex items-baseline justify-between">
                    <div>
                      <div className="text-sm font-medium">{s.symbol}</div>
                      <div className="text-xs text-zinc-500">{s.name}</div>
                    </div>
                    <div className="text-sm">
                      {q ? `$${formatNumber(q, 2)}` : <span className="text-xs text-zinc-500">暂无</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <Link
            href="/trade"
            className="rounded-xl border border-black/10 bg-zinc-50 px-4 py-4 text-sm hover:bg-zinc-100 dark:border-white/10 dark:bg-zinc-950 dark:hover:bg-zinc-900"
          >
            <div className="font-medium">去交易页</div>
            <div className="mt-1 text-zinc-600 dark:text-zinc-400">
              模拟买入/卖出（后续会接入本地状态与交易记录）
            </div>
          </Link>
          <Link
            href="/portfolio"
            className="rounded-xl border border-black/10 bg-zinc-50 px-4 py-4 text-sm hover:bg-zinc-100 dark:border-white/10 dark:bg-zinc-950 dark:hover:bg-zinc-900"
          >
            <div className="font-medium">去资产页</div>
            <div className="mt-1 text-zinc-600 dark:text-zinc-400">
              查看现金、持仓与总资产（后续会联动本地模拟数据）
            </div>
          </Link>
        </div>

        <div className="mt-6 rounded-xl border border-black/10 p-4 text-sm dark:border-white/10">
          <div className="font-medium">提示</div>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-zinc-700 dark:text-zinc-300">
            <li>先点“手动刷新”获得初始报价（或开启自动更新让它自动波动）。</li>
            <li>交易页会按当前报价计算买入/卖出与资产变化。</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
