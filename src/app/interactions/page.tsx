 "use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Menu, Moon, Sun, Lock, Wallet, AlertTriangle, CheckCircle } from "lucide-react";
import { HeaderWallet } from "@/components/HeaderWallet";
import { Sidebar } from "../components/Sidebar";
import { useTheme } from "../context/ThemeContext";
import { useAccount, useBalance, useReadContract, useWriteContract, useWaitForTransactionReceipt, useChainId } from "wagmi";
import { formatUnits, parseUnits } from "viem";

// ─── Minimal ABIs ─────────────────────────────────────────────────────────────
const MARKET_MANAGER_ABI = [
  {
    inputs: [],
    name: "optimisticOracle",
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "defaultBondCurrency",
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

const ORACLE_ABI = [
  {
    inputs: [],
    name: "voting",
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

const ERC20_ABI = [
  {
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    name: "allowance",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    name: "approve",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "decimals",
    outputs: [{ name: "", type: "uint8" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "symbol",
    outputs: [{ name: "", type: "string" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

const VOTING_ABI = [
  {
    inputs: [{ name: "voter", type: "address" }],
    name: "stakedBalance",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "voter", type: "address" }],
    name: "lockedStake",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "amount", type: "uint256" }],
    name: "stake",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ name: "amount", type: "uint256" }],
    name: "unstake",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

type PendingAction =
  | "stake"
  | "unstake"
  | "approve-market"
  | "approve-voting";

export default function InteractionsPage() {
  const { isDarkMode, toggleTheme } = useTheme();
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const dark = (darkClass: string, lightClass: string) => (isDarkMode ? darkClass : lightClass);
  const cls = (...args: Array<string | false | undefined>) => args.filter(Boolean).join(" ");

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);

  const [activeTab, setActiveTab] = useState<"stake" | "approvals">("stake");
  const [activeApprovalTab, setActiveApprovalTab] = useState<"market" | "voting">("market");

  const MARKET_MANAGER_ADDRESS = (process.env
    .NEXT_PUBLIC_P2P_MARKET_MANAGER_ADDRESS ||
    process.env.NEXT_PUBLIC_P2P_MARKETMANAGER_ADDRESS) as `0x${string}` | undefined;

  const { writeContract, data: writeHash } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash: writeHash,
  });

  // ─── Resolve addresses ─────────────────────────────────────────────────────
  const { data: oracleAddress, refetch: refetchOracleAddress } = useReadContract({
    address: MARKET_MANAGER_ADDRESS,
    abi: MARKET_MANAGER_ABI,
    functionName: "optimisticOracle",
    query: { enabled: !!MARKET_MANAGER_ADDRESS },
  });

  const { data: bondCurrency, refetch: refetchBondCurrency } = useReadContract({
    address: MARKET_MANAGER_ADDRESS,
    abi: MARKET_MANAGER_ABI,
    functionName: "defaultBondCurrency",
    query: { enabled: !!MARKET_MANAGER_ADDRESS },
  });

  const { data: votingContractAddress, refetch: refetchVotingContractAddress } = useReadContract({
    address: oracleAddress as `0x${string}` | undefined,
    abi: ORACLE_ABI,
    functionName: "voting",
    query: { enabled: !!oracleAddress },
  });

  const erc20Enabled = !!bondCurrency;

  const { data: tokenDecimalsData } = useReadContract({
    address: bondCurrency as `0x${string}` | undefined,
    abi: ERC20_ABI,
    functionName: "decimals",
    query: { enabled: erc20Enabled },
  });

  const tokenDecimals = typeof tokenDecimalsData === "bigint"
    ? Number(tokenDecimalsData)
    : typeof tokenDecimalsData === "number"
      ? tokenDecimalsData
      : 18;

  const { data: tokenSymbolData } = useReadContract({
    address: bondCurrency as `0x${string}` | undefined,
    abi: ERC20_ABI,
    functionName: "symbol",
    query: { enabled: erc20Enabled },
  });

  // Hardcode the display symbol to P2P even if the on-chain symbol differs (e.g. "SPRING").
  const tokenSymbol = "P2P";

  const formatTokenAmount = (amount: bigint, maxFractionDigits = 4) => {
    const s = formatUnits(amount, tokenDecimals);
    const [intRaw, fracRaw = ""] = s.split(".");
    const intGrouped = intRaw.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    const fracTrimmed = fracRaw ? fracRaw.slice(0, maxFractionDigits).replace(/0+$/, "") : "";
    return fracTrimmed ? `${intGrouped}.${fracTrimmed}` : intGrouped;
  };

  // ─── Voting stake ──────────────────────────────────────────────────────────
  const votingEnabled = !!votingContractAddress && !!address;

  const { data: stakedBalanceData, refetch: refetchStakedBalance } = useReadContract({
    address: votingContractAddress as `0x${string}` | undefined,
    abi: VOTING_ABI,
    functionName: "stakedBalance",
    args: address ? [address] : undefined,
    query: { enabled: votingEnabled },
  });

  const { data: lockedStakeData, refetch: refetchLockedStake } = useReadContract({
    address: votingContractAddress as `0x${string}` | undefined,
    abi: VOTING_ABI,
    functionName: "lockedStake",
    args: address ? [address] : undefined,
    query: { enabled: votingEnabled },
  });

  const stakedBalance = (stakedBalanceData as bigint | undefined) || BigInt(0);
  const lockedStake = (lockedStakeData as bigint | undefined) || BigInt(0);
  const availableToUnstake = stakedBalance > lockedStake ? stakedBalance - lockedStake : BigInt(0);

  // ─── Allowances ────────────────────────────────────────────────────────────
  const allowEnabled = erc20Enabled && !!address && !!MARKET_MANAGER_ADDRESS && !!votingContractAddress;

  const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
  const isNativeBond = !bondCurrency || bondCurrency === ZERO_ADDRESS;
  const { data: walletBalanceData } = useBalance({
    address,
    chainId,
    token: isNativeBond ? undefined : (bondCurrency as `0x${string}`),
    query: { enabled: !!address && !!chainId && !!bondCurrency },
  });

  const { data: allowanceMarketManagerData, refetch: refetchAllowanceMarketManager } = useReadContract({
    address: bondCurrency as `0x${string}` | undefined,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: address && MARKET_MANAGER_ADDRESS ? [address, MARKET_MANAGER_ADDRESS] : undefined,
    query: { enabled: allowEnabled },
  });

  const { data: allowanceVotingData, refetch: refetchAllowanceVoting } = useReadContract({
    address: bondCurrency as `0x${string}` | undefined,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: address && votingContractAddress ? [address, votingContractAddress] : undefined,
    query: { enabled: allowEnabled },
  });

  const allowanceMarketManager = (allowanceMarketManagerData as bigint | undefined) || BigInt(0);
  const allowanceVoting = (allowanceVotingData as bigint | undefined) || BigInt(0);

  // ─── Inputs ────────────────────────────────────────────────────────────────
  const [stakeAmount, setStakeAmount] = useState<string>(""); // tokens
  const [unstakeAmount, setUnstakeAmount] = useState<string>(""); // tokens
  const [approvalStepAmount, setApprovalStepAmount] = useState<string>("1000000"); // tokens

  const parseTokenAmountToWei = (amountStr: string): bigint | null => {
    const trimmed = amountStr.trim();
    if (!trimmed) return null;
    const num = Number(trimmed);
    if (!Number.isFinite(num) || num <= 0) return null;
    try {
      return parseUnits(trimmed, tokenDecimals);
    } catch {
      return null;
    }
  };

  const withTx = async (action: PendingAction, fn: () => Promise<void>) => {
    setError("");
    setSuccess("");
    setPendingAction(action);
    try {
      await fn();
    } catch (e: any) {
      setError(e?.message || "Transaction failed");
      setPendingAction(null);
    }
  };

  useEffect(() => {
    if (!isConfirmed || !writeHash || !pendingAction) return;

    const clearIn = 2500;
    if (pendingAction === "approve-market" || pendingAction === "approve-voting") {
      setSuccess("✅ Approval updated");
      setTimeout(() => setSuccess(""), clearIn);
      refetchAllowanceMarketManager();
      refetchAllowanceVoting();
    } else if (pendingAction === "stake") {
      setSuccess("✅ Staked in voting contract");
      setTimeout(() => setSuccess(""), clearIn);
      refetchStakedBalance();
      refetchLockedStake();
      // allowance might stay the same, but UI is okay without refetch
    } else if (pendingAction === "unstake") {
      setSuccess("✅ Unstaked from voting contract");
      setTimeout(() => setSuccess(""), clearIn);
      refetchStakedBalance();
      refetchLockedStake();
    }

    setPendingAction(null);
  }, [
    isConfirmed,
    writeHash,
    pendingAction,
    refetchAllowanceMarketManager,
    refetchAllowanceVoting,
    refetchStakedBalance,
    refetchLockedStake,
  ]);

  const isOracleConfigured = useMemo(() => {
    return !!oracleAddress && oracleAddress !== "0x0000000000000000000000000000000000000000";
  }, [oracleAddress]);

  const isBondReady = !!bondCurrency && bondCurrency !== "0x0000000000000000000000000000000000000000";
  const isVotingReady = !!votingContractAddress && votingContractAddress !== "0x0000000000000000000000000000000000000000";

  // ─── Actions ───────────────────────────────────────────────────────────────
  const handleStake = async () => {
    if (!address || !votingContractAddress || !bondCurrency || !MARKET_MANAGER_ADDRESS) return;
    const amountWei = parseTokenAmountToWei(stakeAmount);
    if (!amountWei || amountWei <= BigInt(0)) {
      setError("Enter a stake amount greater than 0");
      return;
    }
    if (allowanceVoting < amountWei) {
      setError("Voting contract allowance too low. Update approvals below.");
      return;
    }

    await withTx("stake", async () => {
      await writeContract({
        address: votingContractAddress as `0x${string}`,
        abi: VOTING_ABI,
        functionName: "stake",
        args: [amountWei],
        gas: BigInt(300_000),
      });
    });
  };

  const handleUnstake = async () => {
    if (!votingContractAddress || !bondCurrency) return;
    const amountWei = parseTokenAmountToWei(unstakeAmount);
    if (!amountWei || amountWei <= BigInt(0)) {
      setError("Enter an unstake amount greater than 0");
      return;
    }
    if (amountWei > availableToUnstake) {
      setError("Amount exceeds available to unstake (some stake is locked).");
      return;
    }

    await withTx("unstake", async () => {
      await writeContract({
        address: votingContractAddress as `0x${string}`,
        abi: VOTING_ABI,
        functionName: "unstake",
        args: [amountWei],
        gas: BigInt(250_000),
      });
    });
  };

  const handleApproveAbsolute = async (action: PendingAction, spender: `0x${string}`, newAllowance: bigint) => {
    if (!bondCurrency) return;

    await withTx(action, async () => {
      await writeContract({
        address: bondCurrency as `0x${string}`,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [spender, newAllowance],
        gas: BigInt(80_000),
      });
    });
  };

  const stepWei = parseTokenAmountToWei(approvalStepAmount) || BigInt(0);
  const unstakeWei = parseTokenAmountToWei(unstakeAmount);
  const isUnstakeTooLarge =
    unstakeWei !== null && availableToUnstake !== BigInt(0) && unstakeWei > availableToUnstake;

  const handleIncreaseMarketManager = async () => {
    if (!MARKET_MANAGER_ADDRESS) return;
    if (stepWei <= BigInt(0)) {
      setError("Set approval step amount (default is 1m).");
      return;
    }
    if (wouldExceedMarketManager) {
      setError("Max approval is 50m tokens. Reduce the step amount.");
      return;
    }
    await handleApproveAbsolute("approve-market", MARKET_MANAGER_ADDRESS, allowanceMarketManager + stepWei);
  };

  const handleDecreaseMarketManager = async () => {
    if (!MARKET_MANAGER_ADDRESS) return;
    if (stepWei <= BigInt(0)) return;
    const newAmount = allowanceMarketManager > stepWei ? allowanceMarketManager - stepWei : BigInt(0);
    await handleApproveAbsolute("approve-market", MARKET_MANAGER_ADDRESS, newAmount);
  };

  const handleResetMarketManager = async () => {
    if (!MARKET_MANAGER_ADDRESS) return;
    await handleApproveAbsolute("approve-market", MARKET_MANAGER_ADDRESS, BigInt(0));
  };

  const handleIncreaseVoting = async () => {
    if (!votingContractAddress) return;
    if (stepWei <= BigInt(0)) {
      setError("Set approval step amount (default is 1m).");
      return;
    }
    if (wouldExceedVoting) {
      setError("Max approval is 50m tokens. Reduce the step amount.");
      return;
    }
    await handleApproveAbsolute("approve-voting", votingContractAddress as `0x${string}`, allowanceVoting + stepWei);
  };

  const handleDecreaseVoting = async () => {
    if (!votingContractAddress) return;
    if (stepWei <= BigInt(0)) return;
    const newAmount = allowanceVoting > stepWei ? allowanceVoting - stepWei : BigInt(0);
    await handleApproveAbsolute("approve-voting", votingContractAddress as `0x${string}`, newAmount);
  };

  const handleResetVoting = async () => {
    if (!votingContractAddress) return;
    await handleApproveAbsolute("approve-voting", votingContractAddress as `0x${string}`, BigInt(0));
  };

  const showWalletGate = !isConnected;
  const maxApprovalWei = parseUnits("50000000", tokenDecimals);
  const wouldExceedMarketManager =
    allowanceMarketManager + stepWei > maxApprovalWei;
  const wouldExceedVoting =
    allowanceVoting + stepWei > maxApprovalWei;

  return (
    <div className={`min-h-screen ${dark("bg-black", "bg-[#F5F3F0]")}`}>
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        isDarkMode={isDarkMode}
      />

      <div className={`transition-all duration-300 ${sidebarCollapsed ? "lg:ml-16" : "lg:ml-64"}`}>
        <header
          className={`sticky top-0 z-30 border-b backdrop-blur-sm ${
            dark("bg-black border-[#39FF14]/20", "bg-[#F5F3F0] border-gray-200")
          }`}
        >
          <div className="px-4 lg:px-6 py-1.5 lg:py-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setSidebarOpen(true)}
                  className={cls("lg:hidden p-2 rounded-lg transition-colors", dark("hover:bg-[#39FF14]/10 text-white", "hover:bg-gray-200"))}
                >
                  <Menu size={20} className={dark("text-white", "text-gray-900")} />
                </button>

                <Link href="/" className="lg:hidden transition-opacity hover:opacity-80 cursor-pointer">
                  <Image src="/mobile.png" alt="P2P" width={90} height={45} className="object-contain" priority />
                </Link>

                <div className="hidden lg:block">
                  <h1 className={cls("text-2xl font-bold", dark("text-white", "text-gray-900"))}>Interactions</h1>
                  <p className={cls("text-sm", dark("text-white/70", "text-gray-600"))}>
                    Manage voting stake + contract approvals
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 lg:gap-4">
                <button
                  onClick={toggleTheme}
                  className={cls("p-1.5 lg:p-2 rounded-lg transition-colors", dark("hover:bg-[#39FF14]/10", "hover:bg-gray-200"))}
                >
                  {isDarkMode ? <Sun className="w-4 h-4 lg:w-5 lg:h-5 text-white" /> : <Moon className="w-4 h-4 lg:w-5 lg:h-5 text-gray-600" />}
                </button>
                <HeaderWallet isDarkMode={isDarkMode} />
              </div>
            </div>
          </div>
        </header>

        <main className="p-4 lg:p-6">
          {error && (
            <div className={cls("mb-4 p-4 rounded-lg border flex items-center gap-3", dark("bg-red-900/20 border-red-800 text-red-300", "bg-red-50 border-red-200 text-red-800"))}>
              <AlertTriangle size={20} className="flex-shrink-0" />
              <span className="text-sm">{error}</span>
              <button type="button" onClick={() => setError("")} className="ml-auto text-xs opacity-70 hover:opacity-100">✕</button>
            </div>
          )}
          {success && (
            <div className={cls("mb-4 p-4 rounded-lg border flex items-center gap-3", dark("bg-green-900/20 border-green-800 text-green-300", "bg-green-50 border-green-200 text-green-800"))}>
              <CheckCircle size={20} className="flex-shrink-0" />
              <span className="text-sm">{success}</span>
              <button type="button" onClick={() => setSuccess("")} className="ml-auto text-xs opacity-70 hover:opacity-100">✕</button>
            </div>
          )}

          {showWalletGate ? (
            <div className={cls("flex flex-col items-center justify-center py-16", dark("text-white/70", "text-gray-600"))}>
              <Wallet className="w-16 h-16 mb-4 opacity-60" />
              <h3 className={cls("text-xl font-semibold mb-2", dark("text-white", "text-gray-900"))}>Connect your wallet</h3>
              <p className={cls("text-sm text-center max-w-md", dark("text-white/70", "text-gray-600"))}>
                Manage voting contract stake and approvals from this page.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 max-w-2xl mx-auto w-full">
              {/* Tabs (show one section at a time) */}
              <div
                className={cls(
                  "flex gap-2 p-1 rounded-lg border",
                  dark("bg-black/40 border-gray-800", "bg-white border-gray-200")
                )}
              >
                <button
                  type="button"
                  onClick={() => setActiveTab("stake")}
                  className={cls(
                    "flex-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap",
                    activeTab === "stake"
                      ? dark("bg-[#39FF14]/10 border border-[#39FF14]/30 text-[#39FF14]", "bg-[#39FF14]/10 border border-[#39FF14]/30 text-green-900")
                      : dark("bg-transparent border border-transparent text-white/70 hover:bg-gray-800/50 hover:border-gray-700", "bg-transparent border border-transparent text-gray-600 hover:bg-gray-100/70 hover:border-gray-300")
                  )}
                >
                  Voting Stake
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("approvals")}
                  className={cls(
                    "flex-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap",
                    activeTab === "approvals"
                      ? dark("bg-[#39FF14]/10 border border-[#39FF14]/30 text-[#39FF14]", "bg-[#39FF14]/10 border border-[#39FF14]/30 text-green-900")
                      : dark("bg-transparent border border-transparent text-white/70 hover:bg-gray-800/50 hover:border-gray-700", "bg-transparent border border-transparent text-gray-600 hover:bg-gray-100/70 hover:border-gray-300")
                  )}
                >
                  Approvals
                </button>
              </div>

              {/* Voting contract stake */}
              {activeTab === "stake" && (
                <div className="w-full">
                <div className="flex items-center gap-2 mb-3">
                  <Lock size={18} className={dark("text-[#39FF14]", "text-emerald-600")} />
                  <h2 className={cls("text-lg sm:text-xl font-semibold", dark("text-white", "text-gray-900"))}>Voting Contract</h2>
                </div>

                {!isOracleConfigured || !isBondReady || !isVotingReady ? (
                  <div className={cls("text-xs p-3 rounded border", dark("bg-yellow-900/20 border-yellow-800 text-yellow-300", "bg-yellow-50 border-yellow-200 text-yellow-800"))}>
                    Oracle/contracts not fully configured yet. Try again later.
                  </div>
                ) : (
                  <>
                    <div className="space-y-2 mb-4">
                      <div className={cls("grid grid-cols-[1fr_auto] items-center gap-x-4", dark("text-white/70", "text-gray-600"))}>
                        <span className="text-[14px]">Your staked</span>
                        <span className={cls("text-[16px] font-semibold tabular-nums text-right", dark("text-white", "text-gray-900"))}>
                          {formatTokenAmount(stakedBalance)}{" "}
                          <span className={cls("text-[12px] font-semibold opacity-70 ml-1", dark("text-white", "text-gray-900"))}>{tokenSymbol}</span>
                        </span>
                      </div>
                      <div className={cls("grid grid-cols-[1fr_auto] items-center gap-x-4", dark("text-white/70", "text-gray-600"))}>
                        <span className="text-[14px]">Locked stake</span>
                        <span className={cls("text-[16px] font-semibold tabular-nums text-right", dark("text-white", "text-gray-900"))}>
                          {formatTokenAmount(lockedStake)}{" "}
                          <span className={cls("text-[12px] font-semibold opacity-70 ml-1", dark("text-white", "text-gray-900"))}>{tokenSymbol}</span>
                        </span>
                      </div>
                      <div className={cls("grid grid-cols-[1fr_auto] items-center gap-x-4", dark("text-white/70", "text-gray-600"))}>
                        <span className="text-[14px]">Available to unstake</span>
                        <span className={cls("text-[16px] font-semibold tabular-nums text-right", dark("text-[#39FF14]", "text-emerald-700"))}>
                          {formatTokenAmount(availableToUnstake)}{" "}
                          <span className={cls("text-[12px] font-semibold opacity-70 ml-1", dark("text-[#39FF14]", "text-emerald-700"))}>{tokenSymbol}</span>
                        </span>
                      </div>
                    </div>

                    <div className="space-y-3">
                      {/* Stake */}
                      <div className={cls("rounded-2xl p-6", dark("bg-gray-900/30", "bg-gray-100"))}>
                        <div className={cls("text-[14px] font-semibold mb-3", dark("text-white", "text-gray-900"))}>
                          Increase stake
                        </div>
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          placeholder={`Amount (${tokenSymbol})`}
                          value={stakeAmount}
                          onChange={(e) => setStakeAmount(e.target.value)}
                          className={cls(
                            "w-full px-4 py-3 rounded-xl text-[14px] border h-12",
                            dark("bg-gray-900 border-gray-700 text-white", "bg-white border-gray-300 text-gray-900")
                          )}
                        />

                        {isConnected && walletBalanceData?.value !== undefined && (
                          <div className="mt-2 text-[13px] flex items-center justify-between">
                            <span className={dark("text-white/60", "text-gray-500")}>Balance</span>
                            <span className={cls("font-semibold tabular-nums", dark("text-white", "text-gray-900"))}>
                              {formatTokenAmount(walletBalanceData.value)} {tokenSymbol}
                            </span>
                          </div>
                        )}

                        <div className="text-[13px] mt-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-2">
                          <span className={dark("text-white/60", "text-gray-500")}>Allowance to voting contract</span>
                          <span className={cls("font-semibold tabular-nums", dark("text-white", "text-gray-900"))}>
                            {formatTokenAmount(allowanceVoting)}{" "}
                            <span className={cls("text-[12px] font-semibold opacity-70", dark("text-white", "text-gray-900"))}>{tokenSymbol}</span>
                          </span>
                        </div>

                        <button
                          type="button"
                          disabled={
                            !stakeAmount ||
                            pendingAction === "stake" ||
                            !isVotingReady ||
                            !isBondReady ||
                            (() => {
                              const wei = parseTokenAmountToWei(stakeAmount);
                              return wei === null || wei === BigInt(0) || allowanceVoting < wei;
                            })()
                          }
                          onClick={handleStake}
                          className={cls(
                            "mt-4 w-full py-3 px-4 rounded-xl text-[14px] font-medium transition-colors h-12",
                            pendingAction === "stake"
                              ? dark("bg-gray-700 text-gray-500 cursor-not-allowed", "bg-gray-200 text-gray-500 cursor-not-allowed")
                              : dark("bg-[#39FF14] hover:bg-[#39FF14]/80 text-black", "bg-[#39FF14] hover:bg-[#39FF14]/80 text-black border border-black")
                          )}
                        >
                          {pendingAction === "stake" ? "Staking..." : `Stake Tokens`}
                        </button>
                      </div>

                      {/* Unstake */}
                      <div className={cls("rounded-2xl p-6", dark("bg-gray-900/30", "bg-gray-100"))}>
                        <div className="text-[14px] font-semibold mb-3">Unstake</div>
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          max={formatTokenAmount(availableToUnstake)}
                          placeholder={`Amount (${tokenSymbol})`}
                          value={unstakeAmount}
                          onChange={(e) => setUnstakeAmount(e.target.value)}
                          className={cls(
                            "w-full px-4 py-3 rounded-xl text-[14px] border h-12",
                            dark("bg-gray-900 border-gray-700 text-white", "bg-white border-gray-300 text-gray-900")
                          )}
                        />

                        {isUnstakeTooLarge && (
                          <div className={cls("mt-2 text-[12px] font-medium", dark("text-red-200", "text-red-700"))}>
                            Amount exceeds available to unstake (some stake is locked).
                          </div>
                        )}

                        <button
                          type="button"
                          disabled={
                            pendingAction === "unstake" ||
                            !unstakeAmount ||
                            availableToUnstake === BigInt(0) ||
                            (() => {
                              const wei = parseTokenAmountToWei(unstakeAmount);
                              return wei === null || wei === BigInt(0) || wei > availableToUnstake;
                            })()
                          }
                          onClick={handleUnstake}
                          className={cls(
                            "mt-4 w-full py-3 px-4 rounded-xl text-[14px] font-medium transition-colors h-12",
                            pendingAction === "unstake"
                              ? dark("bg-gray-700 text-gray-500 cursor-not-allowed", "bg-gray-200 text-gray-500 cursor-not-allowed")
                              : dark("bg-gray-800 hover:bg-gray-700 text-white border border-gray-700", "bg-gray-200 hover:bg-gray-300 text-gray-900 border border-gray-300")
                          )}
                        >
                          {pendingAction === "unstake" ? "Unstaking..." : "Unstake"}
                        </button>
                      </div>
                    </div>
                  </>
                )}
                </div>
              )}

              {/* Approvals */}
              {activeTab === "approvals" && (
                <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Lock size={18} className={dark("text-[#39FF14]", "text-emerald-600")} />
                  <h2 className={cls("text-base sm:text-lg font-semibold", dark("text-white", "text-gray-900"))}>Approve</h2>
                </div>

                <div className={cls("text-xs mb-3", dark("text-white/70", "text-gray-600"))}>
                  Set allowances for the voting system. Default “Add amount” is <span className={cls("font-semibold", dark("text-[#39FF14]", "text-emerald-700"))}>1m {tokenSymbol}</span>.
                </div>

                {!isBondReady ? (
                  <div className={cls("text-xs p-3 rounded border", dark("bg-yellow-900/20 border-yellow-800 text-yellow-300", "bg-yellow-50 border-yellow-200 text-yellow-800"))}>
                    Bond currency not ready yet.
                  </div>
                ) : (
                  <>
                    <div className="space-y-4">
                      <div className={cls("rounded-xl p-4", dark("bg-gray-900/30", "bg-gray-100"))}>
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                          <div>
                            <div className={cls("text-xs font-medium", dark("text-white", "text-gray-900"))}>Market Manager</div>
                            <div className={cls("text-[11px]", dark("text-white/60", "text-gray-500"))}>
                              Spender: {MARKET_MANAGER_ADDRESS?.slice(0, 6)}...{MARKET_MANAGER_ADDRESS?.slice(-4)}
                            </div>
                          </div>
                          <div className="text-left sm:text-right">
                            <div className={cls("text-[11px]", dark("text-white/60", "text-gray-500"))}>Current allowance</div>
                            <div className={cls("text-xs font-semibold", dark("text-white", "text-gray-900"))}>
                              {formatTokenAmount(allowanceMarketManager)} {tokenSymbol}
                            </div>
                          </div>
                        </div>

                        <div className="mt-3">
                          <label className={cls("block text-[11px] mb-1", dark("text-white/70", "text-gray-600"))}>
                            Add amount
                          </label>
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            value={approvalStepAmount}
                            onChange={(e) => setApprovalStepAmount(e.target.value)}
                            className={cls(
                              "w-full px-2.5 py-1 rounded-lg text-[12px] border h-9",
                              dark("bg-gray-900 border-gray-700 text-white", "bg-white border-gray-300 text-gray-900")
                            )}
                          />

                          {wouldExceedMarketManager && stepWei > BigInt(0) && (
                            <div className={cls("mt-2 text-[12px] font-medium", dark("text-red-200", "text-red-700"))}>
                              Total approval would exceed 50m tokens.
                            </div>
                          )}

                          <div className="mt-3 flex gap-2 flex-col sm:flex-row sm:justify-end">
                            <button
                              type="button"
                              onClick={handleResetMarketManager}
                              disabled={pendingAction === "approve-market"}
                              className={cls(
                                "py-1.5 px-4 rounded-lg text-[12px] font-medium transition-colors w-fit",
                                pendingAction === "approve-market"
                                  ? dark("bg-gray-700 text-gray-500 cursor-not-allowed", "bg-gray-200 text-gray-500 cursor-not-allowed")
                                  : dark("bg-gray-700 hover:bg-gray-600 text-white", "bg-gray-200 hover:bg-gray-300 text-gray-900")
                              )}
                            >
                              Reduce to 0
                            </button>

                            <button
                              type="button"
                              disabled={
                                pendingAction === "approve-market" ||
                                stepWei <= BigInt(0) ||
                                wouldExceedMarketManager
                              }
                              onClick={handleIncreaseMarketManager}
                              className={cls(
                                "py-1.5 px-4 rounded-lg text-[12px] font-medium transition-colors w-fit",
                                pendingAction === "approve-market"
                                  ? dark("bg-gray-700 text-gray-500 cursor-not-allowed", "bg-gray-200 text-gray-500 cursor-not-allowed")
                                    : dark("bg-[#39FF14] hover:bg-[#39FF14]/80 text-black border border-black", "bg-[#39FF14] hover:bg-[#39FF14]/80 text-black border border-black")
                              )}
                            >
                              Increase by step
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className={cls("rounded-xl p-4", dark("bg-gray-900/30", "bg-gray-100"))}>
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                          <div>
                            <div className={cls("text-xs font-medium", dark("text-white", "text-gray-900"))}>Voting Contract</div>
                            <div className={cls("text-[11px]", dark("text-white/60", "text-gray-500"))}>
                              Spender: {votingContractAddress?.slice(0, 6)}...{votingContractAddress?.slice(-4)}
                            </div>
                          </div>
                          <div className="text-left sm:text-right">
                            <div className={cls("text-[11px]", dark("text-white/60", "text-gray-500"))}>Current allowance</div>
                            <div className={cls("text-xs font-semibold", dark("text-white", "text-gray-900"))}>
                              {formatTokenAmount(allowanceVoting)} {tokenSymbol}
                            </div>
                          </div>
                        </div>

                        <div className="mt-3">
                          <label className={cls("block text-[11px] mb-1", dark("text-white/70", "text-gray-600"))}>
                            Add amount
                          </label>
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            value={approvalStepAmount}
                            onChange={(e) => setApprovalStepAmount(e.target.value)}
                            className={cls(
                              "w-full px-2.5 py-1 rounded-lg text-[12px] border h-9",
                              dark("bg-gray-900 border-gray-700 text-white", "bg-white border-gray-300 text-gray-900")
                            )}
                          />

                          {wouldExceedVoting && stepWei > BigInt(0) && (
                            <div className={cls("mt-2 text-[12px] font-medium", dark("text-red-200", "text-red-700"))}>
                              Total approval would exceed 50m tokens.
                            </div>
                          )}

                          <div className="mt-3 flex gap-2 flex-col sm:flex-row sm:justify-end">
                            <button
                              type="button"
                              onClick={handleResetVoting}
                              disabled={pendingAction === "approve-voting"}
                              className={cls(
                                "py-1.5 px-4 rounded-lg text-[12px] font-medium transition-colors w-fit",
                                pendingAction === "approve-voting"
                                  ? dark("bg-gray-700 text-gray-500 cursor-not-allowed", "bg-gray-200 text-gray-500 cursor-not-allowed")
                                  : dark("bg-gray-700 hover:bg-gray-600 text-white", "bg-gray-200 hover:bg-gray-300 text-gray-900")
                              )}
                            >
                              Reduce to 0
                            </button>

                            <button
                              type="button"
                              disabled={
                                pendingAction === "approve-voting" ||
                                stepWei <= BigInt(0) ||
                                wouldExceedVoting
                              }
                              onClick={handleIncreaseVoting}
                              className={cls(
                                "py-1.5 px-4 rounded-lg text-[12px] font-medium transition-colors w-fit",
                                pendingAction === "approve-voting"
                                  ? dark("bg-gray-700 text-gray-500 cursor-not-allowed", "bg-gray-200 text-gray-500 cursor-not-allowed")
                                  : dark("bg-[#39FF14] hover:bg-[#39FF14]/80 text-black border border-black", "bg-[#39FF14] hover:bg-[#39FF14]/80 text-black border border-black")
                              )}
                            >
                              Increase by step
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className={cls("mt-4 text-[11px] leading-relaxed", dark("text-white/60", "text-gray-500"))}>
                      Tip: if staking fails, approve the voting contract first. If asserting/disputing fails, approve the Market Manager first.
                    </div>
                  </>
                )}
              </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

