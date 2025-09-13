"use client";

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Search,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Clock,
  TrendingUp,
  Users,
  DollarSign,
  BarChart3,
  Copy,
  Menu,
  X,
  Home,
  PieChart,
  Plus,
  History,
  MessageCircle,
  Settings,
  ArrowUpRight,
  Sun,
  Moon,
  Activity,
  Lock,
  Zap,
  Filter,
  Wallet,
  TrendingDown,
  ExternalLink,
  Timer,
  Target,
  Award
} from 'lucide-react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, useBalance, useChainId, useSwitchChain, useDisconnect, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseEther, formatEther } from 'viem';
import { ethers } from 'ethers';
import { pepuMainnet } from './chains';
import { Sidebar } from './components/Sidebar';
import { useTheme } from './context/ThemeContext';

// Type definitions
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
  endTime: bigint;
  resolutionEndTime: bigint;
  state: number;
  winningOption: bigint;
  isResolved: boolean;
}

// Contract ABIs
const MARKET_MANAGER_ABI = [
  {
    "inputs": [],
    "name": "getActiveMarkets",
    "outputs": [{"name": "", "type": "uint256[]"}],
    "stateMutability": "view",
    "type": "function"
  },
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
          {"name": "endTime", "type": "uint256"},
          {"name": "resolutionEndTime", "type": "uint256"},
          {"name": "state", "type": "uint8"},
          {"name": "winningOption", "type": "uint256"},
          {"name": "isResolved", "type": "bool"}
        ],
        "name": "",
        "type": "tuple"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"name": "marketId", "type": "uint256"}],
    "name": "getMarketInfo",
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
          {"name": "endTime", "type": "uint256"},
          {"name": "resolutionEndTime", "type": "uint256"},
          {"name": "state", "type": "uint8"},
          {"name": "winningOption", "type": "uint256"},
          {"name": "isResolved", "type": "bool"}
        ],
        "name": "market",
        "type": "tuple"
      },
      {"name": "totalPool", "type": "uint256"},
      {"name": "supportPool", "type": "uint256"},
      {"name": "bettorCount", "type": "uint256"},
      {"name": "supporterCount", "type": "uint256"},
      {"name": "bettors", "type": "address[]"},
      {"name": "supporters", "type": "address[]"},
      {"name": "tokenSymbol", "type": "string"}
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"name": "marketId", "type": "uint256"}, {"name": "option", "type": "uint256"}],
    "name": "placeBet",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [{"name": "marketId", "type": "uint256"}, {"name": "option", "type": "uint256"}, {"name": "amount", "type": "uint256"}],
    "name": "placeBetWithToken",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{"name": "marketId", "type": "uint256"}, {"name": "amount", "type": "uint256"}],
    "name": "supportMarket",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getSupportedTokens",
    "outputs": [
      {"name": "tokens", "type": "address[]"},
      {"name": "symbols", "type": "string[]"}
    ],
    "stateMutability": "view",
    "type": "function"
  }
];

const ANALYTICS_ABI = [
  {
    "inputs": [{"name": "limit", "type": "uint256"}],
    "name": "getActiveMarketsByVolume",
    "outputs": [
      {"name": "", "type": "uint256[]"},
      {"name": "", "type": "uint256[]"}
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"name": "limit", "type": "uint256"}],
    "name": "getTodayActiveMarkets",
    "outputs": [
      {"name": "", "type": "uint256[]"},
      {"name": "", "type": "uint256[]"}
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"name": "marketId", "type": "uint256"}],
    "name": "getMarketStats",
    "outputs": [
      {
        "components": [
          {"name": "totalVolume", "type": "uint256"},
          {"name": "totalBettors", "type": "uint256"},
          {"name": "totalSupporters", "type": "uint256"},
          {"name": "averageBetSize", "type": "uint256"},
          {"name": "largestBet", "type": "uint256"},
          {"name": "mostPopularOption", "type": "uint256"},
          {"name": "resolutionTime", "type": "uint256"},
          {"name": "wasResolved", "type": "bool"},
          {"name": "creatorWinnings", "type": "uint256"}
        ],
        "name": "",
        "type": "tuple"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  }
];

// Market Card Component
function MarketCard({ marketId, isDarkMode, onBet, onSupport }: {
  marketId: number;
  isDarkMode: boolean;
  onBet: (marketId: number, option: number, amount: string, isApproval?: boolean) => void;
  onSupport: (marketId: number, amount: string) => void;
}) {
  const MARKET_MANAGER_ADDRESS = process.env.NEXT_PUBLIC_P2P_MARKETMANAGER_ADDRESS as `0x${string}`;
  const ANALYTICS_ADDRESS = process.env.NEXT_PUBLIC_P2P_ANALYTICS_ADDRESS as `0x${string}`;

  // All hooks must be called at the top level
  const [betAmount, setBetAmount] = useState('');
  const [supportAmount, setSupportAmount] = useState('');
  const [selectedOption, setSelectedOption] = useState(1);
  const [showBetModal, setShowBetModal] = useState(false);
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [marketMetadata, setMarketMetadata] = useState<any>(null);
  const [loadingMetadata, setLoadingMetadata] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [needsApproval, setNeedsApproval] = useState(false);
  const [isApproving, setIsApproving] = useState(false);

  // Fetch market data
  const { data: market } = useReadContract({
    address: MARKET_MANAGER_ADDRESS,
    abi: MARKET_MANAGER_ABI,
    functionName: 'getMarket',
    args: [BigInt(marketId)],
  }) as { data: MarketData | undefined };

  const { data: marketInfo } = useReadContract({
    address: MARKET_MANAGER_ADDRESS,
    abi: MARKET_MANAGER_ABI,
    functionName: 'getMarketInfo',
    args: [BigInt(marketId)],
  });

  const { data: stats } = useReadContract({
    address: ANALYTICS_ADDRESS,
    abi: ANALYTICS_ABI,
    functionName: 'getMarketStats',
    args: [BigInt(marketId)],
  });

  // Get token symbol from payment token address - must be before early return
  const { data: tokenSymbol } = useReadContract({
    address: MARKET_MANAGER_ADDRESS,
    abi: [
      {
        "inputs": [{"name": "token", "type": "address"}],
        "name": "tokenSymbols",
        "outputs": [{"name": "", "type": "string"}],
        "stateMutability": "view",
        "type": "function"
      }
    ],
    functionName: 'tokenSymbols',
    args: [market?.paymentToken || '0x0000000000000000000000000000000000000000'],
  });

  // Get option pool data for each option - fetch all possible options (up to 4)
  const { data: option1Pool } = useReadContract({
    address: MARKET_MANAGER_ADDRESS,
    abi: [
      {
        "inputs": [{"name": "marketId", "type": "uint256"}, {"name": "option", "type": "uint256"}, {"name": "token", "type": "address"}],
        "name": "getOptionPool",
        "outputs": [{"name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function"
      }
    ],
    functionName: 'getOptionPool',
    args: [BigInt(marketId), BigInt(1), market?.paymentToken || '0x0000000000000000000000000000000000000000'],
  });

  const { data: option2Pool } = useReadContract({
    address: MARKET_MANAGER_ADDRESS,
    abi: [
      {
        "inputs": [{"name": "marketId", "type": "uint256"}, {"name": "option", "type": "uint256"}, {"name": "token", "type": "address"}],
        "name": "getOptionPool",
        "outputs": [{"name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function"
      }
    ],
    functionName: 'getOptionPool',
    args: [BigInt(marketId), BigInt(2), market?.paymentToken || '0x0000000000000000000000000000000000000000'],
  });

  const { data: option3Pool } = useReadContract({
    address: MARKET_MANAGER_ADDRESS,
    abi: [
      {
        "inputs": [{"name": "marketId", "type": "uint256"}, {"name": "option", "type": "uint256"}, {"name": "token", "type": "address"}],
        "name": "getOptionPool",
        "outputs": [{"name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function"
      }
    ],
    functionName: 'getOptionPool',
    args: [BigInt(marketId), BigInt(3), market?.paymentToken || '0x0000000000000000000000000000000000000000'],
  });

  const { data: option4Pool } = useReadContract({
    address: MARKET_MANAGER_ADDRESS,
    abi: [
      {
        "inputs": [{"name": "marketId", "type": "uint256"}, {"name": "option", "type": "uint256"}, {"name": "token", "type": "address"}],
        "name": "getOptionPool",
        "outputs": [{"name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function"
      }
    ],
    functionName: 'getOptionPool',
    args: [BigInt(marketId), BigInt(4), market?.paymentToken || '0x0000000000000000000000000000000000000000'],
  });

  // Get actual bettor count from contract
  const { data: bettorCount } = useReadContract({
    address: MARKET_MANAGER_ADDRESS,
    abi: [
      {
        "inputs": [{"name": "marketId", "type": "uint256"}],
        "name": "getBettorCount",
        "outputs": [{"name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function"
      }
    ],
    functionName: 'getBettorCount',
    args: [BigInt(marketId)],
  });

  // Get supporter count from contract
  const { data: supporterCount } = useReadContract({
    address: MARKET_MANAGER_ADDRESS,
    abi: [
      {
        "inputs": [{"name": "marketId", "type": "uint256"}],
        "name": "getSupporterCount",
        "outputs": [{"name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function"
      }
    ],
    functionName: 'getSupporterCount',
    args: [BigInt(marketId)],
  });

  // Get user account for allowance checking
  const { address: userAddress } = useAccount();

  // Check token allowance for ERC20 markets
  const { data: tokenAllowance, refetch: refetchAllowance } = useReadContract({
    address: market?.paymentToken as `0x${string}`,
    abi: [
      {
        "inputs": [
          {"name": "owner", "type": "address"},
          {"name": "spender", "type": "address"}
        ],
        "name": "allowance",
        "outputs": [{"name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function"
      }
    ],
    functionName: 'allowance',
    args: market?.paymentToken && MARKET_MANAGER_ADDRESS && userAddress ? [
      userAddress,
      MARKET_MANAGER_ADDRESS
    ] : undefined,
  });

  // Check if this is an ERC20 market (not native PEPU)
  const isERC20Market = market?.paymentToken && market.paymentToken !== '0x0000000000000000000000000000000000000000';

  // Calculate total pool for display
  const getTotalPool = () => {
    const optionPools = [
      option1Pool || BigInt(0),
      option2Pool || BigInt(0),
      option3Pool || BigInt(0),
      option4Pool || BigInt(0)
    ];
    
    const maxOptions = market ? Number(market.maxOptions) : 2;
    const relevantPools = optionPools.slice(0, maxOptions);
    
    return relevantPools.reduce((sum, pool) => sum + pool, BigInt(0));
  };

  // Check if user needs to approve tokens for ERC20 markets
  const requiredAmount = betAmount ? parseEther(betAmount) : BigInt(0);
  const hasSufficientAllowance = tokenAllowance !== undefined && betAmount ? tokenAllowance >= requiredAmount : false;
  const needsTokenApproval = isERC20Market && betAmount && !hasSufficientAllowance;

  // Debug logging to check pool data
  console.log('Market ID:', marketId);
  console.log('Option 1 Pool:', option1Pool);
  console.log('Option 2 Pool:', option2Pool);
  console.log('Option 3 Pool:', option3Pool);
  console.log('Option 4 Pool:', option4Pool);
  console.log('Max Options:', market ? Number(market.maxOptions) : 2);
  console.log('Total Pool:', getTotalPool().toString());
  console.log('Bettor Count:', bettorCount);
  console.log('Supporter Count:', supporterCount);
  console.log('Is ERC20 Market:', isERC20Market);
  console.log('Token Allowance:', tokenAllowance?.toString());
  console.log('Required Amount:', requiredAmount.toString());
  console.log('Needs Approval:', needsTokenApproval);
  
  // Calculate total participants (bettors + supporters + creator)
  const totalParticipants = (bettorCount ? Number(bettorCount) : 0) + 
                           (supporterCount ? Number(supporterCount) : 0) + 1; // +1 for creator
  console.log('Total Participants:', totalParticipants);

  // Fetch IPFS metadata when market data is available
  useEffect(() => {
    const marketData = market as any;
    if (market && marketData.ipfsHash && !marketMetadata && !loadingMetadata) {
      setLoadingMetadata(true);
      const fetchMetadata = async () => {
        try {
          // Convert IPFS hash to gateway URL
          const ipfsHash = marketData.ipfsHash;
          const gatewayUrl = `https://gateway.lighthouse.storage/ipfs/${ipfsHash}`;
          
          const response = await fetch(gatewayUrl);
          if (response.ok) {
            const metadata = await response.json();
            setMarketMetadata(metadata);
          } else {
            console.warn('Failed to fetch IPFS metadata:', response.status);
          }
        } catch (error) {
          console.error('Error fetching IPFS metadata:', error);
        } finally {
          setLoadingMetadata(false);
        }
      };
      
      fetchMetadata();
    }
  }, [market, marketMetadata, loadingMetadata]);

  if (!market || !marketInfo || !stats) {
    return (
      <div className={`rounded-lg border p-6 ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
        <div className="animate-pulse">
          <div className={`h-4 bg-gray-300 rounded mb-2 ${isDarkMode ? 'bg-gray-600' : 'bg-gray-300'}`}></div>
          <div className={`h-3 bg-gray-300 rounded mb-4 ${isDarkMode ? 'bg-gray-600' : 'bg-gray-300'}`}></div>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className={`h-8 bg-gray-300 rounded ${isDarkMode ? 'bg-gray-600' : 'bg-gray-300'}`}></div>
            <div className={`h-8 bg-gray-300 rounded ${isDarkMode ? 'bg-gray-600' : 'bg-gray-300'}`}></div>
          </div>
        </div>
      </div>
    );
  }

  // Market data is now properly typed
  const marketData = market;
  const marketInfoData = marketInfo as any;
  const statsData = stats as any;

  // Debug logging to check data accuracy
  console.log('Market Info Data:', marketInfoData);
  console.log('Stats Data:', statsData);
  console.log('Option 1 Pool:', option1Pool);
  console.log('Option 2 Pool:', option2Pool);
  console.log('Bettor Count:', bettorCount);
  console.log('Total Pool:', marketInfoData?.totalPool);

  const timeLeft = Number(marketData.endTime) - Math.floor(Date.now() / 1000);
  const hoursLeft = Math.max(0, Math.floor(timeLeft / 3600));
  const minutesLeft = Math.max(0, Math.floor((timeLeft % 3600) / 60));

  const isBettingClosed = timeLeft <= 12 * 3600; // 12 hours before end

  const formatTime = () => {
    if (hoursLeft > 0) {
      return `${hoursLeft}h ${minutesLeft}m`;
    }
    return `${minutesLeft}m`;
  };

  const getMarketTitle = () => {
    if (loadingMetadata) return 'Loading...';
    if (marketMetadata?.title) return marketMetadata.title;
    return `Market #${marketId}`;
  };

  const getMarketDescription = () => {
    if (loadingMetadata) return 'Loading market details...';
    if (marketMetadata?.description) return marketMetadata.description;
    return marketData.isMultiOption ? 'Multiple choice prediction market' : 'Yes/No prediction market';
  };

  const getMarketOptions = () => {
    if (marketMetadata?.options && Array.isArray(marketMetadata.options)) {
      return marketMetadata.options;
    }
    return ['Yes', 'No']; // Default for linear markets
  };

  const getMarketCategory = () => {
    if (marketMetadata?.categories && Array.isArray(marketMetadata.categories) && marketMetadata.categories.length > 0) {
      return marketMetadata.categories[0]; // Show first category
    }
    return null;
  };

  // Calculate option percentages using real pool data for all options
  const getOptionPercentage = (optionIndex: number) => {
    const optionPools = [
      option1Pool || BigInt(0),
      option2Pool || BigInt(0),
      option3Pool || BigInt(0),
      option4Pool || BigInt(0)
    ];
    
    // Only consider pools for options that actually exist (based on maxOptions)
    const maxOptions = market ? Number(market.maxOptions) : 2;
    const relevantPools = optionPools.slice(0, maxOptions);
    
    const totalPool = relevantPools.reduce((sum, pool) => sum + pool, BigInt(0));
    
    if (totalPool === BigInt(0)) return 0;
    
    const optionPool = relevantPools[optionIndex] || BigInt(0);
    return Number((optionPool * BigInt(100)) / totalPool);
  };

  // Approve ERC20 tokens for betting
  const approveTokens = async () => {
    if (!userAddress || !market?.paymentToken || !betAmount) return;
    
    setIsApproving(true);
    try {
      const approvalAmount = parseEther(betAmount);
      
      // Use the same writeContract hook from the parent component
      // This will be passed down as a prop
      console.log('Approving tokens:', {
        token: market.paymentToken,
        amount: approvalAmount.toString(),
        spender: MARKET_MANAGER_ADDRESS
      });
      
      // The actual approval will be handled by the parent component
      // We just need to trigger it here
      onBet(marketId, selectedOption, betAmount, true); // true indicates this is an approval
      
    } catch (error) {
      console.error('Approval failed:', error);
    } finally {
      setIsApproving(false);
    }
  };

  return (
    <div className={`rounded-lg border ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} transition-all duration-200 hover:shadow-md`}>
      {/* Compact Header - Always Visible */}
      <div 
        className="p-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className={`text-base font-semibold truncate ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                {getMarketTitle()}
              </h3>
              <div className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                marketData.isMultiOption 
                  ? (isDarkMode ? 'bg-purple-900 text-purple-300' : 'bg-purple-100 text-purple-800')
                  : (isDarkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-800')
              }`}>
                {marketData.isMultiOption ? 'Multiple' : 'Yes/No'}
              </div>
            </div>
            <p className={`text-xs truncate mb-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              {getMarketDescription()}
            </p>
            {getMarketCategory() && (
              <div className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                isDarkMode ? 'bg-blue-900 text-blue-300' : 'bg-blue-100 text-blue-800'
              }`}>
                {getMarketCategory()}
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-6 ml-4">
            <div className="text-right">
               <p className={`text-sm font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                 {getTotalPool() > BigInt(0) ? formatEther(getTotalPool()) : '0'} {tokenSymbol || marketInfoData?.tokenSymbol || 'PEPU'}
               </p>
            </div>
            <div className="text-right">
              <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                {totalParticipants} participants
              </p>
            </div>
            <div className="text-right">
              <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                {formatTime()}
              </p>
            </div>
            <div className="text-right">
              <p className={`text-xs font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                {new Date(Number(marketData.endTime) * 1000).toLocaleDateString()}
              </p>
            </div>
            <ChevronDown className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''} ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`} />
          </div>
        </div>
      </div>

      {/* Expanded Content - Only Visible When Expanded */}
      {isExpanded && (
        <div className="border-t px-4 py-4 border-gray-200 dark:border-gray-700">
          {/* Market Stats */}
          <div className="grid grid-cols-3 gap-4 mb-3">
            <div>
              <p className={`text-xs font-medium uppercase tracking-wide ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Total Pool</p>
              <p className={`text-sm font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                {getTotalPool() > BigInt(0) ? formatEther(getTotalPool()) : '0'} {tokenSymbol || marketInfoData?.tokenSymbol || 'PEPU'}
              </p>
            </div>
            <div>
              <p className={`text-xs font-medium uppercase tracking-wide ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Participants</p>
              <p className={`text-sm font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                {totalParticipants}
              </p>
            </div>
            <div>
              <p className={`text-xs font-medium uppercase tracking-wide ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Time Left</p>
              <p className={`text-sm font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                {formatTime()}
              </p>
            </div>
          </div>

          {/* Market Options with Percentages */}
          <div className="mb-4">
            <p className={`text-xs font-medium uppercase tracking-wide mb-3 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              Market Options
            </p>
            <div className="space-y-2">
              {getMarketOptions().map((option: string, index: number) => {
                const percentage = getOptionPercentage(index);
                const isSelected = selectedOption === index + 1;
                
                return (
                  <label 
                    key={index}
                    className={`flex items-center gap-3 p-2 rounded border cursor-pointer transition-all ${
                      isSelected 
                        ? (isDarkMode ? 'border-green-500 bg-green-500/10' : 'border-green-500 bg-green-50')
                        : (isDarkMode ? 'border-gray-600 hover:border-gray-500' : 'border-gray-200 hover:border-gray-300')
                    }`}
                  >
                    <input
                      type="radio"
                      name="option"
                      value={index + 1}
                      checked={isSelected}
                      onChange={(e) => setSelectedOption(Number(e.target.value))}
                      className="w-4 h-4"
                    />
                    <span className={`text-sm font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                      {option}
                    </span>
                    <span className={`text-sm font-semibold ml-auto ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                      {percentage}%
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Betting Input */}
          {selectedOption > 0 && !isBettingClosed && (
            <div className="mb-3">
              <div className="flex gap-2">
                <input
                  type="number"
                  value={betAmount}
                  onChange={(e) => setBetAmount(e.target.value)}
                  placeholder="Amount"
                  className={`w-32 px-3 py-2 border rounded text-sm ${
                    isDarkMode 
                      ? 'bg-gray-700 border-gray-600 text-white' 
                      : 'bg-white border-gray-300 text-gray-900'
                  }`}
                />
                {needsTokenApproval ? (
                  <button
                    onClick={approveTokens}
                    disabled={isApproving || !betAmount}
                    className={`px-4 py-2 rounded text-sm font-medium ${
                      isApproving || !betAmount
                        ? 'bg-gray-400 cursor-not-allowed text-gray-200'
                        : isDarkMode 
                          ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                          : 'bg-blue-500 hover:bg-blue-600 text-white'
                    }`}
                  >
                    {isApproving ? 'Approving...' : 'Approve Tokens'}
                  </button>
                ) : (
                  <button
                    onClick={() => onBet(marketId, selectedOption, betAmount)}
                    disabled={!betAmount}
                    className={`px-4 py-2 rounded text-sm font-medium ${
                      !betAmount
                        ? 'bg-gray-400 cursor-not-allowed text-gray-200'
                        : isDarkMode 
                          ? 'bg-gray-600 hover:bg-gray-500 text-white' 
                          : 'bg-gray-800 hover:bg-gray-700 text-white'
                    }`}
                  >
                    Bet
                  </button>
                )}
              </div>
              {needsTokenApproval && (
                <p className="text-xs text-yellow-600 mt-1">
                  ⚠️ You need to approve {tokenSymbol || 'tokens'} before betting
                </p>
              )}
            </div>
          )}

          {/* Market Details */}
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <span className={isDarkMode ? 'text-gray-400' : 'text-gray-500'}>Creator:</span>
              <span className={`ml-1 font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                {marketData.creator ? `${marketData.creator.slice(0, 6)}...${marketData.creator.slice(-4)}` : 'Unknown'}
              </span>
            </div>
            <div>
              <span className={isDarkMode ? 'text-gray-400' : 'text-gray-500'}>Min Stake:</span>
              <span className={`ml-1 font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                {marketData?.minStake ? formatEther(marketData.minStake) : '0'} {tokenSymbol || marketInfoData?.tokenSymbol || 'PEPU'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Bet Modal */}
      {showBetModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className={`max-w-md w-full rounded-lg shadow-xl ${isDarkMode ? 'bg-gray-800' : 'bg-white'} p-6`}>
            <h3 className={`text-lg font-semibold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              Place Bet
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Select Option
                </label>
                <div className="space-y-2">
                  {marketData.isMultiOption ? (
                    // Multiple options from IPFS
                    getMarketOptions().map((option: string, index: number) => (
                      <label key={index} className="flex items-center">
                        <input
                          type="radio"
                          name="option"
                          value={index + 1}
                          checked={selectedOption === index + 1}
                          onChange={(e) => setSelectedOption(Number(e.target.value))}
                          className="mr-2"
                        />
                        <span className={isDarkMode ? 'text-gray-300' : 'text-gray-700'}>{option}</span>
                      </label>
                    ))
                  ) : (
                    <>
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="option"
                          value={1}
                          checked={selectedOption === 1}
                          onChange={(e) => setSelectedOption(Number(e.target.value))}
                          className="mr-2"
                        />
                        <span className={isDarkMode ? 'text-gray-300' : 'text-gray-700'}>Yes</span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="option"
                          value={2}
                          checked={selectedOption === 2}
                          onChange={(e) => setSelectedOption(Number(e.target.value))}
                          className="mr-2"
                        />
                        <span className={isDarkMode ? 'text-gray-300' : 'text-gray-700'}>No</span>
                      </label>
                    </>
                  )}
                </div>
              </div>

              <div>
                <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Amount ({tokenSymbol || marketInfoData?.tokenSymbol || 'PEPU'})
                </label>
                <input
                  type="number"
                  value={betAmount}
                  onChange={(e) => setBetAmount(e.target.value)}
                  placeholder={`Min: ${marketData?.minStake ? formatEther(marketData.minStake) : '0'}`}
                  className={`w-full px-3 py-2 border rounded-lg ${
                    isDarkMode 
                      ? 'bg-gray-700 border-gray-600 text-white' 
                      : 'bg-white border-gray-300 text-gray-900'
                  }`}
                />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setShowBetModal(false)}
                  className={`flex-1 py-2 px-4 rounded-lg font-medium ${
                    isDarkMode ? 'bg-gray-600 hover:bg-gray-700 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-900'
                  }`}
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    onBet(marketId, selectedOption, betAmount);
                    setShowBetModal(false);
                  }}
                  className={`flex-1 py-2 px-4 rounded-lg font-medium ${
                    isDarkMode ? 'bg-gray-700 hover:bg-gray-600 text-white border border-gray-600' : 'bg-gray-900 hover:bg-gray-800 text-white'
                  }`}
                >
                  Place Bet
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Support Modal */}
      {showSupportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className={`max-w-md w-full rounded-lg shadow-xl ${isDarkMode ? 'bg-gray-800' : 'bg-white'} p-6`}>
            <h3 className={`text-lg font-semibold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              Support Market
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Amount ({tokenSymbol || marketInfoData?.tokenSymbol || 'PEPU'})
                </label>
                <input
                  type="number"
                  value={supportAmount}
                  onChange={(e) => setSupportAmount(e.target.value)}
                  placeholder="Enter amount"
                  className={`w-full px-3 py-2 border rounded-lg ${
                    isDarkMode 
                      ? 'bg-gray-700 border-gray-600 text-white' 
                      : 'bg-white border-gray-300 text-gray-900'
                  }`}
                />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setShowSupportModal(false)}
                  className={`flex-1 py-2 px-4 rounded-lg font-medium ${
                    isDarkMode ? 'bg-gray-600 hover:bg-gray-700 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-900'
                  }`}
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    onSupport(marketId, supportAmount);
                    setShowSupportModal(false);
                  }}
                  className={`flex-1 py-2 px-4 rounded-lg font-medium ${
                    isDarkMode ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-green-500 hover:bg-green-600 text-white'
                  }`}
                >
                  Support
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Main Page Component
export default function HomePage() {
  const { isDarkMode, toggleTheme } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterStatus, setFilterStatus] = useState('active');
  const [sortBy, setSortBy] = useState('newest');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { data: balance } = useBalance({
    address,
    chainId: pepuMainnet.id,
  });

  // Contract addresses
  const MARKET_MANAGER_ADDRESS = process.env.NEXT_PUBLIC_P2P_MARKETMANAGER_ADDRESS as `0x${string}`;
  const ANALYTICS_ADDRESS = process.env.NEXT_PUBLIC_P2P_ANALYTICS_ADDRESS as `0x${string}`;

  const { writeContract, data: hash, isPending, error: writeError } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash,
  });

  // Fetch active markets
  const { data: activeMarketIds } = useReadContract({
    address: MARKET_MANAGER_ADDRESS,
    abi: MARKET_MANAGER_ABI,
    functionName: 'getActiveMarkets',
  });

  // Fetch total markets count
  const { data: totalMarkets } = useReadContract({
    address: MARKET_MANAGER_ADDRESS,
    abi: MARKET_MANAGER_ABI,
    functionName: 'getNextMarketId',
  });

  // No need for complex state management - each MarketCard handles its own data

  const handleBet = async (marketId: number, option: number, amount: string, isApproval = false) => {
    if (!isConnected || !address) {
      setError('Please connect your wallet');
      return;
    }

    try {
      const betAmount = parseEther(amount);
      
      // Get market data to determine payment token
      const provider = new ethers.JsonRpcProvider('https://rpc-pepu-v2-mainnet-0.t.conduit.xyz');
      const contract = new ethers.Contract(MARKET_MANAGER_ADDRESS, MARKET_MANAGER_ABI, provider);
      const market = await contract.getMarket(marketId);
      
      const paymentToken = market.paymentToken;
      const isERC20Market = paymentToken !== '0x0000000000000000000000000000000000000000';
      
      if (isApproval && isERC20Market) {
        // Handle ERC20 token approval
        await writeContract({
          address: paymentToken as `0x${string}`,
          abi: [
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
          ],
          functionName: 'approve',
          args: [MARKET_MANAGER_ADDRESS, betAmount],
        });
        setSuccess('Tokens approved! You can now place your bet.');
      } else if (isERC20Market) {
        // Handle ERC20 token betting
        await writeContract({
          address: MARKET_MANAGER_ADDRESS,
          abi: [
            {
              "inputs": [
                {"name": "marketId", "type": "uint256"},
                {"name": "option", "type": "uint256"},
                {"name": "amount", "type": "uint256"}
              ],
              "name": "placeBetWithToken",
              "outputs": [],
              "stateMutability": "nonpayable",
              "type": "function"
            }
          ],
          functionName: 'placeBetWithToken',
          args: [BigInt(marketId), BigInt(option), betAmount],
        });
      } else {
        // Handle native PEPU betting
        await writeContract({
          address: MARKET_MANAGER_ADDRESS,
          abi: MARKET_MANAGER_ABI,
          functionName: 'placeBet',
          args: [BigInt(marketId), BigInt(option)],
          value: betAmount,
        });
      }
    } catch (err: any) {
      setError(err.message || 'Failed to place bet');
    }
  };

  const handleSupport = async (marketId: number, amount: string) => {
    if (!isConnected || !address) {
      setError('Please connect your wallet');
      return;
    }

    try {
      const supportAmount = parseEther(amount);
      
      await writeContract({
        address: MARKET_MANAGER_ADDRESS,
        abi: MARKET_MANAGER_ABI,
        functionName: 'supportMarket',
        args: [BigInt(marketId), supportAmount],
      });
    } catch (err: any) {
      setError(err.message || 'Failed to support market');
    }
  };

  // State to store market details for filtering
  const [marketDetails, setMarketDetails] = useState<Map<number, any>>(new Map());

  // Fetch market details for filtering - simplified approach
  useEffect(() => {
    if (!Array.isArray(activeMarketIds)) return;
    
    const fetchMarketDetails = async () => {
      const details = new Map();
      
      for (const marketId of activeMarketIds) {
        try {
          // Use direct contract calls instead of API
          const provider = new ethers.JsonRpcProvider('https://rpc-pepu-v2-mainnet-0.t.conduit.xyz');
          const contract = new ethers.Contract(MARKET_MANAGER_ADDRESS, MARKET_MANAGER_ABI, provider);
          
          // Get market data
          const market = await contract.getMarket(marketId);
          
          // Fetch IPFS metadata
          let metadata = null;
          if (market.ipfsHash) {
            try {
              const ipfsUrl = `https://gateway.lighthouse.storage/ipfs/${market.ipfsHash}`;
              const metadataResponse = await fetch(ipfsUrl);
              if (metadataResponse.ok) {
                metadata = await metadataResponse.json();
              }
            } catch (error) {
              console.warn(`Failed to fetch IPFS metadata for market ${marketId}:`, error);
            }
          }
          
          // Get category from metadata, fallback to 'uncategorized'
          const category = metadata?.categories?.[0] || 'uncategorized';
          
          // Get market info for volume data
          let totalPool = 0;
          let bettorCount = 0;
          try {
            const marketInfo = await contract.getMarketInfo(marketId);
            totalPool = Number(marketInfo.totalPool);
            bettorCount = Number(marketInfo.bettorCount);
          } catch (error) {
            console.warn(`Failed to fetch market info for market ${marketId}:`, error);
          }
          
          const marketDetails = {
            id: Number(marketId),
            isMultiOption: market.isMultiOption,
            category: category,
            startTime: Number(market.startTime) * 1000, // Convert to milliseconds
            endTime: Number(market.endTime) * 1000, // Convert to milliseconds
            totalPool: totalPool,
            bettorCount: bettorCount,
          };
          
          console.log(`Market ${marketId} details:`, marketDetails);
          details.set(Number(marketId), marketDetails);
          
        } catch (error) {
          console.error(`Error fetching market ${marketId}:`, error);
        }
      }
      
      console.log('All market details:', details);
      setMarketDetails(details);
    };
    
    fetchMarketDetails();
  }, [activeMarketIds, MARKET_MANAGER_ADDRESS]);

  // Filter and sort markets based on current filter settings
  const filteredMarketIds = useMemo(() => {
    if (!Array.isArray(activeMarketIds)) return [];
    
    console.log('🔄 Filtering markets...', {
      totalMarkets: activeMarketIds.length,
      filterCategory,
      filterType,
      filterStatus,
      marketDetailsSize: marketDetails.size
    });
    
    let filtered = [...activeMarketIds].map(id => Number(id));
    
    // If no market details loaded yet, return all markets
    if (marketDetails.size === 0) {
      console.log('⚠️ No market details loaded yet, showing all markets');
      return filtered;
    }
    
    // Apply filters - all filters should work together (AND logic)
    filtered = filtered.filter(marketId => {
      const details = marketDetails.get(marketId);
      if (!details) {
        console.log(`⚠️ No details for market ${marketId}, including it`);
        return true; // Include if no details available
      }
      
      let passesTypeFilter = true;
      let passesCategoryFilter = true;
      let passesStatusFilter = true;
      
      // Filter by type
      if (filterType === 'yesno' && details.isMultiOption) {
        passesTypeFilter = false;
      }
      if (filterType === 'multiple' && !details.isMultiOption) {
        passesTypeFilter = false;
      }
      
      // Filter by category - handle case-insensitive matching
      if (filterCategory !== 'all') {
        const marketCategory = details.category?.toLowerCase() || 'uncategorized';
        const filterCategoryLower = filterCategory.toLowerCase();
        
        if (marketCategory !== filterCategoryLower) {
          passesCategoryFilter = false;
        }
      }
      
      // Filter by status
      const now = Date.now();
      const hoursUntilEnd = (details.endTime - now) / (1000 * 60 * 60);
      const daysSinceStart = (now - details.startTime) / (1000 * 60 * 60 * 24);
      
      if (filterStatus === 'ending-soon' && hoursUntilEnd > 24) {
        passesStatusFilter = false;
      }
      if (filterStatus === 'high-volume' && details.totalPool < 5000) {
        passesStatusFilter = false;
      }
      if (filterStatus === 'new' && daysSinceStart > 7) {
        passesStatusFilter = false;
      }
      
      const passesAllFilters = passesTypeFilter && passesCategoryFilter && passesStatusFilter;
      
      console.log(`Market ${marketId}:`, {
        category: details.category,
        isMultiOption: details.isMultiOption,
        totalPool: details.totalPool,
        passesType: passesTypeFilter,
        passesCategory: passesCategoryFilter,
        passesStatus: passesStatusFilter,
        overall: passesAllFilters
      });
      
      return passesAllFilters;
    });
    
    console.log(`✅ After filtering: ${filtered.length} markets remain`);
    
    // Apply sorting
    filtered.sort((a, b) => {
      const detailsA = marketDetails.get(a);
      const detailsB = marketDetails.get(b);
      
      if (!detailsA || !detailsB) return 0;
      
      switch (sortBy) {
        case 'newest':
          return detailsB.startTime - detailsA.startTime;
        case 'oldest':
          return detailsA.startTime - detailsB.startTime;
        case 'volume':
          return detailsB.totalPool - detailsA.totalPool;
        case 'participants':
          return detailsB.bettorCount - detailsA.bettorCount;
        case 'ending':
          return detailsA.endTime - detailsB.endTime;
        default:
          return 0;
      }
    });
    
    return filtered;
  }, [activeMarketIds, marketDetails, filterType, filterCategory, filterStatus, sortBy]);

  // Clear success message after 5 seconds
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => {
        setSuccess('');
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  const onMenuClick = () => setSidebarOpen(!sidebarOpen);
  const onSidebarClose = () => setSidebarOpen(false);
  const onToggleCollapse = () => setSidebarCollapsed(!sidebarCollapsed);

  return (
    <div className={`min-h-screen ${isDarkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
      {/* Sidebar */}
      <Sidebar 
        isOpen={sidebarOpen} 
        onClose={onSidebarClose} 
        collapsed={sidebarCollapsed}
        onToggleCollapse={onToggleCollapse}
        isDarkMode={isDarkMode}
      />

      {/* Main Content */}
      <div className={`transition-all duration-300 ${sidebarCollapsed ? 'ml-16' : 'ml-64'}`}>
        {/* Header */}
        <header className={`border-b ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              {/* Filter Controls */}
              <div className="flex flex-wrap items-center gap-3">
                {/* Market Type Filter */}
                <div className="flex items-center gap-2">
                  <Filter className={`w-4 h-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`} />
                  <select
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value)}
                    className={`px-3 py-2 border rounded-lg text-sm ${
                      isDarkMode 
                        ? 'bg-gray-800 border-gray-700 text-white' 
                        : 'bg-white border-gray-300 text-gray-900'
                    }`}
                  >
                    <option value="all">All Types</option>
                    <option value="yesno">Yes/No</option>
                    <option value="multiple">Multiple Choice</option>
                  </select>
                </div>

                {/* Category Filter */}
                <div className="flex items-center gap-2">
                  <Target className={`w-4 h-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`} />
                  <select
                    value={filterCategory}
                    onChange={(e) => setFilterCategory(e.target.value)}
                    className={`px-3 py-2 border rounded-lg text-sm ${
                      isDarkMode 
                        ? 'bg-gray-800 border-gray-700 text-white' 
                        : 'bg-white border-gray-300 text-gray-900'
                    }`}
                  >
                    <option value="all">All Categories</option>
                    <option value="crypto">Crypto</option>
                    <option value="sports">Sports</option>
                    <option value="politics">Politics</option>
                    <option value="entertainment">Entertainment</option>
                    <option value="technology">Technology</option>
                    <option value="business">Business</option>
                  </select>
                </div>

                {/* Status Filter */}
                <div className="flex items-center gap-2">
                  <Activity className={`w-4 h-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`} />
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className={`px-3 py-2 border rounded-lg text-sm ${
                      isDarkMode 
                        ? 'bg-gray-800 border-gray-700 text-white' 
                        : 'bg-white border-gray-300 text-gray-900'
                    }`}
                  >
                    <option value="active">Active</option>
                    <option value="ending-soon">Ending Soon</option>
                    <option value="high-volume">High Volume</option>
                    <option value="new">New Markets</option>
                  </select>
                </div>

                {/* Sort Options */}
                <div className="flex items-center gap-2">
                  <TrendingUp className={`w-4 h-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`} />
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className={`px-3 py-2 border rounded-lg text-sm ${
                      isDarkMode 
                        ? 'bg-gray-800 border-gray-700 text-white' 
                        : 'bg-white border-gray-300 text-gray-900'
                    }`}
                  >
                    <option value="newest">Newest First</option>
                    <option value="oldest">Oldest First</option>
                    <option value="volume">Volume</option>
                    <option value="participants">Most Participants</option>
                    <option value="ending">Ending Soon</option>
                  </select>
                </div>
              </div>

              {/* Theme and Connect */}
              <div className="flex items-center gap-4">
                <button
                  onClick={toggleTheme}
                  className={`p-2 rounded-lg ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}
                >
                  {isDarkMode ? <Sun className="w-5 h-5 text-yellow-400" /> : <Moon className="w-5 h-5 text-gray-600" />}
                </button>
                <ConnectButton />
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="p-6">
          {/* Simple Stats */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
            <div className={`rounded-lg border p-4 ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-xs font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Active Markets</p>
                  <p className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    {Array.isArray(activeMarketIds) ? activeMarketIds.length : 0}
                  </p>
                </div>
                <BarChart3 className={`w-5 h-5 ${isDarkMode ? 'text-blue-400' : 'text-blue-500'}`} />
              </div>
            </div>

            <div className={`rounded-lg border p-4 ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-xs font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Total Markets</p>
                  <p className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    {totalMarkets ? Number(totalMarkets) - 1 : 0}
                  </p>
                </div>
                <TrendingUp className={`w-5 h-5 ${isDarkMode ? 'text-green-400' : 'text-green-500'}`} />
              </div>
            </div>

            <div className={`rounded-lg border p-4 ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-xs font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Network</p>
                  <p className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    Pepe V2
                  </p>
                </div>
                <DollarSign className={`w-5 h-5 ${isDarkMode ? 'text-purple-400' : 'text-purple-500'}`} />
              </div>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className={`mb-6 p-4 rounded-lg ${isDarkMode ? 'bg-red-900 text-red-200' : 'bg-red-100 text-red-800'}`}>
              {error}
            </div>
          )}

          {/* Success Message */}
          {success && (
            <div className={`mb-6 p-4 rounded-lg ${isDarkMode ? 'bg-green-900 text-green-200' : 'bg-green-100 text-green-800'}`}>
              {success}
            </div>
          )}

          {/* Markets List */}
          {!Array.isArray(activeMarketIds) || activeMarketIds.length === 0 ? (
            <div className={`text-center py-12 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">No active markets</p>
              <p className="text-sm">Create a market to get started</p>
            </div>
          ) : filteredMarketIds.length === 0 ? (
            <div className={`text-center py-12 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              <Filter className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">No markets found</p>
              <p className="text-sm">
                {filterCategory !== 'all' 
                  ? `No markets found in the "${filterCategory}" category` 
                  : 'Try adjusting your filters'
                }
              </p>
              {filterCategory === 'entertainment' || filterCategory === 'sports' ? (
                <p className="text-xs mt-2 opacity-75">
                  Note: Currently all markets are categorized as "Crypto". 
                  Create markets with different categories to test filtering.
                </p>
              ) : null}
            </div>
          ) : (
            <div className="space-y-4">
              {filteredMarketIds.map((marketId: number) => (
                <MarketCard
                  key={marketId}
                  marketId={marketId}
                  isDarkMode={isDarkMode}
                  onBet={handleBet}
                  onSupport={handleSupport}
                />
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}