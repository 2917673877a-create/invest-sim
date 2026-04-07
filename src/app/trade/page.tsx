"use client";

import { useMemo, useState } from "react";
import { useApp } from "@/app/providers";
import { SYMBOLS, getSymbolInfo } from "@/lib/symbols";
import { formatMoney, formatNumber } from "@/lib/format";
import { IntradayChart } from "@/components/IntradayChart";
import { OrderBookView } from "@/components/OrderBook";

export default function TradePage() {
  const { state, buy, sell, refreshQuotes } = useApp();
  const [symbol, setSymbol] = useState(SYMBOLS[0]?.symbol ?? "AAPL");
  const [sharesInput, setSharesInput] = useState(String(SYMBOLS[0]?.lotSize ?? 1));

  const price = state.market.quotes[symbol]?.price ?? null;
  const position = state.positions[symbol];
  const info = getSymbolInfo(symbol);
  const currency = info?.currency ?? "USD";
  const lotSize = info?.lotSize ?? 1;
  const currencySymbol = currency === "USD" ? "$" : "¥";
  const series = state.market.intraday?.[symbol] ?? [];
  const book = state.market.orderBooks?.[symbol] ?? null;
  const meta = state.market.intradayMeta?.[symbol] ?? null;

  const canTrade = state.initialCash !== null;
  const maxBuyShares = useMemo(() => {
    if (!price || price <= 0) return 0;
    if (currency === "USD") return Math.floor(state.cash / price);
    const fx = Math.max(0.0001, state.market.fxUSDCNY);
    return Math.floor((state.cash * fx) / price);
  }, [price, state.cash, currency, state.market.fxUSDCNY]);

  const stepShares = lotSize;
  const parsedShares = Number.parseInt(sharesInput, 10);
  const normShares = Number.isFinite(parsedShares)
    ? Math.max(stepShares, Math.floor(parsedShares / stepShares) * stepShares)
    : stepShares;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10">
      <h1 className="text-xl font-semibold tracking-tight">交易</h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        按当前报价模拟买入/卖出。所有数据保存在浏览器本地（localStorage），适合静态部署。
      </p>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <IntradayChart
            title={`${symbol} · ${info?.name ?? ""}`}
            currencySymbol={currencySymbol}
            series={series}
            meta={meta}
            market={info?.market ?? "US"}
          />
        </div>
        <div>
          <OrderBookView currencySymbol={currencySymbol} book={book} />
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-black/10 bg-white p-5 dark:border-white/10 dark:bg-black">
          <div className="text-sm font-medium">账户概览</div>
          <div className="mt-3 space-y-2 text-sm">
            <div className="flex items-baseline justify-between">
              <span className="text-zinc-600 dark:text-zinc-400">现金</span>
              <span className="font-semibold">{formatMoney(state.cash, "USD")}</span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-zinc-600 dark:text-zinc-400">交易笔数</span>
              <span className="font-semibold">{state.trades.length}</span>
            </div>
          </div>
          <div className="mt-4">
            <button
              className="rounded-lg border border-black/10 px-3 py-2 text-sm hover:bg-zinc-50 dark:border-white/10 dark:hover:bg-zinc-900"
              onClick={refreshQuotes}
            >
              刷新报价
            </button>
          </div>
          {!canTrade ? (
            <p className="mt-3 text-xs leading-5 text-amber-700 dark:text-amber-300">
              你还没有设置初始资金。请先回到首页设置初始资金。
            </p>
          ) : null}
        </div>

        <div className="rounded-2xl border border-black/10 bg-white p-5 dark:border-white/10 dark:bg-black lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-medium">下单</div>
              <div className="mt-1 text-xs text-zinc-500">
                当前价：
                {price
                  ? `${currency === "USD" ? "$" : "¥"}${formatNumber(price, 2)}`
                  : "暂无（先刷新/等待自动更新）"}
              </div>
            </div>
            <div className="text-xs text-zinc-500">
              持仓：
              {position
                ? `${position.shares} 股（均价 ${currency === "USD" ? "$" : "¥"}${formatNumber(
                    position.avgCost,
                    2
                  )}）`
                : "无"}
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <label className="grid gap-1 text-sm">
              <span className="text-xs text-zinc-600 dark:text-zinc-400">标的</span>
              <select
                className="rounded-lg border border-black/10 bg-transparent px-2 py-2 text-sm dark:border-white/10"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
              >
                {SYMBOLS.map((s) => (
                  <option key={s.symbol} value={s.symbol}>
                    {s.symbol} - {s.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm">
              <span className="text-xs text-zinc-600 dark:text-zinc-400">股数</span>
              <input
                className="rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm dark:border-white/10"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder={String(stepShares)}
                value={sharesInput}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === "") {
                    setSharesInput("");
                    return;
                  }
                  if (/^\d+$/.test(v)) setSharesInput(v);
                }}
                onBlur={() => {
                  const n = Number.parseInt(sharesInput || String(stepShares), 10);
                  const normalized = Number.isFinite(n)
                    ? Math.max(stepShares, Math.floor(n / stepShares) * stepShares)
                    : stepShares;
                  setSharesInput(String(normalized));
                }}
              />
              <span className="text-[11px] text-zinc-500">
                {lotSize > 1 ? `最小单位：${lotSize} 股；` : null}
                最大可买：{maxBuyShares} 股
              </span>
            </label>
            <div className="grid gap-2">
              <button
                className="rounded-lg bg-black px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
                disabled={!canTrade || !price || normShares <= 0 || normShares > maxBuyShares}
                onClick={() => {
                  setSharesInput(String(normShares));
                  const r = buy(symbol, normShares);
                  if (!r.ok && r.error) alert(r.error);
                }}
              >
                买入
              </button>
              <button
                className="rounded-lg border border-black/10 px-3 py-2 text-sm hover:bg-zinc-50 disabled:opacity-50 dark:border-white/10 dark:hover:bg-zinc-900"
                disabled={!canTrade || !price || !position || normShares <= 0 || normShares > position.shares}
                onClick={() => {
                  setSharesInput(String(normShares));
                  const r = sell(symbol, normShares);
                  if (!r.ok && r.error) alert(r.error);
                }}
              >
                卖出
              </button>
            </div>
          </div>

          <div className="mt-6 border-t border-black/10 pt-4 text-sm dark:border-white/10">
            <div className="flex items-baseline justify-between">
              <span className="text-zinc-600 dark:text-zinc-400">预计金额</span>
              <span className="font-semibold">
                {price
                  ? currency === "USD"
                    ? formatMoney(price * normShares, "USD")
                    : `${formatMoney((price * normShares) / Math.max(0.0001, state.market.fxUSDCNY), "USD")}（约 ¥${formatNumber(
                        price * normShares,
                        2
                      )}）`
                  : "—"}
              </span>
            </div>
            <div className="mt-2 text-xs text-zinc-500">
              说明：已加入简化的手续费与滑点（更贴近真实市场）。
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-black/10 bg-white p-5 dark:border-white/10 dark:bg-black">
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium">交易历史</div>
          <div className="text-xs text-zinc-500">仅保存在本机浏览器</div>
        </div>

        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-zinc-500">
              <tr className="border-b border-black/10 dark:border-white/10">
                <th className="py-2">时间</th>
                <th className="py-2">标的</th>
                <th className="py-2">方向</th>
                <th className="py-2">股数</th>
                <th className="py-2">成交价</th>
                <th className="py-2">金额</th>
              </tr>
            </thead>
            <tbody>
              {state.trades.length === 0 ? (
                <tr>
                  <td className="py-3 text-zinc-500" colSpan={6}>
                    暂无交易
                  </td>
                </tr>
              ) : (
                state.trades.slice(0, 30).map((t) => {
                  const info = getSymbolInfo(t.symbol);
                  return (
                    <tr key={t.id} className="border-b border-black/5 dark:border-white/5">
                      <td className="py-2 text-xs text-zinc-500">
                        {new Date(t.ts).toLocaleString()}
                      </td>
                      <td className="py-2">
                        <div className="font-medium">{t.symbol}</div>
                        <div className="text-xs text-zinc-500">{info?.name ?? ""}</div>
                      </td>
                      <td className="py-2">
                        <span
                          className={
                            t.side === "BUY"
                              ? "rounded-md bg-emerald-50 px-2 py-1 text-xs text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                              : "rounded-md bg-rose-50 px-2 py-1 text-xs text-rose-700 dark:bg-rose-950 dark:text-rose-300"
                          }
                        >
                          {t.side === "BUY" ? "买入" : "卖出"}
                        </span>
                      </td>
                      <td className="py-2">{t.shares}</td>
                      <td className="py-2">
                        {t.currency === "USD" ? "$" : "¥"}
                        {formatNumber(t.price, 2)}
                      </td>
                      <td className="py-2">
                        {formatMoney(t.amountUsd, "USD")}
                        <div className="text-[11px] text-zinc-500">费 {formatMoney(t.feeUsd, "USD")}</div>
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
  );
}

