"use client";

import React, { useState, useEffect } from 'react';
import { 
  AlertCircle,
  CheckCircle,
  Clock,
  ChevronDown,
  ChevronUp,
  Sun,
  Moon,
  Menu,
  FileText,
  Loader2
} from 'lucide-react';
import { HeaderWallet } from '@/components/HeaderWallet';
import { useAccount, useReadContract, useWriteContract, usePublicClient, useBalance } from 'wagmi';
import { formatEther, stringToBytes, bytesToString, keccak256, encodePacked } from 'viem';
import { Sidebar } from '../components/Sidebar';
import { useTheme } from '../context/ThemeContext';
import { useRouter } from 'next/navigation';

const MARKET_MANAGER_ADDRESS = process.env.NEXT_PUBLIC_P2P_MARKET_MANAGER_ADDRESS as `0x${string}`;

const MARKET_MANAGER_ABI = [
  {
    "inputs": [{"name": "marketId", "type": "uint256"}],
    "name": "getMarket",
    "outputs": [
      {
        "components": [
          {"name": "creator", "type": "address"},
          {"name": "ipfsHash", "type": "string"},
          {"name": "isMultiOption", "type": "bool"},
          {"name": "maxOptions", "type": "uint256"},
          {"name": "paymentToken", "type": "address"},
          {"name": "minStake", "type": "uint256"},
          {"name": "creatorDeposit", "type": "uint256"},
          {"name": "creatorOutcome", "type": "uint256"},
          {"name": "startTime", "type": "uint256"},
          {"name": "stakeEndTime", "type": "uint256"},
          {"name": "endTime", "type": "uint256"},
          {"name": "resolutionEndTime", "type": "uint256"},
          {"name": "state", "type": "uint8"},
          {"name": "winningOption", "type": "uint256"},
          {"name": "isResolved", "type": "bool"},
          {"name": "marketType", "type": "uint8"},
          {"name": "priceFeed", "type": "address"},
          {"name": "priceThreshold", "type": "uint256"},
          {"name": "p2pAssertionId", "type": "bytes32"},
          {"name": "p2pAssertionMade", "type": "bool"}
        ],
        "name": "",
        "type": "tuple"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getNextMarketId",
    "outputs": [{"name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {"name": "marketId", "type": "uint256"},
      {"name": "claim", "type": "bytes"},
      {"name": "optionId", "type": "uint256"}
    ],
    "name": "requestP2PResolution",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{"name": "marketId", "type": "uint256"}],
    "name": "disputeOracle",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{"name": "marketId", "type": "uint256"}],
    "name": "settleOracle",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {"name": "marketId", "type": "uint256"}
    ],
    "name": "resolveP2PMarket",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "optimisticOracle",
    "outputs": [{"name": "", "type": "address"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "defaultBondCurrency",
    "outputs": [{"name": "", "type": "address"}],
    "stateMutability": "view",
    "type": "function"
  }
] as const;

const P2P_ORACLE_ABI = [
  {
    "inputs": [{"name": "assertionId", "type": "bytes32"}],
    "name": "getAssertion",
    "outputs": [
      {"name": "claim", "type": "bytes"},
      {"name": "asserter", "type": "address"},
      {"name": "disputer", "type": "address"},
      {"name": "assertionTime", "type": "uint256"},
      {"name": "assertionDeadline", "type": "uint256"},
      {"name": "expirationTime", "type": "uint256"},
      {"name": "settled", "type": "bool"},
      {"name": "result", "type": "bool"},
      {"name": "currency", "type": "address"},
      {"name": "bond", "type": "uint256"},
      {"name": "identifier", "type": "bytes32"},
      {"name": "ancillaryData", "type": "bytes"}
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"name": "currency", "type": "address"}],
    "name": "getMinimumBond",
    "outputs": [{"name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "defaultBondCurrency",
    "outputs": [{"name": "", "type": "address"}],
    "stateMutability": "view",
    "type": "function"
  }
] as const;

const ERC20_ABI = [
  {
    "inputs": [
      {"name": "owner", "type": "address"},
      {"name": "spender", "type": "address"}
    ],
    "name": "allowance",
    "outputs": [{"name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {"name": "spender", "type": "address"},
      {"name": "amount", "type": "uint256"}
    ],
    "name": "approve",
    "outputs": [{"name": "", "type": "bool"}],
    "stateMutability": "nonpayable",
    "type": "function"
  }
] as const;

const P2P_ORACLE_ABI_FULL = [
  ...P2P_ORACLE_ABI,
  {
    "inputs": [],
    "name": "voting",
    "outputs": [{"name": "", "type": "address"}],
    "stateMutability": "view",
    "type": "function"
  }
] as const;

const VOTING_ABI = [
  {
    "inputs": [{"name": "requestId", "type": "bytes32"}],
    "name": "requests",
    "outputs": [
      {"name": "identifier", "type": "bytes32"},
      {"name": "time", "type": "uint256"},
      {"name": "ancillaryData", "type": "bytes"},
      {"name": "deadline", "type": "uint256"},
      {"name": "totalVotes", "type": "uint256"},
      {"name": "resolved", "type": "bool"},
      {"name": "result", "type": "int256"}
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"name": "amount", "type": "uint256"}],
    "name": "stake",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {"name": "requestId", "type": "bytes32"},
      {"name": "price", "type": "int256"}
    ],
    "name": "vote",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{"name": "requestId", "type": "bytes32"}],
    "name": "resolveVote",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{"name": "voter", "type": "address"}],
    "name": "voterStakes",
    "outputs": [
      {"name": "stake", "type": "uint256"},
      {"name": "exists", "type": "bool"}
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {"name": "requestId", "type": "bytes32"},
      {"name": "voter", "type": "address"}
    ],
    "name": "hasVoted",
    "outputs": [{"name": "", "type": "bool"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {"name": "requestId", "type": "bytes32"},
      {"name": "price", "type": "int256"}
    ],
    "name": "voteCounts",
    "outputs": [{"name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  }
] as const;

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

interface AssertionTiming {
  assertionTime: bigint;
  assertionDeadline: bigint;
  expirationTime: bigint;
  settled: boolean;
  disputed: boolean;
  assertionWindowRemaining: number; // seconds
  disputeWindowRemaining: number; // seconds
  canSettle: boolean;
  canDispute: boolean;
}

interface VotingData {
  requestId: `0x${string}`;
  deadline: bigint;
  resolved: boolean;
  result: bigint;
  totalVotes: bigint;
  userStake: bigint;
  hasVoted: boolean;
  userVote: bigint | null;
  yesVotes: bigint;
  noVotes: bigint;
}

interface MarketWithMetadata extends MarketData {
  marketId: number;
  metadata?: any;
  loading?: boolean;
  assertionTiming?: AssertionTiming;
  votingData?: VotingData;
  currentAssertionClaim?: string; // The current assertion claim text
}

export default function AssertPage() {
  const { isDarkMode, toggleTheme } = useTheme();
  const { address, isConnected } = useAccount();
  const { writeContract } = useWriteContract();
  const publicClient = usePublicClient();
  const router = useRouter();
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [expandedMarketId, setExpandedMarketId] = useState<number | null>(null);
  const [selectedOptions, setSelectedOptions] = useState<Record<number, number>>({});
  const [winningOptions, setWinningOptions] = useState<Record<number, string>>({});
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [markets, setMarkets] = useState<MarketWithMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState<bigint>(BigInt(0));
  const [isApproving, setIsApproving] = useState(false);
  const [votingStakeAmounts, setVotingStakeAmounts] = useState<Record<number, string>>({});

  // Fetch P2P Oracle configuration
  const { data: optimisticOracle, isLoading: isLoadingOracle } = useReadContract({
    address: MARKET_MANAGER_ADDRESS,
    abi: MARKET_MANAGER_ABI,
    functionName: 'optimisticOracle',
  });

  const { data: defaultBondCurrency } = useReadContract({
    address: MARKET_MANAGER_ADDRESS,
    abi: MARKET_MANAGER_ABI,
    functionName: 'defaultBondCurrency',
    query: {
      enabled: !!optimisticOracle,
    },
  });

  const { data: minimumBond } = useReadContract({
    address: optimisticOracle as `0x${string}`,
    abi: P2P_ORACLE_ABI,
    functionName: 'getMinimumBond',
    args: [defaultBondCurrency as `0x${string}`],
    query: {
      enabled: !!optimisticOracle && !!defaultBondCurrency,
    },
  });

  const { data: bondBalance } = useBalance({
    address: address,
    token: defaultBondCurrency as `0x${string}`,
    query: {
      enabled: !!address && !!defaultBondCurrency,
    },
  });

  // Check token allowance - User must approve MarketManager (oracle bug: uses msg.sender not asserter)
  // MarketManager will pull tokens from user, then approve oracle
  const { data: tokenAllowance, refetch: refetchAllowance } = useReadContract({
    address: defaultBondCurrency as `0x${string}`,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: address && MARKET_MANAGER_ADDRESS && defaultBondCurrency 
      ? [address, MARKET_MANAGER_ADDRESS] // user approves MarketManager
      : undefined,
    query: {
      enabled: !!address && !!MARKET_MANAGER_ADDRESS && !!defaultBondCurrency,
    },
  });

  // Fetch markets function (can be called to refetch)
  const fetchMarkets = React.useCallback(async () => {
      if (!publicClient) return;
      
      setLoading(true);
      try {
        // Get next market ID
        const nextMarketId = await publicClient.readContract({
          address: MARKET_MANAGER_ADDRESS,
          abi: MARKET_MANAGER_ABI,
          functionName: 'getNextMarketId',
        });

        const totalMarkets = Number(nextMarketId);
        const endedMarkets: MarketWithMetadata[] = [];

        // Fetch all markets and filter for Ended + UMA_MANUAL
        console.log(`🔍 Checking ${totalMarkets - 1} markets for assert page...`);
        for (let i = 1; i < totalMarkets; i++) {
          try {
            const marketData = await publicClient.readContract({
              address: MARKET_MANAGER_ADDRESS,
              abi: MARKET_MANAGER_ABI,
              functionName: 'getMarket',
              args: [BigInt(i)],
            }) as MarketData;

            // Debug logging for market 4 specifically
            if (i === 4) {
              console.log(`📊 Market 4 details:`, {
                state: marketData.state,
                marketType: marketData.marketType,
                endTime: marketData.endTime.toString(),
                currentTime: Date.now() / 1000,
                isEnded: marketData.state === 1,
                isP2P: marketData.marketType === 1,
                willShow: marketData.state === 1 && marketData.marketType === 1
              });
            }

            // Filter: state === 1 (Ended) and marketType === 1 (P2POPTIMISTIC)
            if (marketData.state === 1 && marketData.marketType === 1) {
              console.log(`✅ Market ${i} passed filter (Ended + P2POPTIMISTIC)`);
              // Fetch metadata
              let metadata = null;
              try {
                const response = await fetch(`https://gateway.lighthouse.storage/ipfs/${marketData.ipfsHash}`);
                if (response.ok) {
                  metadata = await response.json();
                }
              } catch (e) {
                console.error(`Error fetching metadata for market ${i}:`, e);
              }

              // Fetch assertion timing if assertion was made
              let assertionTiming: AssertionTiming | undefined = undefined;
              let currentAssertionClaim: string | undefined = undefined;
              let votingData: VotingData | undefined = undefined;
              if (marketData.p2pAssertionMade && marketData.p2pAssertionId && optimisticOracle) {
                try {
                  const assertionData = await publicClient.readContract({
                    address: optimisticOracle as `0x${string}`,
                    abi: P2P_ORACLE_ABI,
                    functionName: 'getAssertion',
                    args: [marketData.p2pAssertionId],
                  }) as readonly [`0x${string}`, `0x${string}`, `0x${string}`, bigint, bigint, bigint, boolean, boolean, `0x${string}`, bigint, `0x${string}`, `0x${string}`];
                  
                  const block = await publicClient.getBlock({ blockTag: 'latest' });
                  const now = BigInt(block.timestamp);
                  
                  // getAssertion returns: claim, asserter, disputer, assertionTime, assertionDeadline, expirationTime, settled, result, currency, bond, identifier, ancillaryData
                  const claimBytes = assertionData[0];
                  const disputer = assertionData[2];
                  const assertionTime = assertionData[3];
                  const assertionDeadline = assertionData[4];
                  const expirationTime = assertionData[5];
                  const settled = assertionData[6];
                  const disputed = disputer !== '0x0000000000000000000000000000000000000000';
                  
                  // Decode claim bytes to text
                  try {
                    // claimBytes from contract is hex string, convert to bytes array then decode
                    if (typeof claimBytes === 'string') {
                      // Remove 0x prefix and convert hex to bytes
                      const hex = claimBytes.startsWith('0x') ? claimBytes.slice(2) : claimBytes;
                      const bytes = new Uint8Array(hex.length / 2);
                      for (let i = 0; i < hex.length; i += 2) {
                        bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
                      }
                      currentAssertionClaim = bytesToString(bytes);
                    } else {
                      // Already bytes array
                      currentAssertionClaim = bytesToString(claimBytes as any);
                    }
                  } catch (e) {
                    console.error('Error decoding claim:', e, 'claimBytes:', claimBytes);
                    currentAssertionClaim = 'Unknown';
                  }
                  
                  // Store the deadline/expiration times, we'll calculate remaining dynamically
                  assertionTiming = {
                    assertionTime,
                    assertionDeadline,
                    expirationTime,
                    settled,
                    disputed,
                    // These will be calculated dynamically based on currentTime
                    assertionWindowRemaining: 0,
                    disputeWindowRemaining: 0,
                    canSettle: false,
                    canDispute: false,
                  };
                  
                  // If disputed, fetch voting data
                  if (disputed && optimisticOracle) {
                    try {
                      // Get voting contract address
                      const votingAddress = await publicClient.readContract({
                        address: optimisticOracle as `0x${string}`,
                        abi: P2P_ORACLE_ABI_FULL,
                        functionName: 'voting',
                      }) as `0x${string}`;
                      
                      // Calculate request ID: keccak256(abi.encodePacked(identifier, time, ancillaryData))
                      const identifier = assertionData[10];
                      const ancillaryData = assertionData[11];
                      const requestId = keccak256(
                        encodePacked(
                          ['bytes32', 'uint256', 'bytes'],
                          [identifier, assertionTime, ancillaryData]
                        )
                      ) as `0x${string}`;
                      
                      // Fetch vote request
                      // Returns: identifier, time, ancillaryData, deadline, totalVotes, resolved, result
                      const voteRequest = await publicClient.readContract({
                        address: votingAddress,
                        abi: VOTING_ABI,
                        functionName: 'requests',
                        args: [requestId],
                      }) as readonly [`0x${string}`, bigint, `0x${string}`, bigint, bigint, boolean, bigint];
                      
                      const deadline = voteRequest[3]; // deadline
                      const totalVotes = voteRequest[4]; // totalVotes
                      const resolved = voteRequest[5]; // resolved
                      const result = voteRequest[6]; // result
                      
                      // Get vote counts (always fetch)
                      const yesVotes = await publicClient.readContract({
                        address: votingAddress,
                        abi: VOTING_ABI,
                        functionName: 'voteCounts',
                        args: [requestId, BigInt(1)],
                      }) as bigint;
                      
                      const noVotes = await publicClient.readContract({
                        address: votingAddress,
                        abi: VOTING_ABI,
                        functionName: 'voteCounts',
                        args: [requestId, BigInt(0)],
                      }) as bigint;
                      
                      // Fetch user's stake and vote status
                      let userStake = BigInt(0);
                      let hasVoted = false;
                      
                      if (address) {
                        const voterStake = await publicClient.readContract({
                          address: votingAddress,
                          abi: VOTING_ABI,
                          functionName: 'voterStakes',
                          args: [address],
                        }) as readonly [bigint, boolean];
                        userStake = voterStake[0];
                        
                        hasVoted = await publicClient.readContract({
                          address: votingAddress,
                          abi: VOTING_ABI,
                          functionName: 'hasVoted',
                          args: [requestId, address],
                        }) as boolean;
                      }
                      
                      votingData = {
                        requestId,
                        deadline,
                        resolved,
                        result,
                        totalVotes,
                        userStake,
                        hasVoted,
                        userVote: null,
                        yesVotes,
                        noVotes,
                      };
                    } catch (e) {
                      console.error(`Error fetching voting data for market ${i}:`, e);
                    }
                  }
                } catch (e) {
                  console.error(`Error fetching assertion timing for market ${i}:`, e);
                }
              }

              endedMarkets.push({
                ...marketData,
                marketId: i,
                metadata,
                assertionTiming,
                votingData,
                currentAssertionClaim,
              });
            }
          } catch (e) {
            // Market might not exist, skip
            continue;
          }
        }

      console.log(`📊 Found ${endedMarkets.length} ended P2POPTIMISTIC markets:`, endedMarkets.map(m => m.marketId));
        setMarkets(endedMarkets);
      } catch (error) {
        console.error('Error fetching markets:', error);
        setError('Failed to load markets');
      } finally {
        setLoading(false);
      }
  }, [publicClient, optimisticOracle, address]);

  // Initial fetch - also refetch when optimisticOracle loads
  useEffect(() => {
    if (publicClient) {
      fetchMarkets();
    }
  }, [fetchMarkets, publicClient, optimisticOracle]);

  // Update current time every second for countdown timers
  useEffect(() => {
    // Initial fetch from blockchain
    const fetchBlockTime = async () => {
      if (!publicClient) return;
      try {
        const block = await publicClient.getBlock({ blockTag: 'latest' });
        setCurrentTime(BigInt(block.timestamp));
      } catch (e) {
        console.error('Error fetching block time:', e);
        // Fallback to local time if blockchain fetch fails
        setCurrentTime(BigInt(Math.floor(Date.now() / 1000)));
      }
    };
    
    // Fetch block time initially and every 30 seconds to sync
    fetchBlockTime();
    const blockTimeInterval = setInterval(fetchBlockTime, 30000);
    
    // Update local time every second (faster updates for countdown)
    const localTimeInterval = setInterval(() => {
      setCurrentTime(prev => {
        // Increment by 1 second if we have a valid time
        if (prev > BigInt(0)) {
          return prev + BigInt(1);
        }
        // Otherwise use current timestamp
        return BigInt(Math.floor(Date.now() / 1000));
      });
    }, 1000);
    
    return () => {
      clearInterval(blockTimeInterval);
      clearInterval(localTimeInterval);
    };
  }, [publicClient]);

  const handleApproveToken = async () => {
    if (!isConnected || !address || !optimisticOracle || !defaultBondCurrency || !minimumBond) {
      setError('Missing required data for approval');
      return;
    }

    setIsApproving(true);
    setError('');
    try {
      // Approve max uint256 to avoid needing multiple approvals
      // User approves MarketManager (oracle bug: MarketManager pulls tokens, then approves oracle)
      const maxApproval = BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff');
      console.log('🔐 Approving tokens:', {
        token: defaultBondCurrency,
        spender: MARKET_MANAGER_ADDRESS, // MarketManager needs approval
        user: address,
        amount: maxApproval.toString(),
      });
      await writeContract({
        address: defaultBondCurrency as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [MARKET_MANAGER_ADDRESS, maxApproval], // Approve MarketManager
        gas: BigInt(300000), // Gas limit for approval
      });
      setSuccess('Approval transaction submitted...');
      // Refetch allowance after a delay
      setTimeout(() => {
        refetchAllowance();
      }, 3000);
    } catch (err: any) {
      console.error('Approval error:', err);
      setError(err.message || 'Failed to approve tokens');
      setSuccess('');
    } finally {
      setIsApproving(false);
    }
  };

  const handleMakeAssertion = async (marketId: number) => {
    if (!isConnected || !address) {
      setError('Please connect your wallet');
      return;
    }

    if (!optimisticOracle || !defaultBondCurrency || !minimumBond) {
      setError('Oracle configuration not loaded');
      return;
    }

    const market = markets.find(m => m.marketId === marketId);
    if (!market || !market.metadata) {
      setError('Market data not loaded');
      return;
    }

    // Check if user is the creator (creators cannot make assertions)
    if (address && market.creator && address.toLowerCase() === market.creator.toLowerCase()) {
      setError('Market creators cannot make assertions on their own markets');
      return;
    }

    const selectedOption = selectedOptions[marketId] || 0;
    if (selectedOption === 0) {
      setError('Please select an option');
      return;
    }

    // Check if user has sufficient balance
    if (!bondBalance || bondBalance.value < minimumBond) {
      setError(`Insufficient P2P balance. Required: ${formatEther(minimumBond)} P2P`);
      return;
    }

    // Check if user has sufficient allowance
    console.log('Checking allowance:', {
      userAddress: address,
      tokenAllowance: tokenAllowance?.toString(),
      minimumBond: minimumBond.toString(),
      hasEnough: tokenAllowance && tokenAllowance >= minimumBond,
      optimisticOracle: optimisticOracle,
    });
    if (!tokenAllowance || tokenAllowance < minimumBond) {
      setError(`Please approve P2P tokens first. The connected wallet (${address?.slice(0, 6)}...${address?.slice(-4)}) needs to approve the OptimisticOracle contract.`);
      return;
    }

    // Encode option text as bytes (e.g., "Yes", "No", "Option 1")
    const options = market.metadata.options || (market.isMultiOption ? [] : ['Yes', 'No']);
    const selectedOptionText = options[selectedOption - 1];
    const claimText = selectedOptionText || `Option ${selectedOption} wins`;
    
    setPendingAction(`assert-${marketId}`);
    setError(''); // Clear any previous errors
    try {
      // Use viem's stringToBytes to encode the option text, then convert to hex
      const claimBytes = stringToBytes(claimText);
      // Convert ByteArray to hex string for contract
      const claimBytesHex = `0x${Array.from(claimBytes).map(b => b.toString(16).padStart(2, '0')).join('')}` as `0x${string}`;
      await writeContract({
        address: MARKET_MANAGER_ADDRESS,
        abi: MARKET_MANAGER_ABI,
        functionName: 'requestP2PResolution',
        args: [BigInt(marketId), claimBytesHex, BigInt(selectedOption)],
        gas: BigInt(500000), // Gas limit for assertion
      });
      
      setSuccess('Assertion submitted! Waiting for confirmation...');
      setSelectedOptions(prev => ({ ...prev, [marketId]: 0 }));
      setPendingAction(null);
      // Don't refetch immediately - let user see the success message
    } catch (err: any) {
      console.error('Assertion error:', err);
      
      // Don't show error if user rejected the transaction
      const errorMessage = err.message || err.toString() || '';
      if (errorMessage.includes('User rejected') || 
          errorMessage.includes('User denied') || 
          errorMessage.includes('rejected the request') ||
          errorMessage.includes('4001')) {
        // User rejected - just clear state, don't show error
        setError('');
        setSuccess('');
        setPendingAction(null);
        return;
      }
      
      setError(err.message || 'Failed to make assertion');
      setSuccess('');
      setPendingAction(null);
    }
  };

  const handleDisputeOracle = async (marketId: number) => {
    if (!isConnected || !address) {
      setError('Please connect your wallet');
      return;
    }

    if (!optimisticOracle || !defaultBondCurrency || !minimumBond) {
      setError('Oracle configuration not loaded');
      return;
    }

    // Check if user has sufficient balance
    if (!bondBalance || bondBalance.value < minimumBond) {
      setError(`Insufficient P2P balance. Required: ${formatEther(minimumBond)} P2P`);
      return;
    }

    // Check if user has sufficient allowance
    console.log('Checking allowance for dispute:', {
      userAddress: address,
      tokenAllowance: tokenAllowance?.toString(),
      minimumBond: minimumBond.toString(),
      hasEnough: tokenAllowance && tokenAllowance >= minimumBond,
    });
    if (!tokenAllowance || tokenAllowance < minimumBond) {
      setError(`Please approve P2P tokens first. The connected wallet (${address?.slice(0, 6)}...${address?.slice(-4)}) needs to approve the MarketManager contract.`);
      return;
    }

    setPendingAction(`dispute-${marketId}`);
    setError(''); // Clear any previous errors
    try {
      await writeContract({
        address: MARKET_MANAGER_ADDRESS,
        abi: MARKET_MANAGER_ABI,
        functionName: 'disputeOracle',
        args: [BigInt(marketId)],
        gas: BigInt(500000), // Gas limit for dispute
      });
      
      setSuccess('Dispute submitted! Waiting for confirmation...');
      setPendingAction(null);
      // Don't refetch immediately - let user see the success message
    } catch (err: any) {
      console.error('Dispute error:', err);
      
      // Don't show error if user rejected the transaction
      const errorMessage = err.message || err.toString() || '';
      if (errorMessage.includes('User rejected') || 
          errorMessage.includes('User denied') || 
          errorMessage.includes('rejected the request') ||
          errorMessage.includes('4001')) {
        // User rejected - just clear state, don't show error
        setError('');
        setSuccess('');
        setPendingAction(null);
        return;
      }

      setError(err.message || 'Failed to dispute assertion');
      setSuccess('');
      setPendingAction(null);
    }
  };

  const formatTimeRemaining = (seconds: number): string => {
    if (seconds <= 0) return 'Expired';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  };

  const handleStakeForVoting = async (marketId: number) => {
    if (!isConnected || !address || !optimisticOracle) {
      setError('Please connect your wallet');
      return;
    }

    const market = markets.find(m => m.marketId === marketId);
    if (!market || !market.votingData) {
      setError('Voting data not available');
      return;
    }

    const stakeAmountStr = votingStakeAmounts[marketId] || '0';
    const stakeAmount = BigInt(Math.floor(parseFloat(stakeAmountStr) * 1e18));
    
    if (stakeAmount <= 0) {
      setError('Please enter a valid stake amount');
      return;
    }

    if (!bondBalance || bondBalance.value < stakeAmount) {
      setError(`Insufficient balance. You have ${formatEther(bondBalance?.value || BigInt(0))} P2P`);
      return;
    }

    // Get voting contract address
    const votingAddress = await publicClient?.readContract({
      address: optimisticOracle as `0x${string}`,
      abi: P2P_ORACLE_ABI_FULL,
      functionName: 'voting',
    }) as `0x${string}`;

    // Approve voting contract
    const approveTx = await writeContract({
      address: defaultBondCurrency as `0x${string}`,
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [votingAddress, stakeAmount],
    });

    setPendingAction(`stake-${marketId}`);
    setError('');
    try {
      await writeContract({
        address: votingAddress,
        abi: VOTING_ABI,
        functionName: 'stake',
        args: [stakeAmount],
        gas: BigInt(300000),
      });
      
      setSuccess('Staked successfully!');
      setVotingStakeAmounts(prev => ({ ...prev, [marketId]: '' }));
      setPendingAction(null);
      setTimeout(() => fetchMarkets(), 3000);
    } catch (err: any) {
      if (!err.message?.includes('User rejected') && !err.message?.includes('4001')) {
        setError(err.message || 'Failed to stake');
      }
      setPendingAction(null);
    }
  };

  const handleVote = async (marketId: number, voteValue: bigint) => {
    if (!isConnected || !address || !optimisticOracle) {
      setError('Please connect your wallet');
      return;
    }

    const market = markets.find(m => m.marketId === marketId);
    if (!market || !market.votingData) {
      setError('Voting data not available');
      return;
    }

    if (market.votingData.hasVoted) {
      setError('You have already voted');
      return;
    }

    if (market.votingData.userStake <= 0) {
      setError('You must stake tokens before voting');
      return;
    }

    const votingAddress = await publicClient?.readContract({
      address: optimisticOracle as `0x${string}`,
      abi: P2P_ORACLE_ABI_FULL,
      functionName: 'voting',
    }) as `0x${string}`;

    setPendingAction(`vote-${marketId}`);
    setError('');
    try {
      await writeContract({
        address: votingAddress,
        abi: VOTING_ABI,
        functionName: 'vote',
        args: [market.votingData!.requestId, voteValue],
        gas: BigInt(300000),
      });
      
      setSuccess('Vote submitted!');
      setPendingAction(null);
      setTimeout(() => fetchMarkets(), 3000);
    } catch (err: any) {
      if (!err.message?.includes('User rejected') && !err.message?.includes('4001')) {
        setError(err.message || 'Failed to vote');
      }
      setPendingAction(null);
    }
  };

  const handleSettleOracle = async (marketId: number) => {
    if (!isConnected || !address) {
      setError('Please connect your wallet');
      return;
    }

    setPendingAction(`settle-${marketId}`);
    setError(''); // Clear any previous errors
    try {
      await writeContract({
        address: MARKET_MANAGER_ADDRESS,
        abi: MARKET_MANAGER_ABI,
        functionName: 'settleOracle',
        args: [BigInt(marketId)],
        gas: BigInt(300000), // Gas limit for settle
      });
      
      setSuccess('Oracle settlement submitted! Waiting for confirmation...');
      setPendingAction(null);
      // Don't refetch immediately - let user see the success message
    } catch (err: any) {
      console.error('Settle error:', err);
      
      // Don't show error if user rejected the transaction
      const errorMessage = err.message || err.toString() || '';
      if (errorMessage.includes('User rejected') || 
          errorMessage.includes('User denied') || 
          errorMessage.includes('rejected the request') ||
          errorMessage.includes('4001')) {
        // User rejected - just clear state, don't show error
      setError('');
        setSuccess('');
        setPendingAction(null);
        return;
      }
      
      setError(err.message || 'Failed to settle oracle');
      setSuccess('');
      setPendingAction(null);
    }
  };

  const handleResolveMarket = async (marketId: number) => {
    if (!isConnected || !address) {
      setError('Please connect your wallet');
      return;
    }

    // Contract auto-resolves using optionId from oracle, no need to select option
    setPendingAction(`resolve-${marketId}`);
    setError(''); // Clear any previous errors
    try {
      await writeContract({
        address: MARKET_MANAGER_ADDRESS,
        abi: MARKET_MANAGER_ABI,
        functionName: 'resolveP2PMarket',
        args: [BigInt(marketId)],
        gas: BigInt(400000), // Gas limit for resolve
      });
      
      setSuccess('Market resolution submitted! Waiting for confirmation...');
      setPendingAction(null);
      // Don't refetch immediately - let user see the success message
    } catch (err: any) {
      console.error('Resolve error:', err);
      
      // Don't show error if user rejected the transaction
      const errorMessage = err.message || err.toString() || '';
      if (errorMessage.includes('User rejected') || 
          errorMessage.includes('User denied') || 
          errorMessage.includes('rejected the request') ||
          errorMessage.includes('4001')) {
        // User rejected - just clear state, don't show error
        setError('');
      setSuccess('');
        setPendingAction(null);
        return;
      }
      
      setError(err.message || 'Failed to resolve market');
      setSuccess('');
      setPendingAction(null);
    }
  };

  const toggleExpand = (marketId: number) => {
    if (expandedMarketId === marketId) {
      setExpandedMarketId(null);
    } else {
      setExpandedMarketId(marketId);
    }
  };

  const isP2POracleConfigured = optimisticOracle && optimisticOracle !== '0x0000000000000000000000000000000000000000' && optimisticOracle !== '0x';

  return (
    <div className={`min-h-screen ${isDarkMode ? 'bg-black' : 'bg-[#F5F3F0]'}`}>
      <Sidebar 
        isOpen={sidebarOpen} 
        onClose={() => setSidebarOpen(false)} 
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        isDarkMode={isDarkMode}
      />

      <div className={`transition-all duration-300 lg:${sidebarCollapsed ? 'ml-16' : 'ml-64'}`}>
        <header className={`sticky top-0 z-30 border-b backdrop-blur-sm ${isDarkMode ? 'bg-black border-[#39FF14]/20' : 'bg-[#F5F3F0] border-gray-200'}`}>
          <div className="px-4 lg:px-6 py-1.5 lg:py-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setSidebarOpen(true)}
                  className={`lg:hidden p-2 rounded-lg transition-colors ${isDarkMode ? 'hover:bg-[#39FF14]/10 text-white' : 'hover:bg-gray-200'}`}
                >
                  <Menu size={20} className={isDarkMode ? 'text-white' : 'text-gray-900'} />
                </button>
                
                <div className="hidden lg:block">
                  <h1 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    Resolve Markets
                  </h1>
                  <p className={`text-sm ${isDarkMode ? 'text-white/70' : 'text-gray-600'}`}>
                    Assert outcomes for ended markets that require manual resolution
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-2 lg:gap-4">
                <button
                  onClick={toggleTheme}
                  className={`p-1.5 lg:p-2 rounded-lg transition-colors ${isDarkMode ? 'hover:bg-[#39FF14]/10 text-white' : 'hover:bg-gray-200'}`}
                >
                  {isDarkMode ? <Sun className="w-4 h-4 lg:w-5 lg:h-5 text-white" /> : <Moon className="w-4 h-4 lg:w-5 lg:h-5 text-gray-600" />}
                </button>
                
                <HeaderWallet isDarkMode={isDarkMode} />
              </div>
            </div>
          </div>
        </header>

        <main className="p-4 lg:p-6">
          {/* Mobile Header */}
          <div className="lg:hidden mb-6">
            <h1 className={`text-2xl font-bold mb-1 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              Resolve Markets
            </h1>
            <p className={`text-sm ${isDarkMode ? 'text-white/70' : 'text-gray-600'}`}>
              Assert outcomes for ended markets that require manual resolution
            </p>
          </div>

          {error && (
            <div className={`mb-6 p-4 rounded-lg border flex items-center gap-3 ${
              isDarkMode ? 'bg-red-900/20 border-red-800 text-red-300' : 'bg-red-50 border-red-200 text-red-800'
            }`}>
              <AlertCircle size={20} className="flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className={`mb-6 p-4 rounded-lg border flex items-center gap-3 ${
              isDarkMode ? 'bg-green-900/20 border-green-800 text-green-300' : 'bg-green-50 border-green-200 text-green-800'
            }`}>
              <CheckCircle size={20} className="flex-shrink-0" />
              <span>{success}</span>
            </div>
          )}

          {!isLoadingOracle && !isP2POracleConfigured && (
            <div className={`mb-6 p-4 rounded-lg border flex items-start gap-3 ${
              isDarkMode ? 'bg-yellow-900/20 border-yellow-800 text-yellow-300' : 'bg-yellow-50 border-yellow-200 text-yellow-800'
            }`}>
              <AlertCircle size={20} className="flex-shrink-0 mt-0.5" />
              <div>
                <div className="font-medium mb-1">Optimistic Oracle Not Configured</div>
                <p className="text-sm opacity-90">
                  Optimistic Oracle is not configured. Please configure it first.
                </p>
              </div>
            </div>
          )}

          {loading ? (
            <div className={`flex flex-col items-center justify-center py-20 ${isDarkMode ? 'text-white/70' : 'text-gray-600'}`}>
              <Loader2 className="w-8 h-8 animate-spin mb-4" />
              <p className="text-lg">Loading markets...</p>
            </div>
          ) : markets.length === 0 ? (
            <div className={`flex flex-col items-center justify-center py-20 ${isDarkMode ? 'text-white/70' : 'text-gray-600'}`}>
              <FileText className="w-16 h-16 mb-4 opacity-50" />
              <h3 className="text-xl font-semibold mb-2">No Markets to Resolve</h3>
              <p className="text-center max-w-md">
                There are currently no ended P2P Optimistic Oracle markets waiting for resolution.
              </p>
            </div>
          ) : (
            <div className={`grid gap-4 transition-all duration-300 ${
              sidebarCollapsed 
                ? 'sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5' 
                : 'sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3'
            }`}>
              {markets.map((market) => {
                const isExpanded = expandedMarketId === market.marketId;
                const options = market.metadata?.options || (market.isMultiOption ? [] : ['Yes', 'No']);

                return (
                  <div
                    key={market.marketId}
                    className={`w-full max-w-sm border rounded-xl overflow-hidden transition-all duration-200 hover:shadow-lg flex flex-col ${
                      isDarkMode 
                        ? 'bg-black border-gray-800 hover:border-[#39FF14]/30 hover:shadow-[#39FF14]/20 hover:bg-gray-900/50' 
                        : 'bg-[#F5F3F0] border-gray-300 hover:shadow-gray-900/20'
                      }`}
                    >
                    <div className="p-4 flex flex-col">
                      <div className="flex items-start justify-between gap-3 mb-3 flex-shrink-0">
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          {market.metadata?.imageUrl && (
                            <div className="flex-shrink-0">
                              <img
                                src={market.metadata.imageUrl}
                                alt=""
                                className={`w-12 h-12 rounded-lg object-cover border ${isDarkMode ? 'border-gray-800' : 'border-gray-400'}`}
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none';
                                }}
                              />
                        </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <h3 
                              onClick={() => router.push(`/market/${market.marketId}`)}
                              className={`font-semibold text-base leading-tight cursor-pointer hover:underline transition-all ${
                                isDarkMode ? 'text-white hover:text-[#39FF14]' : 'text-gray-900 hover:text-[#39FF14]'
                              }`}
                            >
                              {market.metadata?.title || 'Loading...'}
                            </h3>
                            <div className="flex items-center gap-1.5 mt-1">
                              <span className={`text-xs px-1.5 py-0.5 rounded ${isDarkMode ? 'bg-gray-900 text-gray-300' : 'bg-gray-200 text-gray-600'}`}>
                                #{market.marketId}
                              </span>
                              {!market.p2pAssertionMade && (
                                <span className={`text-xs px-1.5 py-0.5 rounded ${isDarkMode ? 'text-yellow-400' : 'text-yellow-600'}`}>
                                  No assertion
                                </span>
                              )}
                              {market.assertionTiming?.settled && (
                                <span className={`text-xs px-1.5 py-0.5 rounded ${isDarkMode ? 'text-green-400' : 'text-green-600'}`}>
                                  Ready
                                </span>
                              )}
                                </div>
                            </div>
                          </div>
                      </div>

                      {!market.p2pAssertionMade && (() => {
                        // Check if user is the creator
                        const isCreator = address && market.creator && address.toLowerCase() === market.creator.toLowerCase();
                        
                        if (isCreator) {
                          return (
                            <div className="flex-shrink-0 mt-auto">
                              <div className={`text-xs px-3 py-2 rounded mb-2 ${isDarkMode ? 'bg-yellow-900/30 text-yellow-400 border border-yellow-800' : 'bg-yellow-100 text-yellow-800 border border-yellow-300'}`}>
                                <div className="font-medium mb-0.5">Creator Restriction</div>
                                <div>Market creators cannot make assertions on their own markets.</div>
                              </div>
                            </div>
                          );
                        }
                        
                        return (
                          <div className="flex-shrink-0 mt-auto">
                            <div className="space-y-2 mb-3">
                              {options.map((option: string, index: number) => {
                                const optionNum = index + 1;
                              const isSelected = (selectedOptions[market.marketId] || 0) === optionNum;
                                return (
                                  <button
                                    key={index}
                                  onClick={() => setSelectedOptions(prev => ({ ...prev, [market.marketId]: optionNum }))}
                                  className={`w-full text-left px-3 py-2 rounded text-sm border transition-colors ${
                                      isSelected
                                        ? isDarkMode 
                                          ? 'border-[#39FF14] bg-[#39FF14]/10 text-[#39FF14]' 
                                        : 'border-[#39FF14] bg-[#39FF14]/10 text-green-700'
                                        : isDarkMode
                                          ? 'border-gray-700 hover:border-gray-600 text-white'
                                          : 'border-gray-300 hover:border-gray-400 text-gray-900'
                                    }`}
                                  >
                                    <div className="flex items-center gap-2">
                                      <input
                                        type="radio"
                                        checked={isSelected}
                                      onChange={() => setSelectedOptions(prev => ({ ...prev, [market.marketId]: optionNum }))}
                                      className="w-3 h-3"
                                      />
                                    <span className="text-xs">{option}</span>
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          {minimumBond && (
                            <div className={`text-xs mb-2 px-3 py-1.5 rounded ${isDarkMode ? 'bg-gray-900 text-gray-400' : 'bg-gray-100 text-gray-600'}`}>
                              Required bond: {formatEther(minimumBond)} P2P
                            </div>
                          )}
                          {bondBalance && minimumBond && (
                            <div className={`text-xs mb-2 px-3 py-1.5 rounded ${
                              bondBalance.value >= minimumBond
                                ? (isDarkMode ? 'bg-green-900/30 text-green-400' : 'bg-green-100 text-green-600')
                                : (isDarkMode ? 'bg-red-900/30 text-red-400' : 'bg-red-100 text-red-600')
                            }`}>
                              Your balance: {formatEther(bondBalance.value)} P2P
                              {bondBalance.value < minimumBond && ' (Insufficient)'}
                            </div>
                          )}
                          {tokenAllowance !== undefined && minimumBond && (
                            <div className={`text-xs mb-2 px-3 py-1.5 rounded ${
                              tokenAllowance >= minimumBond
                                ? (isDarkMode ? 'bg-green-900/30 text-green-400' : 'bg-green-100 text-green-600')
                                : (isDarkMode ? 'bg-yellow-900/30 text-yellow-400' : 'bg-yellow-100 text-yellow-600')
                            }`}>
                              {tokenAllowance >= minimumBond ? (
                                <span>Approved ✓</span>
                              ) : (
                                <span>Approved: {formatEther(tokenAllowance)} P2P (Need approval)</span>
                              )}
                            </div>
                          )}
                          {tokenAllowance === undefined && minimumBond && isConnected && (
                            <div className={`text-xs mb-2 px-3 py-1.5 rounded ${isDarkMode ? 'bg-yellow-900/30 text-yellow-400' : 'bg-yellow-100 text-yellow-600'}`}>
                              Checking allowance...
                            </div>
                          )}
                          {(() => {
                            // Same logic as create market page
                            // hasSufficientAllowance = allowance !== undefined && creatorDeposit ? allowance >= requiredAmount : false
                            const hasSufficientAllowance = tokenAllowance !== undefined && minimumBond ? tokenAllowance >= minimumBond : false;
                            const needsApproval = minimumBond && !hasSufficientAllowance;
                            const hasBalance = bondBalance && minimumBond && bondBalance.value >= minimumBond;
                            const canShow = hasBalance && needsApproval && isConnected && isP2POracleConfigured;
                            
                            // Debug logging
                            if (minimumBond && bondBalance) {
                              console.log('🔍 Approval check:', {
                                userBalance: formatEther(bondBalance.value),
                                tokenAllowance: tokenAllowance !== undefined ? formatEther(tokenAllowance) : 'undefined',
                                minimumBond: formatEther(minimumBond),
                                hasSufficientAllowance,
                                needsApproval,
                                hasBalance,
                                canShow,
                                isConnected,
                                isP2POracleConfigured,
                              });
                            }
                            
                            if (canShow) {
                              return (
                                <button
                                  onClick={handleApproveToken}
                                  disabled={isApproving}
                                  className={`w-full py-2 px-4 rounded text-sm font-medium transition-colors mb-2 ${
                                    isApproving
                                      ? (isDarkMode ? 'bg-gray-800 text-gray-500 cursor-not-allowed' : 'bg-gray-300 text-gray-500 cursor-not-allowed')
                                      : isDarkMode 
                                        ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                                        : 'bg-blue-600 hover:bg-blue-700 text-white'
                                  }`}
                                >
                                  {isApproving ? 'Approving...' : 'Approve P2P Tokens'}
                                </button>
                              );
                            }
                            return null;
                          })()}
                            <button
                              onClick={() => handleMakeAssertion(market.marketId)}
                            disabled={
                              !isConnected || 
                              (selectedOptions[market.marketId] || 0) === 0 || 
                              pendingAction === `assert-${market.marketId}` || 
                              !isP2POracleConfigured || 
                              (bondBalance && minimumBond ? bondBalance.value < minimumBond : false) || 
                              (tokenAllowance !== undefined && minimumBond ? tokenAllowance < minimumBond : tokenAllowance === undefined) ||
                              (address && market.creator && address.toLowerCase() === market.creator.toLowerCase())
                            }
                            className={`w-full py-2 px-4 rounded text-sm font-medium transition-colors ${
                              !isConnected || 
                              (selectedOptions[market.marketId] || 0) === 0 || 
                              pendingAction === `assert-${market.marketId}` || 
                              !isP2POracleConfigured || 
                              (bondBalance && minimumBond && bondBalance.value < minimumBond) || 
                              (tokenAllowance !== undefined && minimumBond && tokenAllowance < minimumBond) ||
                              tokenAllowance === undefined
                                  ? (isDarkMode ? 'bg-gray-800 text-gray-500 cursor-not-allowed' : 'bg-gray-300 text-gray-500 cursor-not-allowed')
                                  : isDarkMode 
                                    ? 'bg-[#39FF14] hover:bg-[#39FF14]/80 text-black' 
                                  : 'bg-[#39FF14] hover:bg-[#39FF14]/80 text-black'
                              }`}
                            >
                            {pendingAction === `assert-${market.marketId}` ? 'Submitting...' : 'Make Assertion'}
                            </button>
                          </div>
                        );
                      })()}

                      {market.p2pAssertionMade && market.assertionTiming && (() => {
                        // Calculate remaining times dynamically based on currentTime
                        // Use currentTime if available, otherwise use current timestamp as fallback
                        const now = currentTime && currentTime > BigInt(0) 
                          ? Number(currentTime) 
                          : Math.floor(Date.now() / 1000);
                        const assertionDeadline = Number(market.assertionTiming.assertionDeadline);
                        const expirationTime = Number(market.assertionTiming.expirationTime);
                        const assertionWindowRemaining = Math.max(0, assertionDeadline - now);
                        const disputeWindowRemaining = Math.max(0, expirationTime - now);
                        const canSettle = !market.assertionTiming.settled && now >= expirationTime;
                        const canDispute = !market.assertionTiming.settled && !market.assertionTiming.disputed && now >= assertionDeadline && now < expirationTime;
                        
                        return (
                          <div className="flex-shrink-0 mb-3">
                            {market.assertionTiming.settled ? (
                              <div className={`text-xs px-3 py-2 rounded ${isDarkMode ? 'bg-green-900/30 text-green-400' : 'bg-green-100 text-green-600'}`}>
                                Ready to resolve
                              </div>
                            ) : (
                              <div className="space-y-1 text-xs">
                                {(() => {
                                  // Determine which state to show based on timing
                                  const isInAssertionWindow = assertionWindowRemaining > 0;
                                  const isInDisputeWindow = !isInAssertionWindow && disputeWindowRemaining > 0 && !market.assertionTiming.settled;
                                  const isReadyToSettle = !isInAssertionWindow && disputeWindowRemaining <= 0 && !market.assertionTiming.settled;
                                  
                                  if (isInAssertionWindow) {
                                    return (
                                      <div className={`px-3 py-2 rounded ${isDarkMode ? 'bg-yellow-900/30 text-yellow-400' : 'bg-yellow-100 text-yellow-600'}`}>
                                        Assertion Window: {formatTimeRemaining(assertionWindowRemaining)}
                                      </div>
                                    );
                                  }
                                  
                                  if (isInDisputeWindow) {
                                    return (
                                      <div className={market.assertionTiming.disputed 
                                        ? `${isDarkMode ? 'bg-red-900/30 text-red-400' : 'bg-red-100 text-red-600'} px-3 py-2 rounded`
                                        : `${isDarkMode ? 'bg-blue-900/30 text-blue-400' : 'bg-blue-100 text-blue-600'} px-3 py-2 rounded`
                                      }>
                                        {market.assertionTiming.disputed 
                                          ? 'Disputed' 
                                          : `Dispute Window: ${formatTimeRemaining(disputeWindowRemaining)}`
                                        }
                                      </div>
                                    );
                                  }
                                  
                                  if (isReadyToSettle) {
                                    return (
                                      <div className={`px-3 py-2 rounded ${isDarkMode ? 'bg-green-900/30 text-green-400' : 'bg-green-100 text-green-600'}`}>
                                        Ready to Settle
                                      </div>
                                    );
                                  }
                                  
                                  return null;
                                })()}
                              </div>
                            )}
                          </div>
                        );
                      })()}

                      {market.p2pAssertionMade && (() => {
                        // Calculate timing dynamically based on currentTime
                        // Use currentTime if available, otherwise use current timestamp as fallback
                        const now = currentTime && currentTime > BigInt(0) 
                          ? Number(currentTime) 
                          : Math.floor(Date.now() / 1000);
                        const assertionDeadline = market.assertionTiming ? Number(market.assertionTiming.assertionDeadline) : 0;
                        const expirationTime = market.assertionTiming ? Number(market.assertionTiming.expirationTime) : 0;
                        const canDispute = market.assertionTiming && !market.assertionTiming.settled && !market.assertionTiming.disputed && now >= assertionDeadline && now < expirationTime;
                        const canSettle = market.assertionTiming && !market.assertionTiming.settled && now >= expirationTime;
                        
                        return (
                          <div className="flex-shrink-0 space-y-2 mt-auto">
                            {/* Always show current assertion */}
                            <div className={`text-xs px-3 py-2 rounded mb-2 ${isDarkMode ? 'bg-blue-900/30 text-blue-400 border border-blue-800' : 'bg-blue-100 text-blue-800 border border-blue-300'}`}>
                              <div className="font-medium mb-0.5">Current Assertion:</div>
                              <div>{market.currentAssertionClaim || 'Loading...'}</div>
                            </div>
                            
                            {/* Show dispute options only during dispute window */}
                            {market.assertionTiming && !market.assertionTiming.settled && canDispute && !market.assertionTiming.disputed && (
                            <div className="space-y-1.5 mb-2">
                              <div className={`text-sm font-semibold mb-2 px-3 py-2 rounded ${isDarkMode ? 'bg-blue-900/30 text-blue-300 border border-blue-700' : 'bg-blue-100 text-blue-800 border border-blue-300'}`}>
                                ⚠️ Dispute Window Open
                              </div>
                              {(() => {
                                // Current assertion is the option text (e.g., "Yes", "No")
                                const currentClaim = market.currentAssertionClaim?.toLowerCase().trim();
                                
                                // Filter options: exclude the current assertion text
                                const availableOptions = options.filter((option: string) => {
                                  const optionText = option.toLowerCase().trim();
                                  return !currentClaim || optionText !== currentClaim;
                                });
                                
                                if (availableOptions.length === 0) {
                                  return null;
                                }
                                
                                // Show available dispute options
                                return (
                                  <>
                                    {availableOptions.map((option: string) => {
                                      const optionIndex = options.indexOf(option);
                                      const optionNum = optionIndex + 1;
                                      const isSelected = (winningOptions[market.marketId] || '') === optionNum.toString();
                                      return (
                                        <button
                                          key={optionIndex}
                                          onClick={() => setWinningOptions(prev => ({ ...prev, [market.marketId]: optionNum.toString() }))}
                                          className={`w-full text-left px-3 py-1.5 rounded text-xs border transition-colors mb-1.5 ${
                                            isSelected
                                              ? isDarkMode 
                                                  ? 'border-red-500 bg-red-900/30 text-red-400' 
                                                  : 'border-red-500 bg-red-100 text-red-700'
                                              : isDarkMode
                                                ? 'border-gray-700 hover:border-gray-600 text-white'
                                                : 'border-gray-300 hover:border-gray-400 text-gray-900'
                                          }`}
                                        >
                                          <div className="flex items-center gap-1.5">
                                            <input
                                              type="radio"
                                              checked={isSelected}
                                              onChange={() => setWinningOptions(prev => ({ ...prev, [market.marketId]: optionNum.toString() }))}
                                              className="w-3 h-3"
                                            />
                                            <span>{option}</span>
                                          </div>
                                        </button>
                                      );
                                    })}
                                    {(() => {
                                      const hasSufficientAllowance = tokenAllowance !== undefined && minimumBond ? tokenAllowance >= minimumBond : false;
                                      const needsApproval = minimumBond && !hasSufficientAllowance;
                                      const hasBalance = bondBalance && minimumBond && bondBalance.value >= minimumBond;
                                      const canShowApprove = hasBalance && needsApproval && isConnected && isP2POracleConfigured;
                                      
                                      if (canShowApprove) {
                                        return (
                                          <button
                                            onClick={handleApproveToken}
                                            disabled={isApproving}
                                            className={`w-full py-1.5 px-3 rounded text-xs font-medium transition-colors mb-1.5 ${
                                              isApproving
                                                ? (isDarkMode ? 'bg-gray-800 text-gray-500 cursor-not-allowed' : 'bg-gray-300 text-gray-500 cursor-not-allowed')
                                                : isDarkMode 
                                                  ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                                                  : 'bg-blue-600 hover:bg-blue-700 text-white'
                                            }`}
                                          >
                                            {isApproving ? 'Approving...' : 'Approve P2P Tokens'}
                                          </button>
                                        );
                                      }
                                      return null;
                                    })()}
                                    <button
                                      onClick={() => handleDisputeOracle(market.marketId)}
                                      disabled={
                                        !isConnected || 
                                        pendingAction === `dispute-${market.marketId}` || 
                                        !(winningOptions[market.marketId] || '') ||
                                        !isP2POracleConfigured ||
                                        (bondBalance && minimumBond ? bondBalance.value < minimumBond : false) ||
                                        (tokenAllowance !== undefined && minimumBond ? tokenAllowance < minimumBond : tokenAllowance === undefined)
                                      }
                                      className={`w-full py-1.5 px-3 rounded text-xs font-medium transition-colors ${
                                        !isConnected || 
                                        pendingAction === `dispute-${market.marketId}` || 
                                        !(winningOptions[market.marketId] || '') ||
                                        !isP2POracleConfigured ||
                                        (bondBalance && minimumBond && bondBalance.value < minimumBond) ||
                                        (tokenAllowance !== undefined && minimumBond && tokenAllowance < minimumBond) ||
                                        tokenAllowance === undefined
                                          ? (isDarkMode ? 'bg-gray-800 text-gray-500 cursor-not-allowed' : 'bg-gray-300 text-gray-500 cursor-not-allowed')
                                          : isDarkMode 
                                            ? 'bg-red-600 hover:bg-red-700 text-white' 
                                            : 'bg-red-600 hover:bg-red-700 text-white'
                                      }`}
                                    >
                                      {pendingAction === `dispute-${market.marketId}` ? 'Disputing...' : 'Dispute'}
                                    </button>
                                  </>
                                );
                              })()}
                            </div>
                            )}
                            
                            {/* Show voting UI when disputed */}
                            {market.assertionTiming && market.assertionTiming.disputed && !market.assertionTiming.settled && market.votingData && (() => {
                              const isVotingActive = market.votingData.deadline > currentTime && currentTime > 0;
                              const isVotingEnded = !isVotingActive && !market.votingData.resolved;
                              const options = market.metadata?.options || ['Yes', 'No'];
                              
                              return (
                                <div className="mb-2 space-y-2">
                                  {/* Voting status and countdown */}
                                  <div className={`text-xs mb-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                                    {isVotingActive ? (
                                      <>Voting Active • {formatTimeRemaining(Number(market.votingData.deadline - currentTime))}</>
                                    ) : isVotingEnded ? (
                                      'Voting Ended'
                                    ) : (
                                      `Result: ${market.votingData.result > 0 ? 'Yes' : 'No'}`
                                    )}
                                  </div>
                                  
                                  {/* Voting options with vote counts */}
                                  <div className="space-y-1.5">
                                    {options.map((option: string, index: number) => {
                                      const voteValue = index === 0 ? BigInt(1) : BigInt(0); // Yes = 1, No = 0
                                      const voteCount = voteValue === BigInt(1) ? market.votingData!.yesVotes : market.votingData!.noVotes;
                                      const canVote = isVotingActive && !market.votingData!.resolved && !market.votingData!.hasVoted && market.votingData!.userStake > 0;
                                      
                                      return (
                                        <button
                                          key={index}
                                          onClick={() => canVote && handleVote(market.marketId, voteValue)}
                                          disabled={!canVote || pendingAction === `vote-${market.marketId}` || isVotingEnded}
                                          className={`w-full text-left px-3 py-2 rounded text-sm border transition-colors ${
                                            canVote && !isVotingEnded
                                              ? isDarkMode
                                                ? 'border-gray-700 hover:border-gray-600 text-white'
                                                : 'border-gray-300 hover:border-gray-400 text-gray-900'
                                              : isDarkMode
                                                ? 'border-gray-800 text-gray-500 cursor-not-allowed'
                                                : 'border-gray-300 text-gray-500 cursor-not-allowed'
                                          }`}
                                        >
                                          <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                              <input
                                                type="radio"
                                                checked={false}
                                                disabled={!canVote || isVotingEnded}
                                                className="w-3 h-3"
                                              />
                                              <span className="text-xs">{option}</span>
                                            </div>
                                            <span className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                                              {formatEther(voteCount)} P2P
                                            </span>
                                          </div>
                                        </button>
                                      );
                                    })}
                                  </div>
                                  
                                  {/* Stake section - only show when voting is active */}
                                  {isVotingActive && !market.votingData.resolved && !market.votingData.hasVoted && (
                                    <>
                                      {market.votingData.userStake === BigInt(0) && (
                                        <div className="space-y-1.5">
                                          <input
                                            type="number"
                                            step="0.1"
                                            min="0"
                                            placeholder="Stake amount (P2P)"
                                            value={votingStakeAmounts[market.marketId] || ''}
                                            onChange={(e) => setVotingStakeAmounts(prev => ({ ...prev, [market.marketId]: e.target.value }))}
                                            className={`w-full px-3 py-1.5 rounded text-xs border ${
                                              isDarkMode 
                                                ? 'bg-gray-800 border-gray-700 text-white' 
                                                : 'bg-white border-gray-300 text-gray-900'
                                            }`}
                                          />
                                          <button
                                            onClick={() => handleStakeForVoting(market.marketId)}
                                            disabled={pendingAction === `stake-${market.marketId}` || !votingStakeAmounts[market.marketId] || parseFloat(votingStakeAmounts[market.marketId] || '0') <= 0}
                                            className={`w-full py-1.5 px-3 rounded text-xs font-medium transition-colors ${
                                              pendingAction === `stake-${market.marketId}` || !votingStakeAmounts[market.marketId] || parseFloat(votingStakeAmounts[market.marketId] || '0') <= 0
                                                ? (isDarkMode ? 'bg-gray-800 text-gray-500 cursor-not-allowed' : 'bg-gray-300 text-gray-500 cursor-not-allowed')
                                                : isDarkMode 
                                                  ? 'bg-[#39FF14] hover:bg-[#39FF14]/80 text-black' 
                                                  : 'bg-[#39FF14] hover:bg-[#39FF14]/80 text-black'
                                            }`}
                                          >
                                            {pendingAction === `stake-${market.marketId}` ? 'Staking...' : 'Stake'}
                                          </button>
                                        </div>
                                      )}
                                      
                                      {market.votingData.userStake > 0 && (
                                        <div className={`text-xs px-3 py-1.5 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                                          Your stake: {formatEther(market.votingData.userStake)} P2P
                                        </div>
                                      )}
                                    </>
                                  )}
                                  
                                  {market.votingData.hasVoted && (
                                    <div className={`text-xs px-3 py-1.5 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                                      You have voted
                                    </div>
                                  )}
                                </div>
                              );
                            })()}
                            
                            <button
                              onClick={() => handleSettleOracle(market.marketId)}
                              disabled={!isConnected || pendingAction === `settle-${market.marketId}` || !canSettle}
                              className={`w-full py-1.5 px-3 rounded text-xs font-medium transition-colors mb-2 ${
                                !isConnected || pendingAction === `settle-${market.marketId}` || !canSettle
                                  ? (isDarkMode ? 'bg-gray-800 text-gray-500 cursor-not-allowed' : 'bg-gray-300 text-gray-500 cursor-not-allowed')
                                  : isDarkMode 
                                    ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                              }`}
                            >
                              {pendingAction === `settle-${market.marketId}` ? 'Settling...' : 'Settle'}
                            </button>
                            <button
                              onClick={() => handleResolveMarket(market.marketId)}
                              disabled={!isConnected || pendingAction === `resolve-${market.marketId}` || (market.assertionTiming && !market.assertionTiming.settled)}
                              className={`w-full py-1.5 px-3 rounded text-xs font-medium transition-colors ${
                                !isConnected || pendingAction === `resolve-${market.marketId}` || (market.assertionTiming && !market.assertionTiming.settled)
                                  ? (isDarkMode ? 'bg-gray-800 text-gray-500 cursor-not-allowed' : 'bg-gray-300 text-gray-500 cursor-not-allowed')
                                  : isDarkMode 
                                    ? 'bg-[#39FF14] hover:bg-[#39FF14]/80 text-black' 
                                    : 'bg-[#39FF14] hover:bg-[#39FF14]/80 text-black'
                              }`}
                            >
                              {pendingAction === `resolve-${market.marketId}` ? 'Resolving...' : 'Resolve'}
                            </button>
                          </div>
                        );
                      })()}
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
