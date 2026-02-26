"use client";

// @p2p-oracle-system
// Updated to match: P2PVoting.sol, P2POptimisticOracle.sol, EventPool.sol (rewritten)
//
// Key contract changes reflected here:
//  - requestP2PResolution(marketId, optionId, claim)  ← arg order changed
//  - getAssertion() returns callbackData instead of identifier+ancillaryData
//  - P2PVoting: RequestState enum 0=Pending 1=Resolved 2=NoConsensus
//  - Voting: vote(requestId, value) where 1=accept assertion, 2=reject
//  - voteRequestId stored on oracle assertion; used to look up voting data
//  - canDispute(assertionId) / canSettle(assertionId) on oracle
//  - No-consensus fallback: oracle accepts assertion, both bonds returned

import React, { useState, useEffect, useCallback } from "react";
import { 
  AlertCircle,
  CheckCircle,
  Clock,
  Sun,
  Moon,
  Menu,
  FileText,
  Loader2,
  ShieldAlert,
  ThumbsUp,
  ThumbsDown,
  Coins,
} from "lucide-react";
import { HeaderWallet } from "@/components/HeaderWallet";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  usePublicClient,
  useBalance,
} from "wagmi";
import {
  formatEther,
  stringToBytes,
  bytesToString,
  decodeAbiParameters,
  parseAbiParameters,
} from "viem";
import { Sidebar } from "../components/Sidebar";
import { useTheme } from "../context/ThemeContext";
import { useRouter } from "next/navigation";

const MARKET_MANAGER_ADDRESS = process.env
  .NEXT_PUBLIC_P2P_MARKET_MANAGER_ADDRESS as `0x${string}`;

// ─── ABIs ─────────────────────────────────────────────────────────────────────

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
          { name: "marketType", type: "uint8" },
          { name: "priceFeed", type: "address" },
          { name: "priceThreshold", type: "uint256" },
          { name: "p2pAssertionId", type: "bytes32" },
          { name: "p2pAssertionMade", type: "bool" },
          { name: "p2pDisputedOptionId", type: "uint256" },
        ],
        name: "",
        type: "tuple",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "getNextMarketId",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  // NEW signature: (marketId, optionId, claim)
  {
    inputs: [
      { name: "marketId", type: "uint256" },
      { name: "optionId", type: "uint256" },
      { name: "claim", type: "bytes" },
    ],
    name: "requestP2PResolution",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { name: "marketId", type: "uint256" },
      { name: "optionId", type: "uint256" },
    ],
    name: "disputeOracle",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ name: "marketId", type: "uint256" }],
    name: "settleOracle",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ name: "marketId", type: "uint256" }],
    name: "resolveP2PMarket",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ name: "marketId", type: "uint256" }],
    name: "cancelMarketNoAssertion",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
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
  {
    inputs: [],
    name: "assertionGracePeriod",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { name: "marketId", type: "uint256" },
      { name: "user", type: "address" },
    ],
    name: "userHasStaked",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

// New getAssertion: 12 fields (includes voteRequestId as 12th field)
const ORACLE_ABI = [
  {
    inputs: [{ name: "assertionId", type: "bytes32" }],
    name: "getAssertion",
    outputs: [
      { name: "claim", type: "bytes" },
      { name: "asserter", type: "address" },
      { name: "disputer", type: "address" },
      { name: "assertionTime", type: "uint256" },
      { name: "assertionDeadline", type: "uint256" },
      { name: "expirationTime", type: "uint256" },
      { name: "settled", type: "bool" },
      { name: "result", type: "bool" },
      { name: "currency", type: "address" },
      { name: "bond", type: "uint256" },
      { name: "callbackData", type: "bytes" },
      { name: "voteRequestId", type: "bytes32" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "currency", type: "address" }],
    name: "getMinimumBond",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  // canDispute / canSettle helpers (new in rewritten oracle)
  {
    inputs: [{ name: "assertionId", type: "bytes32" }],
    name: "canDispute",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "assertionId", type: "bytes32" }],
    name: "canSettle",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "voting",
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "assertionWindow",
    outputs: [{ name: "", type: "uint64" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "defaultLiveness",
    outputs: [{ name: "", type: "uint64" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

// VoteRequest struct: identifier, time, ancillaryData, deadline, state(uint8), result, totalVotes
// RequestState: 0=Pending, 1=Resolved, 2=NoConsensus
const VOTING_ABI = [
  {
    inputs: [{ name: "requestId", type: "bytes32" }],
    name: "getRequest",
    outputs: [
      {
        components: [
          { name: "identifier", type: "bytes32" },
          { name: "time", type: "uint256" },
          { name: "ancillaryData", type: "bytes" },
          { name: "deadline", type: "uint256" },
          { name: "state", type: "uint8" }, // 0=Pending 1=Resolved 2=NoConsensus
          { name: "result", type: "int256" },
          { name: "totalVotes", type: "uint256" },
        ],
        name: "",
        type: "tuple",
      },
    ],
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
  // vote(requestId, value): value=1 to ACCEPT assertion, value=2 to REJECT it
  {
    inputs: [
      { name: "requestId", type: "bytes32" },
      { name: "value", type: "int256" },
    ],
    name: "vote",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ name: "requestId", type: "bytes32" }],
    name: "resolveVote",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ name: "voter", type: "address" }],
    name: "stakedBalance",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { name: "requestId", type: "bytes32" },
      { name: "voter", type: "address" },
    ],
    name: "hasVoted",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { name: "requestId", type: "bytes32" },
      { name: "voter", type: "address" },
    ],
    name: "voterChoice",
    outputs: [{ name: "", type: "int256" }],
    stateMutability: "view",
    type: "function",
  },
  // voteWeight(requestId, value) → total weight for that value
  {
    inputs: [
      { name: "requestId", type: "bytes32" },
      { name: "value", type: "int256" },
    ],
    name: "voteWeight",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "minParticipation",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "totalStaked",
    outputs: [{ name: "", type: "uint256" }],
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
] as const;

// ─── Types ────────────────────────────────────────────────────────────────────

interface MarketData {
  creator: `0x${string}`;
  ipfsHash: string;
  isMultiOption: boolean;
  maxOptions: bigint;
  paymentToken: `0x${string}`;
  minStake: bigint;
  creatorDeposit: bigint;
  creatorOutcome: bigint;
  startTime: bigint;
  stakeEndTime: bigint;
  endTime: bigint;
  resolutionEndTime: bigint;
  state: number;
  winningOption: bigint;
  isResolved: boolean;
  marketType: number;
  priceFeed: `0x${string}`;
  priceThreshold: bigint;
  p2pAssertionId: `0x${string}`;
  p2pAssertionMade: boolean;
}

// RequestState from P2PVoting
const RequestState = {
  Pending: 0,
  Resolved: 1,
  NoConsensus: 2,
} as const;

interface AssertionInfo {
  asserter: `0x${string}`;
  disputer: `0x${string}`;
  assertionTime: bigint;
  assertionDeadline: bigint;
  expirationTime: bigint;
  settled: boolean;
  result: boolean;
  bond: bigint;
  callbackData: `0x${string}`;
  claimText: string;
  // decoded from callbackData
  assertedOptionId: number; // the optionId asserter claimed won
  // oracle helpers
  canDisputeNow: boolean;
  canSettleNow: boolean;
}

interface VotingInfo {
  requestId: `0x${string}`;
  deadline: bigint;
  state: number; // 0=Pending 1=Resolved 2=NoConsensus
  result: bigint;
  totalVotes: bigint;
  // current vote weights
  acceptWeight: bigint; // weight voted "1" = accept
  rejectWeight: bigint; // weight voted "2" = reject
  // user state
  userStakedBalance: bigint;
  userHasVoted: boolean;
  userVoteChoice: bigint | null; // 1=accept 2=reject
  // participation info
  minParticipation: bigint;
}

interface MarketWithMetadata extends MarketData {
  marketId: number;
  metadata: any;
  assertion: AssertionInfo | null;
  voting: VotingInfo | null;
  userHasStaked: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AssertPage() {
  const { isDarkMode, toggleTheme } = useTheme();
  const { address, isConnected } = useAccount();
  const { writeContract } = useWriteContract();
  const publicClient = usePublicClient();
  const router = useRouter();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [markets, setMarkets] = useState<MarketWithMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [currentTime, setCurrentTime] = useState<bigint>(BigInt(0));
  const [isApproving, setIsApproving] = useState(false);
  const [selectedOptions, setSelectedOptions] = useState<Record<number, number>>({});
  const [stakeInputs, setStakeInputs] = useState<Record<number, string>>({});
  const [selectedVotes, setSelectedVotes] = useState<Record<number, bigint>>({});

  // Oracle address
  const { data: oracleAddress, isLoading: isLoadingOracle } = useReadContract({
    address: MARKET_MANAGER_ADDRESS,
    abi: MARKET_MANAGER_ABI,
    functionName: "optimisticOracle",
  });

  const { data: bondCurrency } = useReadContract({
    address: MARKET_MANAGER_ADDRESS,
    abi: MARKET_MANAGER_ABI,
    functionName: "defaultBondCurrency",
    query: { enabled: !!oracleAddress },
  });

  const { data: minimumBond } = useReadContract({
    address: oracleAddress as `0x${string}`,
    abi: ORACLE_ABI,
    functionName: "getMinimumBond",
    args: [bondCurrency as `0x${string}`],
    query: { enabled: !!oracleAddress && !!bondCurrency },
  });

  const { data: bondBalance } = useBalance({
    address,
    token: bondCurrency as `0x${string}`,
    query: { enabled: !!address && !!bondCurrency },
  });

  const { data: tokenAllowance, refetch: refetchAllowance } = useReadContract({
    address: bondCurrency as `0x${string}`,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: address && MARKET_MANAGER_ADDRESS ? [address, MARKET_MANAGER_ADDRESS] : undefined,
    query: { enabled: !!address && !!MARKET_MANAGER_ADDRESS && !!bondCurrency },
  });

  // Get voting contract address
  const { data: votingContractAddress } = useReadContract({
    address: oracleAddress as `0x${string}`,
    abi: ORACLE_ABI,
    functionName: "voting",
    query: { enabled: !!oracleAddress },
  }) as { data: `0x${string}` | undefined };

  // Check allowance for voting contract
  const { data: votingAllowance, refetch: refetchVotingAllowance } = useReadContract({
    address: bondCurrency as `0x${string}`,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: address && votingContractAddress ? [address, votingContractAddress] : undefined,
    query: { enabled: !!address && !!votingContractAddress && !!bondCurrency },
  });

  // ─── Helpers ─────────────────────────────────────────────────────────────

  const decodeClaimBytes = (claimHex: string): string => {
    try {
      const hex = claimHex.startsWith("0x") ? claimHex.slice(2) : claimHex;
      if (!hex || hex.length === 0) return "Unknown";
      const bytes = new Uint8Array(hex.length / 2);
      for (let i = 0; i < hex.length; i += 2) {
        bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
      }
      return bytesToString(bytes);
    } catch {
      return "Unknown";
    }
  };

  // callbackData = abi.encode(marketId, optionId) — both uint256
  const decodeCallbackData = (callbackHex: string): number => {
    try {
      const decoded = decodeAbiParameters(
        parseAbiParameters("uint256 marketId, uint256 optionId"),
        callbackHex as `0x${string}`
      );
      return Number(decoded[1]); // optionId
    } catch {
      return 0;
    }
  };

  const formatCountdown = (seconds: number): string => {
    if (seconds <= 0) return "Expired";
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  };

  const isOracleConfigured =
    !isLoadingOracle &&
    oracleAddress &&
    oracleAddress !== "0x0000000000000000000000000000000000000000";

  // ─── Fetch markets ────────────────────────────────────────────────────────

  const fetchMarkets = useCallback(async () => {
    if (!publicClient) return;
      setLoading(true);
      try {
      const nextId = await publicClient.readContract({
          address: MARKET_MANAGER_ADDRESS,
          abi: MARKET_MANAGER_ABI,
        functionName: "getNextMarketId",
      });

      const result: MarketWithMetadata[] = [];

      for (let i = 1; i < Number(nextId); i++) {
        const market = await publicClient.readContract({
              address: MARKET_MANAGER_ADDRESS,
              abi: MARKET_MANAGER_ABI,
          functionName: "getMarket",
              args: [BigInt(i)],
            }) as MarketData;

        // Only show: state=1 (Ended) + marketType=1 (P2POPTIMISTIC)
        if (market.state !== 1 || market.marketType !== 1) continue;

        // Fetch IPFS metadata
        let metadata: any = null;
        try {
          const res = await fetch(`https://gateway.lighthouse.storage/ipfs/${market.ipfsHash}`);
          if (res.ok) metadata = await res.json();
        } catch {}

        // Fetch assertion data if one was made
        let assertion: AssertionInfo | null = null;
        let voting: VotingInfo | null = null;

        if (market.p2pAssertionMade && market.p2pAssertionId && oracleAddress) {
          try {
            const aData = await publicClient.readContract({
              address: oracleAddress as `0x${string}`,
              abi: ORACLE_ABI,
              functionName: "getAssertion",
              args: [market.p2pAssertionId],
            }) as readonly [
              `0x${string}`, // claim (bytes)
              `0x${string}`, // asserter
              `0x${string}`, // disputer
              bigint,        // assertionTime
              bigint,        // assertionDeadline
              bigint,        // expirationTime
              boolean,       // settled
              boolean,       // result
              `0x${string}`, // currency
              bigint,        // bond
              `0x${string}`, // callbackData
              `0x${string}`  // voteRequestId
            ];

            const [
              claimBytes, asserter, disputer, assertionTime,
              assertionDeadline, expirationTime, settled, result,
              , bond, callbackData, voteRequestId
            ] = aData;

            // canDispute / canSettle from oracle (uses block.timestamp on-chain)
            const [canDisputeNow, canSettleNow] = await Promise.all([
              publicClient.readContract({
                address: oracleAddress as `0x${string}`,
                abi: ORACLE_ABI,
                functionName: "canDispute",
                args: [market.p2pAssertionId],
              }) as Promise<boolean>,
              publicClient.readContract({
                address: oracleAddress as `0x${string}`,
                abi: ORACLE_ABI,
                functionName: "canSettle",
                args: [market.p2pAssertionId],
              }) as Promise<boolean>,
            ]);

            assertion = {
              asserter,
              disputer,
              assertionTime,
              assertionDeadline,
              expirationTime,
              settled,
              result,
              bond,
              callbackData,
              claimText: decodeClaimBytes(claimBytes),
              assertedOptionId: decodeCallbackData(callbackData),
              canDisputeNow,
              canSettleNow,
            };

            const isDisputed =
              disputer !== "0x0000000000000000000000000000000000000000";

            // If disputed, load voting data using voteRequestId from oracle
            if (isDisputed && !settled && voteRequestId && voteRequestId !== "0x0000000000000000000000000000000000000000000000000000000000000000") {
              try {
                const votingAddr = await publicClient.readContract({
                  address: oracleAddress as `0x${string}`,
                  abi: ORACLE_ABI,
                  functionName: "voting",
                }) as `0x${string}`;

                console.log(`Fetching vote data for requestId: ${voteRequestId}, votingAddr: ${votingAddr}`);

                const voteReq = await publicClient.readContract({
                  address: votingAddr,
                  abi: VOTING_ABI,
                  functionName: "getRequest",
                  args: [voteRequestId],
                }) as {
                  identifier: `0x${string}`;
                  time: bigint;
                  ancillaryData: `0x${string}`;
                  deadline: bigint;
                  state: number;
                  result: bigint;
                  totalVotes: bigint;
                };

                console.log(`Vote request found:`, voteReq);

                // Fetch vote weights for accept(1) and reject(2)
                const [acceptWeight, rejectWeight] = await Promise.all([
                  publicClient.readContract({
                    address: votingAddr,
                    abi: VOTING_ABI,
                    functionName: "voteWeight",
                    args: [voteRequestId, BigInt(1)],
                  }) as Promise<bigint>,
                  publicClient.readContract({
                    address: votingAddr,
                    abi: VOTING_ABI,
                    functionName: "voteWeight",
                    args: [voteRequestId, BigInt(2)],
                  }) as Promise<bigint>,
                ]);

                const minPart = await publicClient.readContract({
                  address: votingAddr,
                  abi: VOTING_ABI,
                  functionName: "minParticipation",
                }) as bigint;

                let userStaked = BigInt(0);
                let userHasVoted = false;
                let userVoteChoice: bigint | null = null;

                if (address) {
                  const [staked, voted] = await Promise.all([
                    publicClient.readContract({
                      address: votingAddr,
                      abi: VOTING_ABI,
                      functionName: "stakedBalance",
                      args: [address],
                    }) as Promise<bigint>,
                    publicClient.readContract({
                      address: votingAddr,
                      abi: VOTING_ABI,
                      functionName: "hasVoted",
                      args: [voteRequestId, address],
                    }) as Promise<boolean>,
                  ]);
                  userStaked = staked;
                  userHasVoted = voted;

                  if (voted) {
                    userVoteChoice = await publicClient.readContract({
                      address: votingAddr,
                      abi: VOTING_ABI,
                      functionName: "voterChoice",
                      args: [voteRequestId, address],
                    }) as bigint;
                  }
                }

                voting = {
                  requestId: voteRequestId,
                  deadline: voteReq.deadline,
                  state: voteReq.state,
                  result: voteReq.result,
                  totalVotes: voteReq.totalVotes,
                  acceptWeight,
                  rejectWeight,
                  userStakedBalance: userStaked,
                  userHasVoted,
                  userVoteChoice,
                  minParticipation: minPart,
                };
              } catch (e) {
                console.error(`Voting data fetch error for market ${i}:`, e);
                // Set voting to null so UI knows it failed
                voting = null;
              }
            }
          } catch (e) {
            console.error(`Assertion data fetch error for market ${i}:`, e);
          }
        }

        // Check if user has staked in this market
        let hasStaked = false;
        if (address) {
          try {
            hasStaked = await publicClient.readContract({
              address: MARKET_MANAGER_ADDRESS,
              abi: MARKET_MANAGER_ABI,
              functionName: "userHasStaked",
              args: [BigInt(i), address],
            }) as boolean;
          } catch (e) {
            console.error(`Error checking stake for market ${i}:`, e);
          }
        }

        result.push({ ...market, marketId: i, metadata, assertion, voting, userHasStaked: hasStaked });
      }

      setMarkets(result);
    } catch (e) {
      console.error("fetchMarkets error:", e);
      setError("Failed to load markets");
      } finally {
        setLoading(false);
      }
  }, [publicClient, oracleAddress, address]);

  useEffect(() => {
    if (publicClient && oracleAddress !== undefined) fetchMarkets();
  }, [fetchMarkets, publicClient, oracleAddress]);

  // Block-synced clock
  useEffect(() => {
    if (!publicClient) return;
    const syncBlock = async () => {
      try {
        const block = await publicClient.getBlock({ blockTag: "latest" });
        setCurrentTime(BigInt(block.timestamp));
      } catch {
        setCurrentTime(BigInt(Math.floor(Date.now() / 1000)));
      }
    };
    syncBlock();
    const blockInterval = setInterval(syncBlock, 30_000);
    const tickInterval = setInterval(
      () => setCurrentTime((p) => (p > BigInt(0) ? p + BigInt(1) : BigInt(Math.floor(Date.now() / 1000)))),
      1000
    );
    return () => {
      clearInterval(blockInterval);
      clearInterval(tickInterval);
    };
  }, [publicClient]);

  // ─── Tx helpers ──────────────────────────────────────────────────────────

  const isUserRejection = (err: any) => {
    const msg = (err?.message || err?.toString() || "").toLowerCase();
    return (
      msg.includes("user rejected") ||
      msg.includes("user denied") ||
      msg.includes("rejected the request") ||
      msg.includes("4001")
    );
  };

  const withTx = async (
    key: string,
    fn: () => Promise<void>,
    successMsg: string
  ) => {
    setPendingAction(key);
    setError("");
    try {
      await fn();
      setSuccess(successMsg);
    } catch (err: any) {
      if (!isUserRejection(err)) setError(err?.message || "Transaction failed");
    } finally {
      setPendingAction(null);
    }
  };

  // ─── Actions ─────────────────────────────────────────────────────────────

  const handleApprove = () =>
    withTx("approve", async () => {
      setIsApproving(true);
      try {
        await writeContract({
          address: bondCurrency as `0x${string}`,
          abi: ERC20_ABI,
          functionName: "approve",
          args: [
            MARKET_MANAGER_ADDRESS,
            BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"),
          ],
        });
        setTimeout(() => refetchAllowance(), 3000);
      } finally {
        setIsApproving(false);
      }
    }, "Approval submitted");

  const handleMakeAssertion = (marketId: number) => {
    const market = markets.find((m) => m.marketId === marketId)!;
    const optionId = selectedOptions[marketId];
    if (!optionId) { setError("Select an option first"); return; }
    if (!market.metadata) { setError("Market metadata not loaded"); return; }
    const options: string[] = market.metadata.options || ["Yes", "No"];
    const claimText = options[optionId - 1] || `Option ${optionId} wins`;
    const claimBytes =
      (`0x` +
        Array.from(stringToBytes(claimText))
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("")) as `0x${string}`;

    return withTx(
      `assert-${marketId}`,
      async () => {
      await writeContract({
        address: MARKET_MANAGER_ADDRESS,
        abi: MARKET_MANAGER_ABI,
          functionName: "requestP2PResolution",
          // NEW order: (marketId, optionId, claim)
          args: [BigInt(marketId), BigInt(optionId), claimBytes],
          gas: BigInt(500_000),
        });
      },
      "Assertion submitted!"
    );
  };

  const handleDispute = (marketId: number) => {
    const market = markets.find((m) => m.marketId === marketId)!;
    const optionId = selectedOptions[marketId];
    if (!optionId) { setError("Select an option to dispute with first"); return; }
    
    return withTx(
      `dispute-${marketId}`,
      async () => {
        await writeContract({
          address: MARKET_MANAGER_ADDRESS,
          abi: MARKET_MANAGER_ABI,
          functionName: "disputeOracle",
          args: [BigInt(marketId), BigInt(optionId)],
          gas: BigInt(500_000),
        });
      },
      "Dispute submitted!"
    );
  };

  const handleApproveVoting = async (marketId: number) => {
    if (!votingContractAddress || !bondCurrency) return;
    const amtStr = stakeInputs[marketId];
    if (!amtStr || parseFloat(amtStr) <= 0) { setError("Enter a stake amount first"); return; }
    const amount = BigInt(Math.floor(parseFloat(amtStr) * 1e18));

    return withTx(
      `approve-voting-${marketId}`,
      async () => {
        await writeContract({
          address: bondCurrency as `0x${string}`,
          abi: ERC20_ABI,
          functionName: "approve",
          args: [votingContractAddress, amount],
        });
        setTimeout(() => refetchVotingAllowance(), 2000);
      },
      "Approval submitted!"
    );
  };

  const handleStakeForVoting = async (marketId: number) => {
    if (!votingContractAddress) return;
    const amtStr = stakeInputs[marketId];
    if (!amtStr || parseFloat(amtStr) <= 0) { setError("Enter a stake amount"); return; }
    const amount = BigInt(Math.floor(parseFloat(amtStr) * 1e18));

    // Check if allowance is sufficient
    if (!votingAllowance || votingAllowance < amount) {
      setError("Please approve the voting contract first");
      return;
    }

    return withTx(
      `stake-${marketId}`,
      async () => {
        await writeContract({
          address: votingContractAddress,
          abi: VOTING_ABI,
          functionName: "stake",
          args: [amount],
          gas: BigInt(300_000),
        });
        setStakeInputs((p) => ({ ...p, [marketId]: "" }));
      },
      "Staked for voting!"
    );
  };

  // value: 1n = accept assertion, 2n = reject assertion
  const handleVote = (marketId: number, value: bigint) => {
    const market = markets.find((m) => m.marketId === marketId)!;
    if (!market.voting) return;
    return withTx(
      `vote-${marketId}`,
      async () => {
        if (!oracleAddress) throw new Error("Oracle not set");
        const votingAddr = await publicClient!.readContract({
          address: oracleAddress as `0x${string}`,
          abi: ORACLE_ABI,
          functionName: "voting",
        }) as `0x${string}`;
        await writeContract({
          address: votingAddr,
          abi: VOTING_ABI,
          functionName: "vote",
          args: [market.voting!.requestId, value],
          gas: BigInt(300_000),
        });
      },
      `Vote submitted (${value === BigInt(1) ? "Accept" : "Reject"})`
    );
  };

  const handleSettle = (marketId: number) =>
    withTx(
      `settle-${marketId}`,
      async () => {
      await writeContract({
        address: MARKET_MANAGER_ADDRESS,
        abi: MARKET_MANAGER_ABI,
          functionName: "settleOracle",
          args: [BigInt(marketId)],
          gas: BigInt(400_000),
        });
      },
      "Oracle settled!"
    );

  const handleResolve = (marketId: number) =>
    withTx(
      `resolve-${marketId}`,
      async () => {
        await writeContract({
          address: MARKET_MANAGER_ADDRESS,
          abi: MARKET_MANAGER_ABI,
          functionName: "resolveP2PMarket",
          args: [BigInt(marketId)],
          gas: BigInt(400_000),
        });
      },
      "Market resolved!"
    );

  const handleCancelNoAssertion = (marketId: number) =>
    withTx(
      `cancel-${marketId}`,
      async () => {
        await writeContract({
          address: MARKET_MANAGER_ADDRESS,
          abi: MARKET_MANAGER_ABI,
          functionName: "cancelMarketNoAssertion",
          args: [BigInt(marketId)],
          gas: BigInt(200_000),
        });
        setTimeout(() => fetchMarkets(), 3000);
      },
      "Market cancelled — refunds available"
    );

  // ─── Derived per-market state ─────────────────────────────────────────────

  const getMarketPhase = (market: MarketWithMetadata) => {
    const now = Number(currentTime) || Math.floor(Date.now() / 1000);
    const { assertion, voting: voteData } = market;

    if (!market.p2pAssertionMade) {
      const gracePassed =
        now >= Number(market.endTime) + 48 * 3600; // assertionGracePeriod default
      return { phase: "no-assertion" as const, gracePassed };
    }

    if (!assertion) return { phase: "loading" as const };

    if (assertion.settled) {
      return { phase: "settled" as const, oracleAccepted: assertion.result };
    }

    const inAssertionWindow = now < Number(assertion.assertionDeadline);
    const inDisputeWindow =
      !inAssertionWindow && now < Number(assertion.expirationTime);
    const isDisputed =
      assertion.disputer !== "0x0000000000000000000000000000000000000000";

    if (inAssertionWindow) return { phase: "assertion-window" as const, remaining: Number(assertion.assertionDeadline) - now };
    if (isDisputed && voteData) {
      const votingActive = now < Number(voteData.deadline) && voteData.state === RequestState.Pending;
      const votingEnded = now >= Number(voteData.deadline) && voteData.state === RequestState.Pending;
      if (votingActive) return { phase: "voting-active" as const, remaining: Number(voteData.deadline) - now };
      if (votingEnded) return { phase: "voting-ended" as const };
      if (voteData.state === RequestState.NoConsensus) return { phase: "no-consensus" as const };
      if (voteData.state === RequestState.Resolved) return { phase: "vote-resolved" as const };
    }
    // When disputed but voteData not loaded yet - vote request is created immediately on dispute
    // UI will show voting options once voteData loads (see voting UI condition)
    if (isDisputed && !voteData) return { phase: "disputed" as const };
    if (inDisputeWindow && !isDisputed) return { phase: "dispute-window" as const, remaining: Number(assertion.expirationTime) - now };
    if (assertion.canSettleNow) return { phase: "ready-to-settle" as const };

    return { phase: "unknown" as const };
  };

  const hasSufficientAllowance =
    !!tokenAllowance && !!minimumBond && tokenAllowance >= minimumBond;

  // ─── Render ───────────────────────────────────────────────────────────────

  const cls = (...args: (string | false | undefined)[]) =>
    args.filter(Boolean).join(" ");

  const dark = (d: string, l: string) => (isDarkMode ? d : l);

  return (
    <div className={`min-h-screen ${dark("bg-black", "bg-[#F5F3F0]")}`}>
      <Sidebar 
        isOpen={sidebarOpen} 
        onClose={() => setSidebarOpen(false)} 
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        isDarkMode={isDarkMode}
      />

      <div className={`transition-all duration-300 lg:${sidebarCollapsed ? "ml-16" : "ml-64"}`}>
        {/* Header */}
        <header
          className={`sticky top-0 z-30 border-b backdrop-blur-sm ${dark(
            "bg-black border-[#39FF14]/20",
            "bg-[#F5F3F0] border-gray-200"
          )}`}
        >
          <div className="px-4 lg:px-6 py-1.5 lg:py-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setSidebarOpen(true)}
                  className={`lg:hidden p-2 rounded-lg ${dark("hover:bg-[#39FF14]/10 text-white", "hover:bg-gray-200")}`}
                >
                  <Menu size={20} className={dark("text-white", "text-gray-900")} />
                </button>
                <div className="hidden lg:block">
                  <h1 className={`text-2xl font-bold ${dark("text-white", "text-gray-900")}`}>
                    Resolve Markets
                  </h1>
                  <p className={`text-sm ${dark("text-white/70", "text-gray-600")}`}>
                    Assert, dispute, vote, settle, and resolve ended P2P markets
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 lg:gap-4">
                <button
                  onClick={toggleTheme}
                  className={`p-1.5 lg:p-2 rounded-lg ${dark("hover:bg-[#39FF14]/10", "hover:bg-gray-200")}`}
                >
                  {isDarkMode ? (
                    <Sun className="w-4 h-4 lg:w-5 lg:h-5 text-white" />
                  ) : (
                    <Moon className="w-4 h-4 lg:w-5 lg:h-5 text-gray-600" />
                  )}
                </button>
                <HeaderWallet isDarkMode={isDarkMode} />
              </div>
            </div>
          </div>
        </header>

        <main className="p-4 lg:p-6">
          {/* Mobile title */}
          <div className="lg:hidden mb-6">
            <h1 className={`text-2xl font-bold mb-1 ${dark("text-white", "text-gray-900")}`}>
              Resolve Markets
            </h1>
            <p className={`text-sm ${dark("text-white/70", "text-gray-600")}`}>
              Assert, dispute, vote, settle, and resolve ended P2P markets
            </p>
          </div>

          {/* Oracle not configured warning - only show if actually not configured (not loading) */}
          {!isLoadingOracle && !isOracleConfigured && (
            <div className={`mb-6 p-4 rounded-lg border flex items-start gap-3 ${dark("bg-yellow-900/20 border-yellow-800 text-yellow-300", "bg-yellow-50 border-yellow-200 text-yellow-800")}`}>
              <AlertCircle size={20} className="flex-shrink-0 mt-0.5" />
              <div>
                <div className="font-medium mb-1">Oracle Not Configured</div>
                <p className="text-sm">Set the OptimisticOracle address on the EventPool contract first.</p>
              </div>
            </div>
          )}

          {/* Error / Success */}
          {error && (
            <div className={`mb-4 p-4 rounded-lg border flex items-center gap-3 ${dark("bg-red-900/20 border-red-800 text-red-300", "bg-red-50 border-red-200 text-red-800")}`}>
              <AlertCircle size={20} className="flex-shrink-0" />
              <span className="text-sm">{error}</span>
              <button onClick={() => setError("")} className="ml-auto text-xs opacity-70 hover:opacity-100">✕</button>
            </div>
          )}
          {success && (
            <div className={`mb-4 p-4 rounded-lg border flex items-center gap-3 ${dark("bg-green-900/20 border-green-800 text-green-300", "bg-green-50 border-green-200 text-green-800")}`}>
              <CheckCircle size={20} className="flex-shrink-0" />
              <span className="text-sm">{success}</span>
              <button onClick={() => setSuccess("")} className="ml-auto text-xs opacity-70 hover:opacity-100">✕</button>
            </div>
          )}

          {/* Loading */}
          {loading ? (
            <div className={`flex flex-col items-center justify-center py-20 ${dark("text-white/70", "text-gray-600")}`}>
              <Loader2 className="w-8 h-8 animate-spin mb-4" />
              <p>Loading markets...</p>
            </div>
          ) : markets.length === 0 ? (
            <div className={`flex flex-col items-center justify-center py-20 ${dark("text-white/70", "text-gray-600")}`}>
              <FileText className="w-16 h-16 mb-4 opacity-50" />
              <h3 className="text-xl font-semibold mb-2">No Markets to Resolve</h3>
              <p className="text-center max-w-md">
                No ended P2P Optimistic Oracle markets are awaiting resolution.
              </p>
            </div>
          ) : (
            <div className={cls(
              "grid gap-4",
              sidebarCollapsed
                ? "sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
                : "sm:grid-cols-2 lg:grid-cols-3"
            )}>
              {markets.map((market) => {
                const options: string[] =
                  market.metadata?.options || (market.isMultiOption ? [] : ["Yes", "No"]);
                const phase = getMarketPhase(market);
                const now = Number(currentTime) || Math.floor(Date.now() / 1000);
                const isCreator =
                  address &&
                  market.creator &&
                  address.toLowerCase() === market.creator.toLowerCase();

                return (
                  <div
                    key={market.marketId}
                    className={cls(
                      "border rounded-xl overflow-hidden flex flex-col transition-all duration-200 hover:shadow-lg",
                      dark(
                        "bg-black border-gray-800 hover:border-[#39FF14]/30 hover:bg-gray-900/50",
                        "bg-[#F5F3F0] border-gray-300"
                      )
                    )}
                  >
                    {/* Card header */}
                    <div className="p-4">
                      <div className="flex items-start gap-3 mb-3">
                        {market.metadata?.imageUrl && (
                          <img
                            src={market.metadata.imageUrl}
                            alt=""
                            className={`w-12 h-12 rounded-lg object-cover border flex-shrink-0 ${dark("border-gray-800", "border-gray-400")}`}
                            onError={(e) => (e.currentTarget.style.display = "none")}
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <h3
                            onClick={() => router.push(`/market/${market.marketId}`)}
                            className={cls(
                              "font-semibold text-base leading-tight cursor-pointer hover:underline",
                              dark("text-white hover:text-[#39FF14]", "text-gray-900 hover:text-[#39FF14]")
                            )}
                          >
                            {market.metadata?.title || `Market #${market.marketId}`}
                          </h3>
                          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                            <span className={`text-xs px-1.5 py-0.5 rounded ${dark("bg-gray-900 text-gray-300", "bg-gray-200 text-gray-600")}`}>
                              #{market.marketId}
                          </span>
                            {/* Phase badge */}
                            {phase.phase === "no-assertion" && (
                              <span className={`text-xs px-1.5 py-0.5 rounded ${dark("text-yellow-400 bg-yellow-900/30", "text-yellow-700 bg-yellow-100")}`}>
                                Awaiting assertion
                          </span>
                            )}
                            {phase.phase === "assertion-window" && (
                              <span className={`text-xs px-1.5 py-0.5 rounded ${dark("text-blue-400 bg-blue-900/30", "text-blue-700 bg-blue-100")}`}>
                                Assertion window
                              </span>
                            )}
                            {phase.phase === "dispute-window" && (
                              <span className={`text-xs px-1.5 py-0.5 rounded ${dark("text-orange-400 bg-orange-900/30", "text-orange-700 bg-orange-100")}`}>
                                Dispute window
                              </span>
                            )}
                            {(phase.phase === "voting-active" || phase.phase === "voting-ended" || phase.phase === "disputed") && (
                              <span className={`text-xs px-1.5 py-0.5 rounded ${dark("text-red-400 bg-red-900/30", "text-red-700 bg-red-100")}`}>
                                Disputed
                              </span>
                            )}
                            {phase.phase === "no-consensus" && (
                              <span className={`text-xs px-1.5 py-0.5 rounded ${dark("text-purple-400 bg-purple-900/30", "text-purple-700 bg-purple-100")}`}>
                                No consensus
                              </span>
                            )}
                            {phase.phase === "ready-to-settle" && (
                              <span className={`text-xs px-1.5 py-0.5 rounded ${dark("text-green-400 bg-green-900/30", "text-green-700 bg-green-100")}`}>
                                Ready to settle
                              </span>
                            )}
                            {phase.phase === "settled" && (
                              <span className={`text-xs px-1.5 py-0.5 rounded ${dark("text-green-400 bg-green-900/30", "text-green-700 bg-green-100")}`}>
                                Settled ✓
                              </span>
                            )}
                        </div>
                        </div>
                      </div>

                      {/* ── PHASE: NO ASSERTION ── */}
                      {phase.phase === "no-assertion" && (
                        <div className="space-y-2">
                          {isCreator ? (
                            <div className={`text-xs px-3 py-2 rounded ${dark("bg-red-900/30 text-red-400 border border-red-800", "bg-red-100 text-red-800 border border-red-300")}`}>
                              <div className="font-medium mb-0.5">Creator Restriction</div>
                              Market creators cannot assert outcomes on their own markets.
                            </div>
                          ) : !market.userHasStaked ? (
                            <div className={`text-xs px-3 py-2 rounded ${dark("bg-red-900/30 text-red-400 border border-red-800", "bg-red-100 text-red-800 border border-red-300")}`}>
                              <div className="font-medium mb-0.5">Stake Required</div>
                              You must have staked in this market to assert an outcome.
                            </div>
                          ) : (
                            <>
                              <p className={`text-xs mb-2 ${dark("text-gray-400", "text-gray-600")}`}>
                                Select the winning option and post an assertion bond ({minimumBond ? formatEther(minimumBond) : "..."} P2P):
                              </p>
                              <div className="space-y-1.5">
                                {options.map((opt, idx) => {
                                  const optNum = idx + 1;
                                  const sel = selectedOptions[market.marketId] === optNum;
                                  return (
                                    <button
                                      key={idx}
                                      onClick={() => setSelectedOptions((p) => ({ ...p, [market.marketId]: optNum }))}
                                      className={cls(
                                        "w-full text-left px-3 py-2 rounded text-sm border transition-colors",
                                        sel
                                          ? dark("border-[#39FF14] bg-[#39FF14]/10 text-[#39FF14]", "border-[#39FF14] bg-[#39FF14]/10 text-green-700")
                                          : dark("border-gray-700 hover:border-gray-600 text-white", "border-gray-300 hover:border-gray-400 text-gray-900")
                                      )}
                                    >
                                      <div className="flex items-center gap-2">
                                        <input type="radio" checked={sel} readOnly className="w-3 h-3" />
                                        <span className="text-xs">{opt}</span>
                      </div>
                                    </button>
                                  );
                                })}
                              </div>

                              {/* Balance / allowance info */}
                              {bondBalance && minimumBond && (
                                <div className={`text-xs px-3 py-1.5 rounded ${bondBalance.value >= minimumBond ? dark("bg-green-900/30 text-green-400", "bg-green-100 text-green-600") : dark("bg-red-900/30 text-red-400", "bg-red-100 text-red-600")}`}>
                                  Balance: {formatEther(bondBalance.value)} P2P
                                  {bondBalance.value < minimumBond && " (insufficient)"}
                                </div>
                              )}
                              {minimumBond && tokenAllowance !== undefined && (
                                <div className={`text-xs px-3 py-1.5 rounded ${hasSufficientAllowance ? dark("bg-green-900/30 text-green-400", "bg-green-100 text-green-600") : dark("bg-yellow-900/30 text-yellow-400", "bg-yellow-100 text-yellow-700")}`}>
                                  {hasSufficientAllowance ? "Approved ✓" : `Allowance: ${formatEther(tokenAllowance)} P2P (needs approval)`}
                                </div>
                              )}

                              {!hasSufficientAllowance && minimumBond && bondBalance && bondBalance.value >= minimumBond && (
                                <button
                                  onClick={handleApprove}
                                  disabled={isApproving}
                                  className={cls(
                                    "w-full py-2 px-4 rounded text-sm font-medium transition-colors",
                                    isApproving
                                      ? dark("bg-gray-800 text-gray-500 cursor-not-allowed", "bg-gray-300 text-gray-500 cursor-not-allowed")
                                      : "bg-blue-600 hover:bg-blue-700 text-white"
                                  )}
                                >
                                  {isApproving ? "Approving..." : "Approve P2P"}
                    </button>
                              )}

                              <button
                                onClick={() => handleMakeAssertion(market.marketId)}
                                disabled={
                                  !isConnected ||
                                  !selectedOptions[market.marketId] ||
                                  pendingAction === `assert-${market.marketId}` ||
                                  !isOracleConfigured ||
                                  !hasSufficientAllowance ||
                                  !bondBalance ||
                                  !minimumBond ||
                                  bondBalance.value < minimumBond ||
                                  !market.userHasStaked
                                }
                                className={cls(
                                  "w-full py-2 px-4 rounded text-sm font-medium transition-colors",
                                  !isConnected || !selectedOptions[market.marketId] || !hasSufficientAllowance || !bondBalance || !minimumBond || bondBalance.value < minimumBond
                                    ? dark("bg-gray-800 text-gray-500 cursor-not-allowed", "bg-gray-300 text-gray-500 cursor-not-allowed")
                                    : dark("bg-[#39FF14] hover:bg-[#39FF14]/80 text-black", "bg-[#39FF14] hover:bg-[#39FF14]/80 text-black")
                                )}
                              >
                                {pendingAction === `assert-${market.marketId}` ? "Submitting..." : "Assert Outcome"}
                              </button>
                            </>
                          )}

                          {/* Cancel if grace period passed and no assertion */}
                          {(phase as any).gracePassed && (
                            <button
                              onClick={() => handleCancelNoAssertion(market.marketId)}
                              disabled={pendingAction === `cancel-${market.marketId}`}
                              className={cls(
                                "w-full py-2 px-3 rounded text-xs font-medium transition-colors mt-1",
                                dark("bg-gray-800 hover:bg-gray-700 text-gray-300", "bg-gray-200 hover:bg-gray-300 text-gray-700")
                              )}
                            >
                              {pendingAction === `cancel-${market.marketId}` ? "Cancelling..." : "Cancel Market (No Assertion)"}
                            </button>
                          )}
                                </div>
                      )}

                      {/* ── PHASE: ASSERTION WINDOW ── */}
                      {phase.phase === "assertion-window" && market.assertion && (
                        <div className="space-y-2">
                          <div className={`text-xs px-3 py-2 rounded ${dark("bg-blue-900/30 text-blue-300 border border-blue-800", "bg-blue-100 text-blue-800 border border-blue-300")}`}>
                            <div className="font-medium mb-0.5">Asserted: {market.assertion.claimText}</div>
                            <div className="flex items-center gap-1 mt-1">
                              <Clock size={12} />
                              Dispute opens in {formatCountdown((phase as any).remaining)}
                            </div>
                            </div>
                          </div>
                        )}

                      {/* ── PHASE: DISPUTE WINDOW ── */}
                      {phase.phase === "dispute-window" && market.assertion && (
                        <div className="space-y-2">
                          <div className={`text-xs px-3 py-2 rounded ${dark("bg-gray-900/50 text-gray-300 border border-gray-700", "bg-gray-100 text-gray-700 border border-gray-300")}`}>
                            <div className="font-medium mb-0.5">
                              Dispute window open
                            </div>
                            <div>Asserted option: <span className="font-medium">{options[market.assertion.assertedOptionId - 1] || `Option ${market.assertion.assertedOptionId}`}</span></div>
                            <div className="flex items-center gap-1 mt-1">
                              <Clock size={12} />
                              {formatCountdown((phase as any).remaining)} remaining
                            </div>
                          </div>

                          {/* Dispute with option selection */}
                          <div>
                            <label className={`block text-xs font-medium mb-1.5 ${dark("text-gray-300", "text-gray-700")}`}>
                              Dispute with:
                            </label>
                            <div className="space-y-1.5">
                              {options.map((option: string, index: number) => {
                                const optionId = index + 1;
                                const assertedOptionId = market.assertion?.assertedOptionId || 0;
                                const isAssertedOption = optionId === assertedOptionId;
                                const isSelected = selectedOptions[market.marketId] === optionId;
                                
                                return (
                                  <button
                                    key={index}
                                    onClick={() => {
                                      if (!isAssertedOption) {
                                        setSelectedOptions(prev => ({ ...prev, [market.marketId]: optionId }));
                                      }
                                    }}
                                    disabled={isAssertedOption}
                                    className={cls(
                                      "w-full text-left px-3 py-2 rounded text-xs border transition-colors",
                                      isAssertedOption
                                        ? dark("bg-gray-800 text-gray-500 cursor-not-allowed border-gray-700", "bg-gray-200 text-gray-400 cursor-not-allowed border-gray-300")
                                        : isSelected
                                          ? dark("border-[#39FF14] bg-[#39FF14]/10 text-[#39FF14]", "border-[#39FF14] bg-[#39FF14]/10 text-green-700")
                                          : dark("border-gray-700 hover:border-gray-600 text-white", "border-gray-300 hover:border-gray-400 text-gray-900")
                                    )}
                                  >
                                    <div className="flex items-center gap-2">
                                      <input
                                        type="radio"
                                        checked={isSelected}
                                        onChange={() => {}}
                                        className="w-3 h-3"
                                        disabled={isAssertedOption}
                                      />
                                      <span>{option}</span>
                                      {isAssertedOption && (
                                        <span className={`text-[10px] ml-auto ${dark("text-gray-500", "text-gray-400")}`}>
                                          (asserted)
                                        </span>
                                      )}
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          {minimumBond && (
                            <div className={`text-xs px-3 py-1.5 rounded ${dark("bg-gray-900 text-gray-400", "bg-gray-100 text-gray-600")}`}>
                              Dispute bond: {formatEther(minimumBond)} P2P
                            </div>
                          )}

                          {!hasSufficientAllowance && bondBalance && minimumBond && bondBalance.value >= minimumBond && (
                            <button
                              onClick={handleApprove}
                              disabled={isApproving}
                              className="w-full py-2 px-4 rounded text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white transition-colors"
                            >
                              {isApproving ? "Approving..." : "Approve P2P"}
                            </button>
                          )}

                          <button
                            onClick={() => handleDispute(market.marketId)}
                            disabled={
                              !isConnected ||
                              !selectedOptions[market.marketId] ||
                              pendingAction === `dispute-${market.marketId}` ||
                              !hasSufficientAllowance ||
                              !bondBalance ||
                              !minimumBond ||
                              bondBalance.value < minimumBond
                            }
                            className={cls(
                              "w-full py-2 px-4 rounded text-sm font-medium transition-colors",
                              !isConnected || !selectedOptions[market.marketId] || !hasSufficientAllowance || !bondBalance || !minimumBond || bondBalance.value < minimumBond
                                ? dark("bg-gray-800 text-gray-500 cursor-not-allowed", "bg-gray-300 text-gray-500 cursor-not-allowed")
                                : "bg-red-600 hover:bg-red-700 text-white"
                            )}
                          >
                            {pendingAction === `dispute-${market.marketId}` ? "Disputing..." : "Dispute Assertion"}
                            </button>
                          </div>
                        )}

                      {/* ── PHASE: VOTING ACTIVE ── */}
                      {(phase.phase === "voting-active" || phase.phase === "voting-ended" || (phase.phase === "disputed" && market.voting)) && market.assertion && market.voting && (
                        <div className="space-y-2">
                          <div className={`text-xs px-3 py-2 rounded ${dark("bg-red-900/30 text-red-300 border border-red-800", "bg-red-100 text-red-800 border border-red-300")}`}>
                            <div className="font-medium mb-0.5">
                              Claim disputed — token holders vote
                            </div>
                            <div>Claim: <span className="font-medium">{market.assertion.claimText}</span></div>
                            {phase.phase === "voting-active" && (
                              <div className="flex items-center gap-1 mt-1">
                                <Clock size={12} />
                                Voting closes in {formatCountdown((phase as any).remaining)}
                              </div>
                            )}
                            {phase.phase === "voting-ended" && (
                              <div className="mt-1 text-yellow-400">Voting ended — needs resolving</div>
                            )}
                          </div>

                          {/* Vote results */}
                          {(() => {
                            const total = market.voting.acceptWeight + market.voting.rejectWeight;
                            const acceptPct = total > BigInt(0) ? Number((market.voting.acceptWeight * BigInt(100)) / total) : 0;
                            const rejectPct = total > BigInt(0) ? Number((market.voting.rejectWeight * BigInt(100)) / total) : 0;
                            const assertionText = market.assertion.claimText;
                            const assertedOptionId = market.assertion.assertedOptionId;
                            const otherOptions = options.filter((_, idx) => idx + 1 !== Number(assertedOptionId));
                            const disputeText = otherOptions.length > 0 ? otherOptions[0] : "Reject assertion";
                            
                            return (
                              <div className="space-y-1">
                                <div className={`text-xs px-3 py-1.5 rounded flex justify-between ${market.voting.userHasVoted && market.voting.userVoteChoice === BigInt(1) ? dark("bg-[#39FF14]/10 border border-[#39FF14] text-[#39FF14]", "bg-green-100 border border-green-400 text-green-700") : dark("bg-gray-900 text-gray-300", "bg-gray-100 text-gray-700")}`}>
                                  <span>{assertionText} {market.voting.userHasVoted && market.voting.userVoteChoice === BigInt(1) && "✓"}</span>
                                  <span>{formatEther(market.voting.acceptWeight)} P2P ({acceptPct}%)</span>
                                </div>
                                <div className={`text-xs px-3 py-1.5 rounded flex justify-between ${market.voting.userHasVoted && market.voting.userVoteChoice === BigInt(2) ? dark("bg-[#39FF14]/10 border border-[#39FF14] text-[#39FF14]", "bg-green-100 border border-green-400 text-green-700") : dark("bg-gray-900 text-gray-300", "bg-gray-100 text-gray-700")}`}>
                                  <span>{disputeText} {market.voting.userHasVoted && market.voting.userVoteChoice === BigInt(2) && "✓"}</span>
                                  <span>{formatEther(market.voting.rejectWeight)} P2P ({rejectPct}%)</span>
                                </div>
                              </div>
                            );
                          })()}

                          {/* User stake display */}
                          {market.voting.userStakedBalance > BigInt(0) && (
                            <div className={`text-xs px-3 py-1.5 rounded ${dark("bg-gray-900 text-gray-300", "bg-gray-100 text-gray-700")}`}>
                              <Coins size={12} className="inline mr-1" />
                              Your stake: {formatEther(market.voting.userStakedBalance)} P2P
                            </div>
                          )}

                          {/* Stake to vote */}
                          {phase.phase === "voting-active" && !market.voting.userHasVoted && market.voting.userStakedBalance === BigInt(0) && (
                            <div className="space-y-1.5">
                              <p className={`text-xs ${dark("text-gray-400", "text-gray-600")}`}>
                                Step 1: Stake P2P tokens to vote
                              </p>
                              <input
                                type="number"
                                step="0.1"
                                min="0"
                                placeholder="Amount (P2P)"
                                value={stakeInputs[market.marketId] || ""}
                                onChange={(e) => setStakeInputs((p) => ({ ...p, [market.marketId]: e.target.value }))}
                                className={cls(
                                  "w-full px-3 py-1.5 rounded text-xs border",
                                  dark("bg-gray-800 border-gray-700 text-white", "bg-white border-gray-300 text-gray-900")
                                )}
                              />
                              
                              {/* Check if approval is needed */}
                              {(() => {
                                const stakeAmount = stakeInputs[market.marketId] 
                                  ? BigInt(Math.floor(parseFloat(stakeInputs[market.marketId]) * 1e18))
                                  : BigInt(0);
                                const needsApproval = votingAllowance === undefined || (stakeAmount > BigInt(0) && votingAllowance < stakeAmount);
                                
                                if (needsApproval && stakeAmount > BigInt(0)) {
                                return (
                                  <button
                                      onClick={() => handleApproveVoting(market.marketId)}
                                      disabled={pendingAction === `approve-voting-${market.marketId}` || isApproving}
                                      className={cls(
                                        "w-full py-1.5 px-3 rounded text-xs font-medium transition-colors",
                                        pendingAction === `approve-voting-${market.marketId}` || isApproving
                                          ? dark("bg-gray-800 text-gray-500 cursor-not-allowed", "bg-gray-300 text-gray-500 cursor-not-allowed")
                                          : "bg-blue-600 hover:bg-blue-700 text-white"
                                      )}
                                    >
                                      {pendingAction === `approve-voting-${market.marketId}` || isApproving ? "Approving..." : "Approve Voting Contract"}
                                    </button>
                                  );
                                }
                                
                                return (
                                  <button
                                    onClick={() => handleStakeForVoting(market.marketId)}
                                    disabled={pendingAction === `stake-${market.marketId}` || !stakeInputs[market.marketId] || needsApproval}
                                    className={cls(
                                      "w-full py-1.5 px-3 rounded text-xs font-medium transition-colors",
                                      !stakeInputs[market.marketId] || needsApproval || pendingAction === `stake-${market.marketId}`
                                        ? dark("bg-gray-800 text-gray-500 cursor-not-allowed", "bg-gray-300 text-gray-500 cursor-not-allowed")
                                        : dark("bg-[#39FF14] hover:bg-[#39FF14]/80 text-black", "bg-[#39FF14] hover:bg-[#39FF14]/80 text-black")
                                    )}
                                  >
                                    {pendingAction === `stake-${market.marketId}` ? "Staking..." : "Stake Tokens"}
                                  </button>
                                );
                              })()}
                            </div>
                          )}

                          {/* Vote buttons */}
                          {phase.phase === "voting-active" && market.voting.userStakedBalance > BigInt(0) && !market.voting.userHasVoted && (
                            <div className="space-y-1.5">
                              <label className={`block text-xs font-medium mb-1.5 ${dark("text-gray-300", "text-gray-700")}`}>
                                Cast your vote:
                              </label>
                              <div className="space-y-1.5">
                                {/* Assertion option (Accept) */}
                                <button
                                  onClick={() => {
                                    setSelectedVotes(prev => ({ ...prev, [market.marketId]: BigInt(1) }));
                                    handleVote(market.marketId, BigInt(1));
                                  }}
                                  disabled={pendingAction === `vote-${market.marketId}`}
                                  className={cls(
                                    "w-full text-left px-3 py-2 rounded text-xs border transition-colors",
                                    pendingAction === `vote-${market.marketId}`
                                      ? dark("bg-gray-800 text-gray-500 cursor-not-allowed border-gray-700", "bg-gray-200 text-gray-400 cursor-not-allowed border-gray-300")
                                      : selectedVotes[market.marketId] === BigInt(1)
                                        ? dark("border-[#39FF14] bg-[#39FF14]/10 text-[#39FF14]", "border-[#39FF14] bg-[#39FF14]/10 text-green-700")
                                        : dark("border-gray-700 hover:border-gray-600 text-white", "border-gray-300 hover:border-gray-400 text-gray-900")
                                  )}
                                  >
                                    <div className="flex items-center gap-2">
                                      <input
                                        type="radio"
                                      checked={selectedVotes[market.marketId] === BigInt(1)}
                                      onChange={() => setSelectedVotes(prev => ({ ...prev, [market.marketId]: BigInt(1) }))}
                                      className="w-3 h-3"
                                      disabled={pendingAction === `vote-${market.marketId}`}
                                    />
                                    <span>{market.assertion.claimText}</span>
                                    </div>
                                  </button>
                                
                                {/* Dispute option (Reject) */}
                                <button
                                  onClick={() => {
                                    setSelectedVotes(prev => ({ ...prev, [market.marketId]: BigInt(2) }));
                                    handleVote(market.marketId, BigInt(2));
                                  }}
                                  disabled={pendingAction === `vote-${market.marketId}`}
                                  className={cls(
                                    "w-full text-left px-3 py-2 rounded text-xs border transition-colors",
                                    pendingAction === `vote-${market.marketId}`
                                      ? dark("bg-gray-800 text-gray-500 cursor-not-allowed border-gray-700", "bg-gray-200 text-gray-400 cursor-not-allowed border-gray-300")
                                      : selectedVotes[market.marketId] === BigInt(2)
                                        ? dark("border-[#39FF14] bg-[#39FF14]/10 text-[#39FF14]", "border-[#39FF14] bg-[#39FF14]/10 text-green-700")
                                        : dark("border-gray-700 hover:border-gray-600 text-white", "border-gray-300 hover:border-gray-400 text-gray-900")
                                  )}
                                >
                                  <div className="flex items-center gap-2">
                                    <input
                                      type="radio"
                                      checked={selectedVotes[market.marketId] === BigInt(2)}
                                      onChange={() => setSelectedVotes(prev => ({ ...prev, [market.marketId]: BigInt(2) }))}
                                      className="w-3 h-3"
                                      disabled={pendingAction === `vote-${market.marketId}`}
                                    />
                                    <span>
                                      {(() => {
                                        const assertedOptionId = market.assertion.assertedOptionId;
                                        const otherOptions = options.filter((_, idx) => idx + 1 !== Number(assertedOptionId));
                                        return otherOptions.length > 0 ? otherOptions[0] : "Reject assertion";
                                      })()}
                                    </span>
                                  </div>
                                </button>
                              </div>
                            </div>
                          )}


                          {/* Settle button when voting ends */}
                          {phase.phase === "voting-ended" && (
                            <button
                              onClick={() => handleSettle(market.marketId)}
                              disabled={pendingAction === `settle-${market.marketId}`}
                              className={cls(
                                "w-full py-2 px-3 rounded text-sm font-medium transition-colors",
                                pendingAction === `settle-${market.marketId}`
                                  ? dark("bg-gray-800 text-gray-500 cursor-not-allowed", "bg-gray-300 text-gray-500 cursor-not-allowed")
                                  : "bg-blue-600 hover:bg-blue-700 text-white"
                              )}
                            >
                              {pendingAction === `settle-${market.marketId}` ? "Settling..." : "Settle Oracle"}
                            </button>
                          )}
                          </div>
                        )}

                      {/* ── PHASE: NO CONSENSUS ── */}
                      {phase.phase === "no-consensus" && market.assertion && (
                        <div className="space-y-2">
                          <div className={`text-xs px-3 py-2 rounded ${dark("bg-purple-900/30 text-purple-300 border border-purple-800", "bg-purple-100 text-purple-800 border border-purple-300")}`}>
                            <div className="font-medium mb-0.5">Voting: No Consensus</div>
                            <div>Participation too low. Oracle will accept the original assertion by default. Both bonds returned.</div>
                          </div>
                          <button
                            onClick={() => handleSettle(market.marketId)}
                            disabled={pendingAction === `settle-${market.marketId}`}
                            className="w-full py-2 px-3 rounded text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white transition-colors"
                          >
                            {pendingAction === `settle-${market.marketId}` ? "Settling..." : "Settle Oracle"}
                                  </button>
                      </div>
                    )}

                      {/* ── PHASE: READY TO SETTLE ── */}
                      {phase.phase === "ready-to-settle" && market.assertion && (
                        <div className="space-y-2">
                          <div className={`text-xs px-3 py-2 rounded ${dark("bg-green-900/30 text-green-300 border border-green-800", "bg-green-100 text-green-800 border border-green-300")}`}>
                            <div className="font-medium mb-0.5">Ready to Settle</div>
                            <div>Claim: {market.assertion.claimText}</div>
                            {market.assertion.disputer === "0x0000000000000000000000000000000000000000"
                              ? <div className="mt-1 opacity-70">Undisputed — asserter wins</div>
                              : <div className="mt-1 opacity-70">Disputed — vote result determines outcome</div>
                            }
                            </div>
                            <button
                            onClick={() => handleSettle(market.marketId)}
                            disabled={pendingAction === `settle-${market.marketId}`}
                            className="w-full py-2 px-3 rounded text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white transition-colors"
                          >
                            {pendingAction === `settle-${market.marketId}` ? "Settling..." : "Settle Oracle"}
                            </button>
                          </div>
                        )}

                      {/* ── PHASE: DISPUTED (vote data not loaded) ── */}
                      {phase.phase === "disputed" && market.assertion && !market.voting && (
                        <div className="space-y-2">
                          <div className={`text-xs px-3 py-2 rounded ${dark("bg-red-900/30 text-red-300 border border-red-800", "bg-red-100 text-red-800 border border-red-300")}`}>
                            <div className="font-medium mb-0.5">
                              <ShieldAlert size={12} className="inline mr-1" />
                              Claim disputed — loading voting data...
                            </div>
                            <div>Claim: <span className="font-medium">{market.assertion.claimText}</span></div>
                            <div className="mt-1 opacity-70">Asserted option: {options[market.assertion.assertedOptionId - 1] || `Option ${market.assertion.assertedOptionId}`}</div>
                          </div>
                          <button
                            onClick={() => fetchMarkets()}
                            className="w-full py-2 px-3 rounded text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white transition-colors"
                          >
                            Refresh to load voting
                          </button>
                      </div>
                    )}

                      {/* ── PHASE: SETTLED ── */}
                      {phase.phase === "settled" && market.assertion && (
                        <div className="space-y-2">
                          {market.assertion.result ? (
                            <div className={`text-xs px-3 py-2 rounded ${dark("bg-green-900/30 text-green-300 border border-green-800", "bg-green-100 text-green-800 border border-green-300")}`}>
                              <div className="font-medium mb-0.5">Oracle Accepted ✓</div>
                              <div>Winning option: <span className="font-medium">{options[market.assertion.assertedOptionId - 1] || `Option ${market.assertion.assertedOptionId}`}</span></div>
                            </div>
                          ) : (
                            <div className={`text-xs px-3 py-2 rounded ${dark("bg-red-900/30 text-red-300 border border-red-800", "bg-red-100 text-red-800 border border-red-300")}`}>
                              <div className="font-medium mb-0.5">Oracle Rejected — Market will cancel</div>
                              <div>Assertion was disputed and overturned. Stakers will receive refunds.</div>
                            </div>
                          )}
                          <button
                            onClick={() => handleResolve(market.marketId)}
                            disabled={pendingAction === `resolve-${market.marketId}`}
                            className={cls(
                              "w-full py-2 px-3 rounded text-sm font-medium transition-colors",
                              dark("bg-[#39FF14] hover:bg-[#39FF14]/80 text-black", "bg-[#39FF14] hover:bg-[#39FF14]/80 text-black")
                            )}
                          >
                            {pendingAction === `resolve-${market.marketId}`
                              ? "Resolving..."
                              : market.assertion.result
                                ? "Resolve Market"
                                : "Cancel Market (Issue Refunds)"}
                          </button>
                        </div>
                      )}

                      {/* ── FALLBACK: Unknown/Loading phase ── */}
                      {(phase.phase === "unknown" || phase.phase === "loading") && (
                        <div className={`text-xs px-3 py-2 rounded ${dark("bg-gray-900 text-gray-400", "bg-gray-100 text-gray-600")}`}>
                          {phase.phase === "loading" ? "Loading assertion data..." : "Unknown state"}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}