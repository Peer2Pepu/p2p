"use client";

import { formatEther } from "viem";
import type { UserAnalytics } from "@/types/profile";

function fmtToken(wei: bigint): string {
  const s = formatEther(wei);
  const n = Number(s);
  if (!Number.isFinite(n)) return "0";
  if (n === 0) return "0";
  if (Math.abs(n) < 1e-12) return "0";
  if (Math.abs(n) < 0.0001) return n.toExponential(2);
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 10_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toLocaleString(undefined, {
    maximumFractionDigits: 4,
    minimumFractionDigits: 0,
  });
}

/** Compact on-chain stats — plain text, no icons. */
export function ProfileTradingAnalytics({
  isDarkMode,
  analytics,
  winRatePercent,
  className = "",
}: {
  isDarkMode: boolean;
  analytics: UserAnalytics;
  winRatePercent: number;
  className?: string;
}) {
  const d = isDarkMode;
  const box = d
    ? "rounded-md border border-white/10 bg-black/20 transition-all duration-200 ease-out hover:border-[#39FF14]/55 hover:bg-[#39FF14]/[0.07] hover:shadow-[0_0_20px_-4px_rgba(57,255,20,0.35)]"
    : "rounded-md border border-gray-200 bg-white transition-all duration-200 ease-out hover:border-[#39FF14]/70 hover:bg-[#39FF14]/[0.08] hover:shadow-[0_0_20px_-4px_rgba(57,255,20,0.28)]";
  const label = d ? "text-white/45" : "text-gray-500";
  const value = d ? "text-white/90" : "text-gray-900";
  const sep = d ? "text-white/20" : "text-gray-300";

  return (
    <div className={`group/stats mt-3 w-full max-w-xl ${className}`}>
      <p
        className={`mb-1 text-[10px] font-medium uppercase tracking-wider transition-colors duration-200 ${label} group-hover/stats:text-[#39FF14]/80`}
      >
        On-chain stats
      </p>
      <div className={`${box} px-3 py-2`}>
        <div
          className={`flex flex-wrap items-baseline justify-center gap-x-1.5 gap-y-0.5 text-xs sm:justify-start sm:text-[13px] ${value}`}
        >
          <span className={label}>Win rate</span>
          <span className="font-medium tabular-nums">
            {Math.round(winRatePercent)}%
          </span>
          <span className={`mx-0.5 ${sep}`} aria-hidden>
            ·
          </span>
          <span className={label}>Stakes</span>
          <span className="font-medium tabular-nums">
            {analytics.totalStakesPlaced.toString()}
          </span>
          <span className={`mx-0.5 ${sep}`} aria-hidden>
            ·
          </span>
          <span className={label}>Markets</span>
          <span className="font-medium tabular-nums">
            {analytics.marketsCreated.toString()}
          </span>
        </div>
        <div
          className={`mt-2 flex flex-wrap items-baseline justify-center gap-x-1.5 gap-y-0.5 border-t pt-2 text-[11px] transition-colors duration-200 sm:justify-start sm:text-xs ${d ? "border-white/10 group-hover/stats:border-[#39FF14]/25" : "border-gray-100 group-hover/stats:border-[#39FF14]/30"} ${value}`}
        >
          <span className={label}>PEPU</span>
          <span className="font-mono tabular-nums">
            {fmtToken(analytics.totalWinningsNative)}
          </span>
          <span className={label}>
            ({analytics.totalStakesWonNative.toString()} wins)
          </span>
          <span className={`mx-0.5 ${sep}`} aria-hidden>
            ·
          </span>
          <span className={label}>P2P</span>
          <span className="font-mono tabular-nums">
            {fmtToken(analytics.totalWinningsP2PToken)}
          </span>
          <span className={label}>
            ({analytics.totalStakesWonP2PToken.toString()} wins)
          </span>
        </div>
      </div>
    </div>
  );
}
