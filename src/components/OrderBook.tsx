"use client";

import type { OrderBook } from "@/lib/types";
import { formatNumber } from "@/lib/format";

export function OrderBookView(props: {
  currencySymbol: "$" | "¥";
  book?: OrderBook | null;
}) {
  const bids = props.book?.bids ?? [];
  const asks = props.book?.asks ?? [];

  return (
    <div className="rounded-2xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-black">
      <div className="flex items-baseline justify-between">
        <div className="text-sm font-medium">十档盘口（模拟）</div>
        <div className="text-xs text-zinc-500">
          {props.book?.asOf ? new Date(props.book.asOf).toLocaleTimeString() : "—"}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-4 text-sm">
        <div>
          <div className="mb-2 text-xs text-zinc-500">卖盘</div>
          <div className="space-y-1">
            {asks.slice().reverse().map((l, idx) => (
              <div key={idx} className="flex items-center justify-between">
                <span className="text-rose-700 dark:text-rose-300">
                  {props.currencySymbol}
                  {formatNumber(l.price, 3)}
                </span>
                <span className="text-xs text-zinc-500">{formatNumber(l.size, 0)}</span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <div className="mb-2 text-xs text-zinc-500">买盘</div>
          <div className="space-y-1">
            {bids.map((l, idx) => (
              <div key={idx} className="flex items-center justify-between">
                <span className="text-emerald-700 dark:text-emerald-300">
                  {props.currencySymbol}
                  {formatNumber(l.price, 3)}
                </span>
                <span className="text-xs text-zinc-500">{formatNumber(l.size, 0)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

