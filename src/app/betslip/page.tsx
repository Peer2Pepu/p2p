"use client";

import React, { useState, useEffect } from 'react';
import { 
  Receipt,
  Clock,
  TrendingUp,
  Award,
  ChevronDown,
  ChevronUp,
  Sun,
  Moon,
  Wallet,
  Users,
  DollarSign,
  Activity,
  AlertTriangle,
  CheckCircle
} from 'lucide-react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, useReadContract } from 'wagmi';
import { formatEther } from 'viem';
import { Sidebar } from '../components/Sidebar';
import { useTheme } from '../context/ThemeContext';

// Contract ABIs
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
    "inputs": [{"name": "marketId", "type": "uint256"}, {"name": "user", "type": "address"}, {"name": "token", "type": "address"}],
    "name": "getUserBet",
    "outputs": [{"name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"name": "marketId", "type": "uint256"}, {"name": "user", "type": "address"}],
    "name": "hasUserClaimed",
    "outputs": [{"name": "", "type": "bool"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"name": "marketId", "type": "uint256"}, {"name": "user", "type": "address"}],
    "name": "userBetOptions",
    "outputs": [{"name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"name": "token", "type": "address"}],
    "name": "tokenSymbols",
    "outputs": [{"name": "", "type": "string"}],
    "stateMutability": "view",
    "type": "function"
  }
];

const ANALYTICS_ABI = [
  {
    "inputs": [{"name": "user", "type": "address"}, {"name": "state", "type": "uint8"}],
    "name": "getUserMarketsByState",
    "outputs": [{"name": "", "type": "uint256[]"}],
    "stateMutability": "view",
    "type": "function"
  }
];

const TREASURY_ABI = [
  {
    "inputs": [{"name": "marketId", "type": "uint256"}, {"name": "user", "type": "address"}, {"name": "token", "type": "address"}],
    "name": "getUserBet",
    "outputs": [{"name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"name": "marketId", "type": "uint256"}, {"name": "user", "type": "address"}],
    "name": "hasUserClaimed",
    "outputs": [{"name": "", "type": "bool"}],
    "stateMutability": "view",
    "type": "function"
  }
];

// Betslip Card Component
function BetslipCard({ marketId, userAddress, isDarkMode }: {
  marketId: number;
  userAddress: `0x${string}`;
  isDarkMode: boolean;
}) {
  const MARKET_MANAGER_ADDRESS = process.env.NEXT_PUBLIC_P2P_MARKETMANAGER_ADDRESS as `0x${string}`;
  const TREASURY_ADDRESS = process.env.NEXT_PUBLIC_P2P_TREASURY_ADDRESS as `0x${string}`;

  // Fetch market data
  const { data: market } = useReadContract({
    address: MARKET_MANAGER_ADDRESS,
    abi: MARKET_MANAGER_ABI,
    functionName: 'getMarket',
    args: [BigInt(marketId)],
  });

  // Get user's bet amount
  const { data: userBetAmount } = useReadContract({
    address: TREASURY_ADDRESS,
    abi: TREASURY_ABI,
    functionName: 'getUserBet',
    args: [BigInt(marketId), userAddress, market?.paymentToken || '0x0000000000000000000000000000000000000000'],
  });

  // Check if user has claimed
  const { data: hasClaimed } = useReadContract({
    address: TREASURY_ADDRESS,
    abi: TREASURY_ABI,
    functionName: 'hasUserClaimed',
    args: [BigInt(marketId), userAddress],
  });

  // Get user's bet option
  const { data: userBetOption } = useReadContract({
    address: MARKET_MANAGER_ADDRESS,
    abi: MARKET_MANAGER_ABI,
    functionName: 'userBetOptions',
    args: [BigInt(marketId), userAddress],
  });

  // Get token symbol
  const { data: tokenSymbol } = useReadContract({
    address: MARKET_MANAGER_ADDRESS,
    abi: MARKET_MANAGER_ABI,
    functionName: 'tokenSymbols',
    args: [market?.paymentToken || '0x0000000000000000000000000000000000000000'],
  });

  const [marketMetadata, setMarketMetadata] = useState<any>(null);
  const [loadingMetadata, setLoadingMetadata] = useState(false);

  // Fetch IPFS metadata
  useEffect(() => {
    if (market && !marketMetadata && !loadingMetadata) {
      setLoadingMetadata(true);
      const fetchMetadata = async () => {
        try {
          const ipfsHash = (market as any).ipfsHash;
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

  if (!market || !userBetAmount || userBetAmount === BigInt(0)) {
    return null; // Don't show markets where user didn't bet
  }

  const marketData = market as any;
  const isWinningBet = userBetOption && Number(userBetOption) === Number(marketData.winningOption);
  const canClaim = isWinningBet && !hasClaimed;

  const getMarketTitle = () => {
    if (loadingMetadata) return 'Loading...';
    if (marketMetadata?.title) return marketMetadata.title;
    return `Market #${marketId}`;
  };

  const getMarketOptions = () => {
    if (marketMetadata?.options && Array.isArray(marketMetadata.options)) {
      return marketMetadata.options;
    }
    return ['Yes', 'No'];
  };

  const getUserOptionText = () => {
    const options = getMarketOptions();
    const optionIndex = userBetOption ? Number(userBetOption) - 1 : 0;
    return options[optionIndex] || 'Unknown';
  };

  const getWinningOptionText = () => {
    const options = getMarketOptions();
    const optionIndex = Number(marketData.winningOption) - 1;
    return options[optionIndex] || 'Unknown';
  };

  return (
    <div className={`border rounded-lg p-4 transition-all duration-200 hover:shadow-md ${
      isDarkMode ? 'bg-gray-800 border-gray-700 hover:shadow-gray-900/20' : 'bg-white border-gray-200 hover:shadow-gray-900/10'
    }`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0 pr-4">
          <h3 className={`font-semibold text-base ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            {getMarketTitle()}
          </h3>
          <div className="flex items-center gap-2 mt-1">
            <div className={`px-2 py-0.5 rounded-full text-xs font-medium ${
              marketData.isMultiOption 
                ? (isDarkMode ? 'bg-purple-900/50 text-purple-300' : 'bg-purple-100 text-purple-800')
                : (isDarkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-800')
            }`}>
              {marketData.isMultiOption ? 'Multiple' : 'Yes/No'}
            </div>
            <div className={`px-2 py-0.5 rounded-full text-xs font-medium ${
              canClaim 
                ? (isDarkMode ? 'bg-green-900/50 text-green-300' : 'bg-green-100 text-green-800')
                : hasClaimed
                  ? (isDarkMode ? 'bg-blue-900/50 text-blue-300' : 'bg-blue-100 text-blue-800')
                  : (isDarkMode ? 'bg-red-900/50 text-red-300' : 'bg-red-100 text-red-800')
            }`}>
              {canClaim ? 'Won - Claim Available' : hasClaimed ? 'Claimed' : 'Lost'}
            </div>
          </div>
        </div>
        
        <div className="text-right">
          <div className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            {formatEther(userBetAmount)} {tokenSymbol || 'PEPU'}
          </div>
          <div className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            Your Bet
          </div>
        </div>
      </div>

      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>Your Option:</span>
          <span className={`font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            {getUserOptionText()}
          </span>
        </div>
        <div className="flex justify-between">
          <span className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>Winning Option:</span>
          <span className={`font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            {getWinningOptionText()}
          </span>
        </div>
        <div className="flex justify-between">
          <span className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>Resolved:</span>
          <span className={`font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            {new Date(Number(marketData.resolutionEndTime) * 1000).toLocaleDateString()}
          </span>
        </div>
      </div>

      {canClaim && (
        <div className="mt-4 pt-3 border-t border-gray-600 dark:border-gray-700">
          <button
            className={`w-full py-2 px-3 rounded text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
              isDarkMode 
                ? 'bg-green-600 hover:bg-green-700 text-white' 
                : 'bg-green-500 hover:bg-green-600 text-white'
            }`}
            onClick={() => {
              // TODO: Implement claim winnings functionality
              console.log('Claim winnings for market:', marketId);
            }}
          >
            <Award size={16} />
            Claim Winnings
          </button>
        </div>
      )}
    </div>
  );
}

// Main Betslip Page Component
export default function BetslipPage() {
  const { isDarkMode, toggleTheme } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sortBy, setSortBy] = useState<'newest' | 'oldest'>('newest');
  const [showAll, setShowAll] = useState(false);

  const { address, isConnected } = useAccount();

  const MARKET_MANAGER_ADDRESS = process.env.NEXT_PUBLIC_P2P_MARKETMANAGER_ADDRESS as `0x${string}`;
  const ANALYTICS_ADDRESS = process.env.NEXT_PUBLIC_P2P_ANALYTICS_ADDRESS as `0x${string}`;

  // Fetch user's resolved markets
  const { data: resolvedMarketIds } = useReadContract({
    address: ANALYTICS_ADDRESS,
    abi: ANALYTICS_ABI,
    functionName: 'getUserMarketsByState',
    args: [address || '0x0000000000000000000000000000000000000000', 2], // State 2 = Resolved
  });

  // Sort markets
  const sortedMarkets = React.useMemo(() => {
    if (!Array.isArray(resolvedMarketIds)) return [];
    
    const markets = [...resolvedMarketIds].map(id => Number(id));
    
    if (sortBy === 'newest') {
      return markets.sort((a, b) => b - a); // Higher market ID = newer
    } else {
      return markets.sort((a, b) => a - b); // Lower market ID = older
    }
  }, [resolvedMarketIds, sortBy]);

  // Show limited or all markets
  const displayedMarkets = showAll ? sortedMarkets : sortedMarkets.slice(0, 5);

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
                  Betslip
                </h1>
                <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  Claim winnings from your resolved markets
                </p>
              </div>

              <div className="flex items-center gap-4">
                {/* Sort Options */}
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as 'newest' | 'oldest')}
                  className={`px-3 py-1.5 border rounded text-sm ${
                    isDarkMode 
                      ? 'bg-gray-800 border-gray-700 text-white' 
                      : 'bg-white border-gray-300 text-gray-900'
                  }`}
                >
                  <option value="newest">Newest First</option>
                  <option value="oldest">Oldest First</option>
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
          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className={`rounded-lg border p-4 ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-sm font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Resolved Markets</p>
                  <p className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    {sortedMarkets.length}
                  </p>
                </div>
                <Receipt className={`w-8 h-8 ${isDarkMode ? 'text-blue-400' : 'text-blue-500'}`} />
              </div>
            </div>

            <div className={`rounded-lg border p-4 ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-sm font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Can Claim</p>
                  <p className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    {/* TODO: Calculate claimable markets */}
                    0
                  </p>
                </div>
                <Award className={`w-8 h-8 ${isDarkMode ? 'text-green-400' : 'text-green-500'}`} />
              </div>
            </div>

            <div className={`rounded-lg border p-4 ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-sm font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Status</p>
                  <p className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    {isConnected ? 'Connected' : 'Disconnected'}
                  </p>
                </div>
                <Activity className={`w-8 h-8 ${isDarkMode ? 'text-purple-400' : 'text-purple-500'}`} />
              </div>
            </div>
          </div>

          {/* Markets List */}
          {!isConnected ? (
            <div className="text-center py-16">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${
                isDarkMode ? 'bg-gray-800' : 'bg-gray-100'
              }`}>
                <Wallet className={`w-8 h-8 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`} />
              </div>
              <h3 className={`text-lg font-semibold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                Connect Your Wallet
              </h3>
              <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                Connect your wallet to view your resolved markets and claim winnings
              </p>
            </div>
          ) : !Array.isArray(resolvedMarketIds) || resolvedMarketIds.length === 0 ? (
            <div className="text-center py-16">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${
                isDarkMode ? 'bg-gray-800' : 'bg-gray-100'
              }`}>
                <Receipt className={`w-8 h-8 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`} />
              </div>
              <h3 className={`text-lg font-semibold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                No Resolved Markets
              </h3>
              <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                You don't have any resolved markets yet. Start betting to see your results here!
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
                {displayedMarkets.map((marketId: number) => (
                  <BetslipCard
                    key={marketId}
                    marketId={marketId}
                    userAddress={address!}
                    isDarkMode={isDarkMode}
                  />
                ))}
              </div>

              {/* View More Button */}
              {sortedMarkets.length > 5 && (
                <div className="text-center pt-4">
                  <button
                    onClick={() => setShowAll(!showAll)}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 mx-auto ${
                      isDarkMode 
                        ? 'bg-gray-700 hover:bg-gray-600 text-white' 
                        : 'bg-gray-200 hover:bg-gray-300 text-gray-900'
                    }`}
                  >
                    {showAll ? (
                      <>
                        <ChevronUp size={16} />
                        Show Less
                      </>
                    ) : (
                      <>
                        <ChevronDown size={16} />
                        View More ({sortedMarkets.length - 5} more)
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}