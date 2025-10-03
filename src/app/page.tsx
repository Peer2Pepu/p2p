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
import { MarketCard } from '../components/MarketCard';
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
  stakeEndTime: bigint;
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
          {"name": "stakeEndTime", "type": "uint256"},
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
          {"name": "stakeEndTime", "type": "uint256"},
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
      {"name": "stakerCount", "type": "uint256"},
      {"name": "supporterCount", "type": "uint256"},
      {"name": "stakers", "type": "address[]"},
      {"name": "supporters", "type": "address[]"},
      {"name": "tokenSymbol", "type": "string"}
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"name": "marketId", "type": "uint256"}, {"name": "option", "type": "uint256"}],
    "name": "placeStake",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [{"name": "marketId", "type": "uint256"}, {"name": "option", "type": "uint256"}, {"name": "amount", "type": "uint256"}],
    "name": "placeStakeWithToken",
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
  },
  {
    "inputs": [{"name": "marketId", "type": "uint256"}],
    "name": "getStakerCount",
    "outputs": [{"name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"name": "marketId", "type": "uint256"}],
    "name": "getSupporterCount",
    "outputs": [{"name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"name": "marketId", "type": "uint256"}, {"name": "option", "type": "uint256"}, {"name": "token", "type": "address"}],
    "name": "getOptionPool",
    "outputs": [{"name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"name": "marketId", "type": "uint256"}, {"name": "user", "type": "address"}],
    "name": "userHasStaked",
    "outputs": [{"name": "", "type": "bool"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"name": "marketId", "type": "uint256"}, {"name": "user", "type": "address"}],
    "name": "userStakeOptions",
    "outputs": [{"name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  }
];


// Main Page Component
export default function HomePage() {
  const { isDarkMode, toggleTheme } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [filterType, setFilterType] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const [showFilters, setShowFilters] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const { address, isConnected } = useAccount();

  // Contract addresses
  const MARKET_MANAGER_ADDRESS = process.env.NEXT_PUBLIC_P2P_MARKET_MANAGER_ADDRESS as `0x${string}`;
  const ANALYTICS_ADDRESS = process.env.NEXT_PUBLIC_P2P_ANALYTICS_ADDRESS as `0x${string}`;

  const { writeContract } = useWriteContract();

  // Fetch only truly active markets (state = 0)
  const { data: activeMarketIds } = useReadContract({
    address: MARKET_MANAGER_ADDRESS,
    abi: MARKET_MANAGER_ABI,
    functionName: 'getActiveMarkets',
  });

  // State to store market details for filtering
  const [marketDetails, setMarketDetails] = useState<Map<number, any>>(new Map());

  // Analytics data
  const [totalParticipants, setTotalParticipants] = useState<number>(0);
  const [totalVolume, setTotalVolume] = useState<string>('0');

  // Fetch market details and analytics for proper filtering
  useEffect(() => {
    if (!Array.isArray(activeMarketIds) || activeMarketIds.length === 0) {
      setTotalParticipants(0);
      setTotalVolume('0');
      setMarketDetails(new Map());
      return;
    }
    
    const fetchMarketDetailsAndAnalytics = async () => {
      const details = new Map();
      let totalParticipantsCount = 0;
      let totalVolumeAmount = BigInt(0);
      
      for (const marketId of activeMarketIds) {
        try {
          const provider = new ethers.JsonRpcProvider('https://rpc-pepu-v2-mainnet-0.t.conduit.xyz');
          const contract = new ethers.Contract(MARKET_MANAGER_ADDRESS, MARKET_MANAGER_ABI, provider);
          
          const market = await contract.getMarket(marketId);
          const stakerCount = await contract.getStakerCount(marketId);
          const supporterCount = await contract.getSupporterCount(marketId);
          const participants = Number(stakerCount) + Number(supporterCount) + 1;
          totalParticipantsCount += participants;
          
          const option1Pool = await contract.getOptionPool(marketId, 1, market.paymentToken);
          const option2Pool = await contract.getOptionPool(marketId, 2, market.paymentToken);
          const option3Pool = await contract.getOptionPool(marketId, 3, market.paymentToken);
          const option4Pool = await contract.getOptionPool(marketId, 4, market.paymentToken);
          
          const marketVolume = option1Pool + option2Pool + option3Pool + option4Pool;
          totalVolumeAmount += marketVolume;
          
          const marketDetails = {
            id: Number(marketId),
            state: Number(market.state),
            endTime: Number(market.endTime),
            isMultiOption: market.isMultiOption,
            participants,
            volume: marketVolume,
          };
          
          details.set(Number(marketId), marketDetails);
          
        } catch (error) {
          console.error(`Error fetching market ${marketId}:`, error);
        }
      }
      
      setMarketDetails(details);
      setTotalParticipants(totalParticipantsCount);
      setTotalVolume(ethers.formatEther(totalVolumeAmount));
    };
    
    fetchMarketDetailsAndAnalytics();
  }, [activeMarketIds, MARKET_MANAGER_ADDRESS]);

  // Filter markets to only show truly active ones (state 0)
  const filteredActiveMarkets = useMemo(() => {
    if (!Array.isArray(activeMarketIds)) return [];
    
    return [...activeMarketIds].map(id => Number(id)).filter(marketId => {
      const details = marketDetails.get(marketId);
      if (!details) return true;
      return details.state === 0;
    });
  }, [activeMarketIds, marketDetails]);

  const handleBet = async (marketId: number, option: number, amount: string, isApproval = false) => {
    if (!isConnected || !address) {
      setError('Please connect your wallet');
      return;
    }

    try {
      const stakeAmount = parseEther(amount);
      
      const provider = new ethers.JsonRpcProvider('https://rpc-pepu-v2-mainnet-0.t.conduit.xyz');
      const contract = new ethers.Contract(MARKET_MANAGER_ADDRESS, MARKET_MANAGER_ABI, provider);
      const market = await contract.getMarket(marketId);
      
      const paymentToken = market.paymentToken;
      const isERC20Market = paymentToken !== '0x0000000000000000000000000000000000000000';
      
      if (isApproval && isERC20Market) {
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
          args: [MARKET_MANAGER_ADDRESS, stakeAmount],
          gas: BigInt(500000), // Gas limit for approval
        });
        setSuccess('Tokens approved! You can now place your stake.');
        
        // Refetch allowance to auto-detect approval
        setTimeout(() => {
          window.location.reload(); // Simple refresh to update allowance
        }, 2000);
        
      } else if (isERC20Market) {
        await writeContract({
          address: MARKET_MANAGER_ADDRESS,
          abi: [
            {
              "inputs": [
                {"name": "marketId", "type": "uint256"},
                {"name": "option", "type": "uint256"},
                {"name": "amount", "type": "uint256"}
              ],
              "name": "placeStakeWithToken",
              "outputs": [],
              "stateMutability": "nonpayable",
              "type": "function"
            }
          ],
          functionName: 'placeStakeWithToken',
          args: [BigInt(marketId), BigInt(option), stakeAmount],
          gas: BigInt(600000), // Gas limit for staking with token
        });
        setSuccess('Successfully added a stake!');
      } else {
        await writeContract({
          address: MARKET_MANAGER_ADDRESS,
          abi: MARKET_MANAGER_ABI,
          functionName: 'placeStake',
          args: [BigInt(marketId), BigInt(option)],
          value: stakeAmount,
          gas: BigInt(500000), // Gas limit for native staking
        });
        setSuccess('Successfully added a stake!');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to place stake');
    }
  };

  const handleEndMarket = async (marketId: number) => {
    if (!isConnected || !address) {
      setError('Please connect your wallet');
      return;
    }

    try {
      const marketData = marketDetails.get(marketId);
      if (!marketData) {
        setError('Market data not available');
        return;
      }

      const currentTime = Math.floor(Date.now() / 1000);
      const isCreator = marketData.creator && address && marketData.creator.toLowerCase() === address.toLowerCase();
      const isAfterEndTime = currentTime >= Number(marketData.endTime);

      if (isCreator && !isAfterEndTime) {
        setError('Creator early ending not yet implemented in contract. Please wait for endTime.');
        return;
      } else if (isAfterEndTime) {
      await writeContract({
        address: MARKET_MANAGER_ADDRESS,
        abi: MARKET_MANAGER_ABI,
          functionName: 'endMarket',
          args: [BigInt(marketId)],
      });
        setSuccess(`Market #${marketId} ended successfully! Resolution period has started.`);
      } else {
        setError('Only the market creator can end the market early, or wait for the end time');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to end market');
    }
  };

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

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showFilters && !(event.target as Element).closest('.filters-dropdown')) {
        setShowFilters(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showFilters]);

  return (
    <div className={`min-h-screen ${isDarkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
      <Sidebar 
        isOpen={sidebarOpen} 
        onClose={onSidebarClose} 
        collapsed={sidebarCollapsed}
        onToggleCollapse={onToggleCollapse}
        isDarkMode={isDarkMode}
      />

      <div className={`transition-all duration-300 lg:${sidebarCollapsed ? 'ml-16' : 'ml-64'}`}>
        <header className={`border-b ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
          <div className="px-4 lg:px-6 py-3 lg:py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setSidebarOpen(true)}
                  className={`lg:hidden p-2 rounded-lg transition-colors ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}
                >
                  <Menu size={20} className={isDarkMode ? 'text-white' : 'text-gray-900'} />
                </button>
                
                <div className="lg:hidden">
                  <h1 className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    P2P
                  </h1>
                </div>
                
                <div className="hidden lg:block">
                <h1 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  Active Markets
                </h1>
                <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  Place bets on live prediction markets
                </p>
                </div>
              </div>

              <div className="flex items-center gap-2 lg:gap-4">
                <div className="relative filters-dropdown">
                  <button
                    className={`flex items-center gap-1 px-2 py-1.5 border rounded text-xs lg:text-sm transition-colors ${
                      isDarkMode 
                        ? 'bg-gray-800 border-gray-700 text-white hover:bg-gray-700' 
                        : 'bg-white border-gray-300 text-gray-900 hover:bg-gray-50'
                    }`}
                    onClick={() => setShowFilters(!showFilters)}
                  >
                    <Filter size={14} />
                    <span className="hidden sm:inline">Filters</span>
                    <ChevronDown size={12} />
                  </button>
                  
                  {showFilters && (
                    <div className={`absolute top-full right-0 mt-1 w-48 rounded-lg border shadow-lg z-50 ${
                      isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
                    }`}>
                      <div className="p-3 space-y-3">
                        <div>
                          <label className={`block text-xs font-medium mb-1 ${
                            isDarkMode ? 'text-gray-300' : 'text-gray-700'
                          }`}>
                            Market Type
                          </label>
                  <select
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value)}
                            className={`w-full px-2 py-1.5 border rounded text-xs ${
                      isDarkMode 
                                ? 'bg-gray-700 border-gray-600 text-white' 
                        : 'bg-white border-gray-300 text-gray-900'
                    }`}
                  >
                    <option value="all">All Types</option>
                    <option value="yesno">Yes/No</option>
                    <option value="multiple">Multiple Choice</option>
                  </select>
                        </div>
                        
                        <div>
                          <label className={`block text-xs font-medium mb-1 ${
                            isDarkMode ? 'text-gray-300' : 'text-gray-700'
                          }`}>
                            Sort By
                          </label>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                            className={`w-full px-2 py-1.5 border rounded text-xs ${
                      isDarkMode 
                                ? 'bg-gray-700 border-gray-600 text-white' 
                        : 'bg-white border-gray-300 text-gray-900'
                    }`}
                  >
                  <option value="newest">Newest</option>
                    <option value="volume">Volume</option>
                    <option value="ending">Ending Soon</option>
                  </select>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <button
                  onClick={toggleTheme}
                  className={`p-1.5 lg:p-2 rounded-lg transition-colors ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}
                >
                  {isDarkMode ? <Sun className="w-4 h-4 lg:w-5 lg:h-5 text-yellow-400" /> : <Moon className="w-4 h-4 lg:w-5 lg:h-5 text-gray-600" />}
                </button>
                
                {isConnected ? (
                  <div className={`flex items-center gap-1 lg:gap-2 px-2 lg:px-3 py-1.5 rounded text-xs lg:text-sm font-medium ${
                    isDarkMode 
                      ? 'bg-emerald-600/10 text-emerald-400 border border-emerald-600/20' 
                      : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  }`}>
                    <Wallet size={12} className="lg:w-3.5 lg:h-3.5" />
                    <span className="font-mono text-xs lg:text-sm">{address?.slice(0, 6)}...{address?.slice(-4)}</span>
                  </div>
                ) : (
                  <div className="scale-90 lg:scale-100">
                <ConnectButton />
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        <main className="p-4 lg:p-6">
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

           <div className={`flex items-center justify-between p-2 lg:p-3 rounded-lg border mb-4 lg:mb-6 ${
             isDarkMode ? 'bg-gray-800/50 border-gray-700' : 'bg-gray-50 border-gray-200'
           }`}>
            <div className="flex items-center gap-3 lg:gap-6">
              <div className="flex items-center gap-1 lg:gap-2">
                <div className={`w-1.5 h-1.5 lg:w-2 lg:h-2 rounded-full ${isDarkMode ? 'bg-green-400' : 'bg-green-500'}`}></div>
                <span className={`text-xs lg:text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  {filteredActiveMarkets.length} Active
                </span>
              </div>
              
              {isConnected && address && (
                <>
                  <div className={`w-px h-3 lg:h-4 ${isDarkMode ? 'bg-gray-600' : 'bg-gray-300'}`}></div>
                  <div className="flex items-center gap-1 lg:gap-2">
                    <Users size={12} className={`lg:w-3.5 lg:h-3.5 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`} />
                    <span className={`text-xs lg:text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                      {totalParticipants || 0} Participants
                    </span>
                  </div>
                  
                  <div className={`w-px h-3 lg:h-4 ${isDarkMode ? 'bg-gray-600' : 'bg-gray-300'}`}></div>
                  <div className="flex items-center gap-1 lg:gap-2">
                    <TrendingUp size={12} className={`lg:w-3.5 lg:h-3.5 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`} />
                    <span className={`text-xs lg:text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                      {totalVolume || '0'} PEPU Volume
                    </span>
                  </div>
                </>
              )}
            </div>
            
            <div className="flex items-center gap-2">
              <div className={`px-1.5 lg:px-2 py-0.5 lg:py-1 rounded text-xs font-medium ${
                isDarkMode ? 'bg-emerald-900/30 text-emerald-400' : 'bg-emerald-100 text-emerald-700'
              }`}>
                Live
              </div>
            </div>
          </div>

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
            <div className={`grid gap-4 transition-all duration-300 ${
              sidebarCollapsed 
                ? 'sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5' 
                : 'sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3'
            }`}>
              {filteredActiveMarkets.map((marketId: number) => (
                <MarketCard
                  key={marketId}
                  marketId={marketId}
                  isDarkMode={isDarkMode}
                  onBet={handleBet}
                  onEndMarket={handleEndMarket}
                  userAddress={address}
                />
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}