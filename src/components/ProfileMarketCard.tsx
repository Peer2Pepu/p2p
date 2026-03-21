"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useReadContract } from "wagmi";
import { formatEther } from "viem";
import type { UserMarketData } from "@/types/profile";
import { ZERO_ADDRESS, safeAddressLower, isEmptyOnChainMarketSlot } from "@/lib/evmAddress";

const MARKET_MANAGER_ABI = [
  {
    inputs: [{ name: "marketId", type: "uint256" }],
    name: "getMarket",
    outputs: [
      {
        components: [
          { name: "creator", type: "address" },
          { name: "ipfsHash", type: "string" },
          { name: "isMultiOption", type: "bool" },
          { name: "maxOptions", type: "uint256" },
          { name: "paymentToken", type: "address" },
          { name: "minStake", type: "uint256" },
          { name: "creatorDeposit", type: "uint256" },
          { name: "creatorOutcome", type: "uint256" },
          { name: "startTime", type: "uint256" },
          { name: "stakeEndTime", type: "uint256" },
          { name: "endTime", type: "uint256" },
          { name: "resolutionEndTime", type: "uint256" },
          { name: "state", type: "uint8" },
          { name: "winningOption", type: "uint256" },
          { name: "isResolved", type: "bool" },
          { name: "resolvedTimestamp", type: "uint256" },
          { name: "marketType", type: "uint8" },
          { name: "priceFeed", type: "address" },
          { name: "priceThreshold", type: "uint256" },
          { name: "resolvedPrice", type: "uint256" },
        ],
        name: "",
        type: "tuple",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { name: "marketId", type: "uint256" },
      { name: "token", type: "address" },
    ],
    name: "getTotalPool",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "marketId", type: "uint256" }],
    name: "getStakerCount",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { name: "marketId", type: "uint256" },
      { name: "option", type: "uint256" },
      { name: "token", type: "address" },
    ],
    name: "getOptionPool",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

export function ProfileMarketCard({
  marketId,
  marketData,
  isDarkMode,
}: {
  marketId: string;
  marketData: UserMarketData;
  isDarkMode: boolean;
}) {
  const MARKET_MANAGER_ADDRESS = (process.env.NEXT_PUBLIC_P2P_MARKET_MANAGER_ADDRESS ||
    process.env.NEXT_PUBLIC_P2P_MARKETMANAGER_ADDRESS) as `0x${string}`;

  const marketIdNum = Number.parseInt(String(marketId), 10);
  const idValid = Number.isFinite(marketIdNum) && marketIdNum >= 0;

  const [marketMetadata, setMarketMetadata] = useState<Record<string, unknown> | null>(null);
  const [loadingMetadata, setLoadingMetadata] = useState(false);

  const { data: market, isSuccess: marketQuerySuccess } = useReadContract({
    address: MARKET_MANAGER_ADDRESS,
    abi: MARKET_MANAGER_ABI,
    functionName: "getMarket",
    args: idValid ? [BigInt(marketIdNum)] : undefined,
    query: {
      enabled: idValid && !!MARKET_MANAGER_ADDRESS,
      refetchInterval: 10000,
    },
  });

  const paymentTokenAddr = safeAddressLower(
    (market as { paymentToken?: unknown } | undefined)?.paymentToken ??
      (market as unknown[] | undefined)?.[4]
  ) as `0x${string}` | undefined;

  const onChainMissing = marketQuerySuccess && isEmptyOnChainMarketSlot(market);

  const { data: totalPool } = useReadContract({
    address: MARKET_MANAGER_ADDRESS,
    abi: MARKET_MANAGER_ABI,
    functionName: "getTotalPool",
    args: idValid && paymentTokenAddr ? [BigInt(marketIdNum), paymentTokenAddr] : undefined,
    query: {
      enabled:
        idValid &&
        !!paymentTokenAddr &&
        !!MARKET_MANAGER_ADDRESS &&
        !onChainMissing,
      refetchInterval: 10000,
    },
  });

  const { data: stakerCount } = useReadContract({
    address: MARKET_MANAGER_ADDRESS,
    abi: MARKET_MANAGER_ABI,
    functionName: "getStakerCount",
    args: idValid ? [BigInt(marketIdNum)] : undefined,
    query: {
      enabled: idValid && !!MARKET_MANAGER_ADDRESS && !onChainMissing,
      refetchInterval: 10000,
    },
  });

  const { data: option1Pool } = useReadContract({
    address: MARKET_MANAGER_ADDRESS,
    abi: MARKET_MANAGER_ABI,
    functionName: "getOptionPool",
    args: idValid && paymentTokenAddr ? [BigInt(marketIdNum), BigInt(1), paymentTokenAddr] : undefined,
    query: {
      enabled:
        idValid &&
        !!paymentTokenAddr &&
        !!MARKET_MANAGER_ADDRESS &&
        !onChainMissing,
      refetchInterval: 10000,
    },
  });

  const { data: option2Pool } = useReadContract({
    address: MARKET_MANAGER_ADDRESS,
    abi: MARKET_MANAGER_ABI,
    functionName: "getOptionPool",
    args: idValid && paymentTokenAddr ? [BigInt(marketIdNum), BigInt(2), paymentTokenAddr] : undefined,
    query: {
      enabled:
        idValid &&
        !!paymentTokenAddr &&
        !!MARKET_MANAGER_ADDRESS &&
        !onChainMissing,
      refetchInterval: 10000,
    },
  });

  const marketState = onChainMissing
    ? -1
    : market
      ? Number((market as { state?: unknown }).state)
      : marketData.state;

  const isERC20Market = !!paymentTokenAddr && paymentTokenAddr !== ZERO_ADDRESS;

  useEffect(() => {
    if (!market || onChainMissing || marketMetadata || loadingMetadata) return;

    setLoadingMetadata(true);
    const fetchMetadata = async () => {
      try {
        const ipfsHash = (market as { ipfsHash?: string }).ipfsHash;
        if (ipfsHash) {
          const { fetchIPFSData } = await import("@/lib/ipfs");
          const metadata = await fetchIPFSData(ipfsHash);
          if (metadata) setMarketMetadata(metadata as Record<string, unknown>);
        }
      } catch (error) {
        console.error("Error fetching IPFS metadata:", error);
      } finally {
        setLoadingMetadata(false);
      }
    };

    void fetchMetadata();
  }, [market, onChainMissing, marketMetadata, loadingMetadata]);

  const getMarketTitle = () => {
    if (loadingMetadata) return "Loading...";
    const metaTitle = marketMetadata?.title;
    if (typeof metaTitle === "string" && metaTitle.trim()) return metaTitle;
    return marketData.title || `Market #${marketId}`;
  };

  const getMarketDescription = () => {
    if (loadingMetadata) return null;
    const d = marketMetadata?.description;
    if (typeof d === "string" && d.trim()) return d;
    return marketData.description || null;
  };

  const getMarketImage = () => {
    if (loadingMetadata) return null;
    const u = marketMetadata?.imageUrl;
    if (typeof u === "string" && u.trim()) return u;
    return marketData.image || null;
  };

  const titleEl = (
    <span
      className={`font-semibold text-sm sm:text-base ${!onChainMissing ? "hover:underline" : ""} ${isDarkMode ? "text-white" : "text-gray-900"}`}
    >
      {getMarketTitle()}
    </span>
  );

  const statusBadge = (() => {
    if (onChainMissing) {
      return (
        <span
          className={`text-xs font-medium px-2 py-0.5 rounded flex-shrink-0 ${
            isDarkMode ? "bg-white/10 text-white/70" : "bg-gray-200 text-gray-600"
          }`}
        >
          Unavailable
        </span>
      );
    }
    return (
      <span
        className={`text-xs font-medium px-2 py-0.5 rounded flex-shrink-0 ${
          marketState === 0
            ? isDarkMode
              ? "bg-yellow-900/30 text-yellow-400"
              : "bg-yellow-100 text-yellow-700"
            : marketState === 1
              ? isDarkMode
                ? "bg-green-900/30 text-green-400"
                : "bg-green-100 text-green-700"
              : isDarkMode
                ? "bg-blue-900/30 text-blue-400"
                : "bg-blue-100 text-blue-700"
        }`}
      >
        {marketState === 0 ? "Active" : marketState === 1 ? "Ended" : "Resolved"}
      </span>
    );
  })();

  return (
    <div
      className={`block py-4 sm:py-5 border-b last:border-b-0 transition-colors ${
        isDarkMode ? "border-white/10" : "border-gray-300"
      }`}
    >
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        {getMarketImage() && (
          <img
            src={getMarketImage()!}
            alt="Market"
            className={`w-full sm:w-20 sm:h-20 h-40 sm:h-20 rounded-lg object-cover flex-shrink-0 ${
              isDarkMode ? "ring-1 ring-white/10" : "ring-1 ring-gray-200"
            }`}
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
        )}
        <div className="flex-1 min-w-0 w-full sm:w-auto">
          <div className="flex items-start justify-between gap-2 mb-1.5">
            {onChainMissing ? (
              titleEl
            ) : (
              <Link href={`/market/${marketId}`}>{titleEl}</Link>
            )}
            {statusBadge}
          </div>
          {onChainMissing && (
            <p
              className={`text-xs sm:text-sm mb-2 ${isDarkMode ? "text-amber-200/90" : "text-amber-800"}`}
            >
              This ID is not deployed on the connected network (stale database row or wrong chain). The
              market page will be empty or 404.
            </p>
          )}
          {getMarketDescription() && (
            <p
              className={`text-xs sm:text-sm mb-2 line-clamp-2 ${isDarkMode ? "text-white/70" : "text-gray-600"}`}
            >
              {getMarketDescription()}
            </p>
          )}
          <div
            className={`flex flex-wrap items-center gap-2 sm:gap-3 text-xs ${isDarkMode ? "text-white/60" : "text-gray-500"}`}
          >
            <span className={`px-2 py-0.5 rounded ${isDarkMode ? "bg-gray-800" : "bg-gray-100"}`}>
              {marketData.type}
            </span>
            {!onChainMissing && totalPool !== undefined && (
              <span className={isDarkMode ? "text-white/70" : "text-gray-600"}>
                Volume: {Number(formatEther(totalPool)).toFixed(2)}{" "}
                {isERC20Market ? "Tokens" : "PEPU"}
              </span>
            )}
            {!onChainMissing && stakerCount !== undefined && (
              <span className={isDarkMode ? "text-white/70" : "text-gray-600"}>
                Stakers: {Number(stakerCount)}
              </span>
            )}
            {!onChainMissing && option1Pool !== undefined && option2Pool !== undefined && (
              <span className={isDarkMode ? "text-white/70" : "text-gray-600"}>
                Pools: {Number(formatEther(option1Pool)).toFixed(2)} /{" "}
                {Number(formatEther(option2Pool)).toFixed(2)}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
