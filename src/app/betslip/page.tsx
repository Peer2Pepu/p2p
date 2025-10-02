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
  CheckCircle,
  Menu
} from 'lucide-react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
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
    "inputs": [{"name": "marketId", "type": "uint256"}, {"name": "user", "type": "address"}, {"name": "token", "type": "address"}],
    "name": "getUserStake",
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
    "name": "userStakeOptions",
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
  },
  {
    "inputs": [{"name": "marketId", "type": "uint256"}],
    "name": "claimWinnings",
    "outputs": [],
    "stateMutability": "nonpayable",
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
    "name": "getUserStake",
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

// Stakes Card Component
function StakesCard({ marketId, userAddress, isDarkMode, onClaimableUpdate }: {
  marketId: number;
  userAddress: `0x${string}`;
  isDarkMode: boolean;
  onClaimableUpdate: (marketId: number, canClaim: boolean) => void;
}) {
  const MARKET_MANAGER_ADDRESS = process.env.NEXT_PUBLIC_P2P_MARKET_MANAGER_ADDRESS as `0x${string}`;
  const TREASURY_ADDRESS = process.env.NEXT_PUBLIC_P2P_TREASURY_ADDRESS as `0x${string}`;

  // Claim functionality
  const [claimError, setClaimError] = useState<string | null>(null);
  const [claimSuccess, setClaimSuccess] = useState(false);

  // Fetch market data
  const { data: market } = useReadContract({
    address: MARKET_MANAGER_ADDRESS,
    abi: MARKET_MANAGER_ABI,
    functionName: 'getMarket',
    args: [BigInt(marketId)],
  }) as { data: any | undefined };

  // Get user's stake amount
  const { data: userStakeAmount } = useReadContract({
    address: TREASURY_ADDRESS,
    abi: TREASURY_ABI,
    functionName: 'getUserStake',
    args: [BigInt(marketId), userAddress, (market as any)?.paymentToken || '0x0000000000000000000000000000000000000000'],
  }) as { data: bigint | undefined };

  // Check if user has claimed
  const { data: hasClaimed } = useReadContract({
    address: TREASURY_ADDRESS,
    abi: TREASURY_ABI,
    functionName: 'hasUserClaimed',
    args: [BigInt(marketId), userAddress],
  });

  // Get user's stake option
  const { data: userStakeOption } = useReadContract({
    address: MARKET_MANAGER_ADDRESS,
    abi: MARKET_MANAGER_ABI,
    functionName: 'userStakeOptions',
    args: [BigInt(marketId), userAddress],
  });

  // Get token symbol
  const { data: tokenSymbol } = useReadContract({
    address: MARKET_MANAGER_ADDRESS,
    abi: MARKET_MANAGER_ABI,
    functionName: 'tokenSymbols',
    args: [(market as any)?.paymentToken || '0x0000000000000000000000000000000000000000'],
  }) as { data: string | undefined };

  const [marketMetadata, setMarketMetadata] = useState<any>(null);
  const [loadingMetadata, setLoadingMetadata] = useState(false);

  // Write contract for claiming
  const { writeContract, data: hash, error: writeError, isPending: isClaiming } = useWriteContract();
  
  // Wait for transaction receipt
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash,
  });

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

  // Handle successful claim
  useEffect(() => {
    if (isConfirmed) {
      setClaimError(null);
      setClaimSuccess(true);
      // Hide success message after 3 seconds
      setTimeout(() => setClaimSuccess(false), 3000);
    }
  }, [isConfirmed]);

  // Calculate derived values
  const marketData = market as any;
  const isWinningStake = userStakeOption && marketData?.winningOption ? Number(userStakeOption) === Number(marketData.winningOption) : false;
  const canClaim = isWinningStake && !hasClaimed;

  // Update claimable count when canClaim changes
  useEffect(() => {
    if (market && userStakeAmount && userStakeAmount !== BigInt(0) && onClaimableUpdate) {
      onClaimableUpdate(marketId, canClaim);
    }
  }, [market, userStakeAmount, userStakeOption, hasClaimed, canClaim, onClaimableUpdate, marketId]);

  // Early return after all hooks have been called
  if (!market || !userStakeAmount || userStakeAmount === BigInt(0)) {
    return null; // Don't show markets where user didn't stake
  }

  // Safety check for market data
  if (!marketData) {
    return null; // Don't render if market data is invalid
  }


  const getMarketTitle = () => {
    if (loadingMetadata) return 'Loading...';
    if (marketMetadata?.title) return marketMetadata.title;
    return `Market #${marketId}`;
  };

  const getMarketOptions = () => {
    if (marketMetadata?.options && Array.isArray(marketMetadata.options)) {
      return marketMetadata.options;
    }
    // Fallback for multi-option markets
    if (marketData.isMultiOption) {
      return ['Option 1', 'Option 2', 'Option 3', 'Option 4'].slice(0, Number(marketData.maxOptions));
    }
    return ['Yes', 'No'];
  };

  const getUserOptionText = () => {
    const options = getMarketOptions();
    const optionIndex = userStakeOption ? Number(userStakeOption) - 1 : 0;
    return options[optionIndex] || 'Unknown';
  };

  const getWinningOptionText = () => {
    if (!marketData?.winningOption) return 'Not resolved';
    const options = getMarketOptions();
    const optionIndex = Number(marketData.winningOption) - 1;
    return options[optionIndex] || 'Unknown';
  };

  const handleClaimWinnings = async () => {
    if (!canClaim || isClaiming) return;
    
    setClaimError(null);
    
    try {
      await writeContract({
        address: MARKET_MANAGER_ADDRESS,
        abi: MARKET_MANAGER_ABI,
        functionName: 'claimWinnings',
        args: [BigInt(marketId)],
        gas: BigInt(500000), // Set gas limit to 500k (reasonable for claim operation)
      });
    } catch (error: any) {
      console.error('Claim error:', error);
      
      // Better error messages based on common error types
      let errorMessage = 'Failed to claim winnings';
      if (error.message?.includes('Already claimed')) {
        errorMessage = 'You have already claimed winnings for this market';
      } else if (error.message?.includes('Not a winning bet')) {
        errorMessage = 'You did not bet on the winning option';
      } else if (error.message?.includes('Market not resolved')) {
        errorMessage = 'This market has not been resolved yet';
      } else if (error.message?.includes('User rejected')) {
        errorMessage = 'Transaction was rejected';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      setClaimError(errorMessage);
    }
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
            {userStakeAmount ? formatEther(userStakeAmount as bigint) : '0'} {tokenSymbol ? String(tokenSymbol) : 'P2P'}
          </div>
          <div className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            Your Stake
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
          <span className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>Status:</span>
          <span className={`font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            Resolved
          </span>
        </div>
      </div>

      {canClaim && (
        <div className="mt-4 pt-3 border-t border-gray-600 dark:border-gray-700">
          {claimError && (
            <div className={`mb-3 p-2 rounded text-sm ${
              isDarkMode ? 'bg-red-900/50 text-red-300' : 'bg-red-100 text-red-800'
            }`}>
              {claimError}
            </div>
          )}
          {claimSuccess && (
            <div className={`mb-3 p-2 rounded text-sm ${
              isDarkMode ? 'bg-green-900/50 text-green-300' : 'bg-green-100 text-green-800'
            }`}>
              ✅ Winnings claimed successfully!
            </div>
          )}
          <button
            className={`w-full py-2 px-3 rounded text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
              isClaiming || isConfirming
                ? (isDarkMode ? 'bg-gray-600 text-gray-400' : 'bg-gray-400 text-gray-600')
                : (isDarkMode 
                    ? 'bg-green-600 hover:bg-green-700 text-white' 
                    : 'bg-green-500 hover:bg-green-600 text-white')
            }`}
            onClick={handleClaimWinnings}
            disabled={isClaiming || isConfirming}
          >
            {isClaiming || isConfirming ? (
              <>
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                {isClaiming ? 'Claiming...' : 'Confirming...'}
              </>
            ) : (
              <>
                <Award size={16} />
                Claim Winnings
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

// Main Stakes Page Component
export default function StakesPage() {
  const { isDarkMode, toggleTheme } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sortBy, setSortBy] = useState<'newest' | 'oldest'>('newest');
  const [showAll, setShowAll] = useState(false);

  const { address, isConnected } = useAccount();

  const MARKET_MANAGER_ADDRESS = process.env.NEXT_PUBLIC_P2P_MARKET_MANAGER_ADDRESS as `0x${string}`;
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

  // Calculate claimable markets count
  const [claimableCount, setClaimableCount] = useState(0);
  const [claimableMarkets, setClaimableMarkets] = useState<Set<number>>(new Set());
  
  const handleClaimableUpdate = (marketId: number, canClaim: boolean) => {
    setClaimableMarkets(prev => {
      const newSet = new Set(prev);
      if (canClaim) {
        newSet.add(marketId);
      } else {
        newSet.delete(marketId);
      }
      setClaimableCount(newSet.size);
      return newSet;
    });
  };

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
      <div className={`transition-all duration-300 lg:${sidebarCollapsed ? 'ml-16' : 'ml-64'}`}>
        {/* Header */}
        <header className={`border-b ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
          <div className="px-4 lg:px-6 py-3 lg:py-4">
            <div className="flex items-center justify-between">
              {/* Mobile: Hamburger + P2P, Desktop: Full title */}
              <div className="flex items-center gap-3">
                {/* Mobile Hamburger Button */}
                <button
                  onClick={() => setSidebarOpen(true)}
                  className={`lg:hidden p-2 rounded-lg transition-colors ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}
                >
                  <Menu size={20} className={isDarkMode ? 'text-white' : 'text-gray-900'} />
                </button>
                
                {/* Mobile: Just P2P, Desktop: Full title */}
                <div className="lg:hidden">
                  <h1 className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    P2P
                  </h1>
                </div>
                
                <div className="hidden lg:block">
                  <h1 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    Stakes
                  </h1>
                  <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    Claim winnings from your resolved markets
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 lg:gap-4">
                {/* Sort Options */}
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as 'newest' | 'oldest')}
                  className={`px-2 py-1.5 border rounded text-xs lg:text-sm ${
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
                  className={`p-1.5 lg:p-2 rounded-lg transition-colors ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}
                >
                  {isDarkMode ? <Sun className="w-4 h-4 lg:w-5 lg:h-5 text-yellow-400" /> : <Moon className="w-4 h-4 lg:w-5 lg:h-5 text-gray-600" />}
                </button>
                
                {/* Wallet Connection */}
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

        {/* Main Content */}
        <main className="p-4 lg:p-6">
          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-4 mb-4 lg:mb-6">
            <div className={`rounded-lg border p-3 lg:p-4 ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-xs lg:text-sm font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Resolved Markets</p>
                  <p className={`text-lg lg:text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    {sortedMarkets.length}
                  </p>
                </div>
                <Receipt className={`w-6 h-6 lg:w-8 lg:h-8 ${isDarkMode ? 'text-blue-400' : 'text-blue-500'}`} />
              </div>
            </div>

            <div className={`rounded-lg border p-3 lg:p-4 ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-xs lg:text-sm font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Can Claim</p>
                  <p className={`text-lg lg:text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    {claimableCount}
                  </p>
                </div>
                <Award className={`w-6 h-6 lg:w-8 lg:h-8 ${isDarkMode ? 'text-green-400' : 'text-green-500'}`} />
              </div>
            </div>

            <div className={`rounded-lg border p-3 lg:p-4 ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-xs lg:text-sm font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Status</p>
                  <p className={`text-lg lg:text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    {isConnected ? 'Connected' : 'Disconnected'}
                  </p>
                </div>
                <Activity className={`w-6 h-6 lg:w-8 lg:h-8 ${isDarkMode ? 'text-purple-400' : 'text-purple-500'}`} />
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
              <div className="grid gap-3 lg:gap-4 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3">
                {displayedMarkets.map((marketId: number) => (
                  <StakesCard
                    key={marketId}
                    marketId={marketId}
                    userAddress={address!}
                    isDarkMode={isDarkMode}
                    onClaimableUpdate={handleClaimableUpdate}
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