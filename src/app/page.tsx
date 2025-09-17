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
  Award,
  AlertTriangle
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
  },
  {
    "inputs": [{"name": "marketId", "type": "uint256"}],
    "name": "endMarket",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }
];

// Clean Market Card Component
function CleanMarketCard({ marketId, isDarkMode, onBet, onEndMarket }: {
  marketId: number;
  isDarkMode: boolean;
  onBet: (marketId: number, option: number, amount: string, isApproval?: boolean) => void;
  onEndMarket: (marketId: number) => void;
}) {
  const MARKET_MANAGER_ADDRESS = process.env.NEXT_PUBLIC_P2P_MARKETMANAGER_ADDRESS as `0x${string}`;

  const [betAmount, setBetAmount] = useState('');
  const [selectedOption, setSelectedOption] = useState(1);
  const [marketMetadata, setMarketMetadata] = useState<any>(null);
  const [loadingMetadata, setLoadingMetadata] = useState(false);
  const [needsApproval, setNeedsApproval] = useState(false);

  // Fetch market data
  const { data: market } = useReadContract({
    address: MARKET_MANAGER_ADDRESS,
    abi: MARKET_MANAGER_ABI,
    functionName: 'getMarket',
    args: [BigInt(marketId)],
  }) as { data: MarketData | undefined };

  // Get token symbol
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

  // Get option pools
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

  // Get participant counts
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
  const { data: tokenAllowance } = useReadContract({
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

  // Check if this is an ERC20 market
  const isERC20Market = market?.paymentToken && market.paymentToken !== '0x0000000000000000000000000000000000000000';

  // Check approval needs
  const requiredAmount = betAmount ? parseEther(betAmount) : BigInt(0);
  const hasSufficientAllowance = tokenAllowance !== undefined && betAmount ? tokenAllowance >= requiredAmount : false;
  const needsTokenApproval = isERC20Market && betAmount && !hasSufficientAllowance;

  // Fetch IPFS metadata
  useEffect(() => {
    const marketData = market as any;
    if (market && marketData.ipfsHash && !marketMetadata && !loadingMetadata) {
      setLoadingMetadata(true);
      const fetchMetadata = async () => {
        try {
          const ipfsHash = marketData.ipfsHash;
          const gatewayUrl = `https://gateway.lighthouse.storage/ipfs/${ipfsHash}`;
          
          const response = await fetch(gatewayUrl);
          if (response.ok) {
            const metadata = await response.json();
            setMarketMetadata(metadata);
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

  if (!market) {
    return (
      <div className={`border rounded-lg p-4 ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
        <div className="animate-pulse">
          <div className={`h-4 rounded mb-2 ${isDarkMode ? 'bg-gray-600' : 'bg-gray-300'}`}></div>
          <div className={`h-3 rounded mb-3 ${isDarkMode ? 'bg-gray-600' : 'bg-gray-300'}`}></div>
          <div className="flex justify-between">
            <div className={`h-6 w-20 rounded ${isDarkMode ? 'bg-gray-600' : 'bg-gray-300'}`}></div>
            <div className={`h-6 w-16 rounded ${isDarkMode ? 'bg-gray-600' : 'bg-gray-300'}`}></div>
          </div>
        </div>
      </div>
    );
  }

  const marketData = market;
  const timeLeft = Number(marketData.endTime) - Math.floor(Date.now() / 1000);
  const hoursLeft = Math.max(0, Math.floor(timeLeft / 3600));
  const minutesLeft = Math.max(0, Math.floor((timeLeft % 3600) / 60));
  const canEndMarket = marketData.state === 0 && timeLeft <= 0;

  // Skip markets that are not active (ended, resolved, etc.)
  if (marketData.state !== 0) {
    return null; // Don't render non-active markets
  }

  const getMarketTitle = () => {
    if (loadingMetadata) return 'Loading...';
    if (marketMetadata?.title) return marketMetadata.title;
    return `Market #${marketId}`;
  };

  const getMarketDescription = () => {
    if (loadingMetadata) return 'Loading...';
    if (marketMetadata?.description) return marketMetadata.description;
    return marketData.isMultiOption ? 'Multiple choice market' : 'Yes/No market';
  };

  const getMarketOptions = () => {
    if (marketMetadata?.options && Array.isArray(marketMetadata.options)) {
      return marketMetadata.options;
    }
    return ['Yes', 'No'];
  };

  // Calculate total pool
  const getTotalPool = () => {
    const optionPools = [option1Pool || BigInt(0), option2Pool || BigInt(0), option3Pool || BigInt(0), option4Pool || BigInt(0)];
    const maxOptions = market ? Number(market.maxOptions) : 2;
    const relevantPools = optionPools.slice(0, maxOptions);
    return relevantPools.reduce((sum, pool) => sum + pool, BigInt(0));
  };

  // Calculate option percentages
  const getOptionPercentage = (optionIndex: number) => {
    const optionPools = [option1Pool || BigInt(0), option2Pool || BigInt(0), option3Pool || BigInt(0), option4Pool || BigInt(0)];
    const maxOptions = market ? Number(market.maxOptions) : 2;
    const relevantPools = optionPools.slice(0, maxOptions);
    const totalPool = relevantPools.reduce((sum, pool) => sum + pool, BigInt(0));
    
    if (totalPool === BigInt(0)) return 0;
    const optionPool = relevantPools[optionIndex] || BigInt(0);
    return Number((optionPool * BigInt(100)) / totalPool);
  };

  const totalParticipants = (bettorCount ? Number(bettorCount) : 0) + (supporterCount ? Number(supporterCount) : 0) + 1;

  const formatTime = () => {
    if (canEndMarket) return 'Ready to End';
    if (hoursLeft > 24) return `${Math.floor(hoursLeft / 24)}d ${hoursLeft % 24}h`;
    if (hoursLeft > 0) return `${hoursLeft}h ${minutesLeft}m`;
    return `${minutesLeft}m`;
  };

  return (
    <div className={`border rounded-lg overflow-hidden transition-all duration-200 hover:shadow-md ${
      isDarkMode ? 'bg-gray-800 border-gray-700 hover:shadow-gray-900/20' : 'bg-white border-gray-200 hover:shadow-gray-900/10'
    }`}>
      {/* Header */}
      <div className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0 pr-4">
            <div className="flex items-center gap-2 mb-1">
              <h3 className={`font-semibold text-base truncate ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                {getMarketTitle()}
              </h3>
              <div className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                marketData.isMultiOption 
                  ? (isDarkMode ? 'bg-purple-900/50 text-purple-300' : 'bg-purple-100 text-purple-800')
                  : (isDarkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-800')
              }`}>
                {marketData.isMultiOption ? 'Multiple' : 'Yes/No'}
              </div>
            </div>
            <p className={`text-sm line-clamp-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              {getMarketDescription()}
            </p>
          </div>
          
          <div className="flex flex-col items-end text-right">
            <div className={`text-base font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              {formatEther(getTotalPool())} {tokenSymbol || 'PEPU'}
            </div>
            <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
              <div className="flex items-center gap-1">
                <Users size={12} />
                <span>{totalParticipants}</span>
            </div>
              <div className="flex items-center gap-1">
                <Clock size={12} />
                <span className={canEndMarket ? 'text-orange-500' : ''}>{formatTime()}</span>
            </div>
          </div>
        </div>
      </div>

        {/* Market Options */}
        <div className="space-y-2 mb-4">
              {getMarketOptions().map((option: string, index: number) => {
                const percentage = getOptionPercentage(index);
                const isSelected = selectedOption === index + 1;
                
                return (
              <div
                    key={index}
                className={`flex items-center justify-between p-2 rounded border text-sm cursor-pointer transition-colors ${
                      isSelected 
                    ? (isDarkMode ? 'border-blue-500 bg-blue-500/10' : 'border-blue-500 bg-blue-50')
                    : (isDarkMode ? 'border-gray-600 hover:bg-gray-700' : 'border-gray-200 hover:bg-gray-50')
                    }`}
                onClick={() => !canEndMarket && setSelectedOption(index + 1)}
                  >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                    <input
                      type="radio"
                    name={`option-${marketId}`}
                      value={index + 1}
                      checked={isSelected}
                    onChange={() => !canEndMarket && setSelectedOption(index + 1)}
                    disabled={canEndMarket}
                    className="w-3 h-3 flex-shrink-0"
                    />
                  <span className={`font-medium truncate ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                      {option}
                    </span>
                </div>
                
                <div className="flex items-center gap-2 text-xs">
                  <span className={`font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                      {percentage}%
                    </span>
                </div>
              </div>
                );
              })}
          </div>

        {/* Actions */}
        {canEndMarket ? (
          // Only show end market button if market can be ended
          <button
            onClick={() => onEndMarket(marketId)}
            className={`w-full py-2 px-3 rounded text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
              isDarkMode 
                ? 'bg-orange-600 hover:bg-orange-700 text-white' 
                : 'bg-orange-500 hover:bg-orange-600 text-white'
            }`}
          >
            <Timer size={16} />
            End Market
          </button>
        ) : (
          // Show betting interface if market is still active
              <div className="flex gap-2">
                <input
                  type="number"
                  value={betAmount}
                  onChange={(e) => setBetAmount(e.target.value)}
                  placeholder="Amount"
              className={`flex-1 px-2 py-1.5 border rounded text-sm ${
                    isDarkMode 
                  ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                      : 'bg-white border-gray-300 text-gray-900'
                  }`}
                />
                {needsTokenApproval ? (
                  <button
                onClick={() => onBet(marketId, selectedOption, betAmount, true)}
                disabled={!betAmount}
                className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                  !betAmount
                        ? 'bg-gray-400 cursor-not-allowed text-gray-200'
                        : isDarkMode 
                          ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                          : 'bg-blue-500 hover:bg-blue-600 text-white'
                    }`}
                  >
                Approve
                  </button>
                ) : (
                  <button
                    onClick={() => onBet(marketId, selectedOption, betAmount)}
                    disabled={!betAmount}
                className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
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
        )}

        {/* Warning for token approval */}
              {needsTokenApproval && (
                <p className="text-xs text-yellow-600 mt-1">
            Approve {tokenSymbol || 'tokens'} before betting
                </p>
              )}
            </div>
    </div>
  );
}

// Main Page Component
export default function HomePage() {
  const { isDarkMode, toggleTheme } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [filterType, setFilterType] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const { address, isConnected } = useAccount();

  // Contract addresses
  const MARKET_MANAGER_ADDRESS = process.env.NEXT_PUBLIC_P2P_MARKETMANAGER_ADDRESS as `0x${string}`;

  const { writeContract } = useWriteContract();

  // Fetch only truly active markets (state = 0)
  const { data: activeMarketIds } = useReadContract({
    address: MARKET_MANAGER_ADDRESS,
    abi: MARKET_MANAGER_ABI,
    functionName: 'getActiveMarkets',
  });

  // State to store market details for filtering
  const [marketDetails, setMarketDetails] = useState<Map<number, any>>(new Map());

  // Fetch market details for proper filtering
  useEffect(() => {
    if (!Array.isArray(activeMarketIds)) return;
    
    const fetchMarketDetails = async () => {
      const details = new Map();
      
      for (const marketId of activeMarketIds) {
        try {
          const provider = new ethers.JsonRpcProvider('https://rpc-pepu-v2-mainnet-0.t.conduit.xyz');
          const contract = new ethers.Contract(MARKET_MANAGER_ADDRESS, MARKET_MANAGER_ABI, provider);
          
          // Get market data
          const market = await contract.getMarket(marketId);
          
          const marketDetails = {
            id: Number(marketId),
            state: Number(market.state),
            endTime: Number(market.endTime),
            isMultiOption: market.isMultiOption,
          };
          
          details.set(Number(marketId), marketDetails);
          
        } catch (error) {
          console.error(`Error fetching market ${marketId}:`, error);
        }
      }
      
      setMarketDetails(details);
    };
    
    fetchMarketDetails();
  }, [activeMarketIds, MARKET_MANAGER_ADDRESS]);

  // Filter markets to only show truly active ones (state 0)
  const filteredActiveMarkets = useMemo(() => {
    if (!Array.isArray(activeMarketIds)) return [];
    
    return [...activeMarketIds].map(id => Number(id)).filter(marketId => {
      const details = marketDetails.get(marketId);
      if (!details) return true; // Include if no details available yet
      
      // Only include markets with state 0 (active)
      return details.state === 0;
    });
  }, [activeMarketIds, marketDetails]);

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
        setSuccess('Bet placed successfully!');
      } else {
        // Handle native PEPU betting
        await writeContract({
          address: MARKET_MANAGER_ADDRESS,
          abi: MARKET_MANAGER_ABI,
          functionName: 'placeBet',
          args: [BigInt(marketId), BigInt(option)],
          value: betAmount,
        });
        setSuccess('Bet placed successfully!');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to place bet');
    }
  };

  const handleEndMarket = async (marketId: number) => {
    if (!isConnected || !address) {
      setError('Please connect your wallet');
      return;
    }

    try {
      await writeContract({
        address: MARKET_MANAGER_ADDRESS,
        abi: MARKET_MANAGER_ABI,
        functionName: 'endMarket',
        args: [BigInt(marketId)],
      });
      setSuccess(`Market #${marketId} ended successfully! Resolution period has started.`);
    } catch (err: any) {
      setError(err.message || 'Failed to end market');
    }
  };

  // Clear success/error messages after 5 seconds
  useEffect(() => {
    if (success || error) {
      const timer = setTimeout(() => {
        setSuccess('');
        setError('');
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [success, error]);

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
              <div>
                <h1 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  Active Markets
                </h1>
                <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  Place bets on live prediction markets
                </p>
              </div>

              {/* Filter Controls */}
              <div className="flex items-center gap-4">
                {/* Type Filter */}
                  <select
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value)}
                  className={`px-3 py-1.5 border rounded text-sm ${
                      isDarkMode 
                        ? 'bg-gray-800 border-gray-700 text-white' 
                        : 'bg-white border-gray-300 text-gray-900'
                    }`}
                  >
                    <option value="all">All Types</option>
                    <option value="yesno">Yes/No</option>
                    <option value="multiple">Multiple Choice</option>
                  </select>

                {/* Sort */}
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                  className={`px-3 py-1.5 border rounded text-sm ${
                      isDarkMode 
                        ? 'bg-gray-800 border-gray-700 text-white' 
                        : 'bg-white border-gray-300 text-gray-900'
                    }`}
                  >
                  <option value="newest">Newest</option>
                    <option value="volume">Volume</option>
                    <option value="ending">Ending Soon</option>
                  </select>

                <button
                  onClick={toggleTheme}
                  className={`p-2 rounded-lg transition-colors ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}
                >
                  {isDarkMode ? <Sun className="w-5 h-5 text-yellow-400" /> : <Moon className="w-5 h-5 text-gray-600" />}
                </button>
                
                {/* Wallet Connection */}
                {isConnected ? (
                  <div className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm font-medium ${
                    isDarkMode 
                      ? 'bg-emerald-600/10 text-emerald-400 border border-emerald-600/20' 
                      : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  }`}>
                    <Wallet size={14} />
                    <span className="font-mono">{address?.slice(0, 6)}...{address?.slice(-4)}</span>
                  </div>
                ) : (
                <ConnectButton />
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="p-6">
          {/* Alert Messages */}
          {error && (
            <div className={`mb-6 p-4 rounded-lg border flex items-center gap-3 ${
              isDarkMode ? 'bg-red-900/20 border-red-800 text-red-300' : 'bg-red-50 border-red-200 text-red-800'
            }`}>
              <AlertTriangle size={20} className="flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className={`mb-6 p-4 rounded-lg border flex items-center gap-3 ${
              isDarkMode ? 'bg-green-900/20 border-green-800 text-green-300' : 'bg-green-50 border-green-200 text-green-800'
            }`}>
              <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
                <div className="w-2 h-2 bg-white rounded-full"></div>
              </div>
              <span>{success}</span>
            </div>
          )}

           {/* Market Stats */}
           <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className={`rounded-lg border p-4 ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
              <div className="flex items-center justify-between">
                <div>
                   <p className={`text-sm font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Active Markets</p>
                   <p className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                     {filteredActiveMarkets.length}
                  </p>
                </div>
                 <BarChart3 className={`w-8 h-8 ${isDarkMode ? 'text-blue-400' : 'text-blue-500'}`} />
              </div>
            </div>

            <div className={`rounded-lg border p-4 ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-sm font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Network</p>
                  <p className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    Pepe V2
                  </p>
                </div>
                <DollarSign className={`w-8 h-8 ${isDarkMode ? 'text-green-400' : 'text-green-500'}`} />
              </div>
            </div>

            <div className={`rounded-lg border p-4 ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-sm font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Status</p>
                  <p className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    Live
                  </p>
                </div>
                <Activity className={`w-8 h-8 ${isDarkMode ? 'text-purple-400' : 'text-purple-500'}`} />
              </div>
            </div>
          </div>

          {/* Markets Grid */}
          {!Array.isArray(activeMarketIds) || activeMarketIds.length === 0 ? (
            <div className="text-center py-16">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${
                isDarkMode ? 'bg-gray-800' : 'bg-gray-100'
              }`}>
                <BarChart3 className={`w-8 h-8 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`} />
            </div>
              <h3 className={`text-lg font-semibold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                No Active Markets
              </h3>
              <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                Be the first to create a prediction market!
              </p>
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
              {filteredActiveMarkets.map((marketId: number) => (
                <CleanMarketCard
                  key={marketId}
                  marketId={marketId}
                  isDarkMode={isDarkMode}
                  onBet={handleBet}
                  onEndMarket={handleEndMarket}
                />
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}