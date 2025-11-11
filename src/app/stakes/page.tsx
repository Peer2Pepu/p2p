"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
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
  },
  {
    "inputs": [{"name": "marketId", "type": "uint256"}, {"name": "user", "type": "address"}],
    "name": "calculateWinnings",
    "outputs": [{"name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  }
];

const ANALYTICS_ABI = [
  {
    "inputs": [{"name": "user", "type": "address"}],
    "name": "getUserMarkets",
    "outputs": [{"name": "", "type": "uint256[]"}],
    "stateMutability": "view",
    "type": "function"
  },
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
function StakesCard({ marketId, userAddress, isDarkMode, onClaimableUpdate, onStatusUpdate }: {
  marketId: number;
  userAddress: `0x${string}`;
  isDarkMode: boolean;
  onClaimableUpdate: (marketId: number, canClaim: boolean) => void;
  onStatusUpdate?: (marketId: number, marketData: any, hasClaimed: boolean, userStakeOption: number, isWinningStake: boolean) => void;
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

  // Calculate derived values
  const marketData = market as any;

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

  // Calculate user winnings for resolved markets (only works if user staked and hasn't claimed)
  const { data: userWinnings } = useReadContract({
    address: MARKET_MANAGER_ADDRESS,
    abi: MARKET_MANAGER_ABI,
    functionName: 'calculateWinnings',
    args: [BigInt(marketId), userAddress],
    query: {
      enabled: !!market && !!userStakeAmount && userStakeAmount !== BigInt(0) && (market as any)?.state === 2 && (market as any)?.isResolved && hasClaimed === false
    }
  }) as { data: bigint | undefined };

  // Get user's stake option
  const { data: userStakeOption } = useReadContract({
    address: MARKET_MANAGER_ADDRESS,
    abi: MARKET_MANAGER_ABI,
    functionName: 'userStakeOptions',
    args: [BigInt(marketId), userAddress],
  });

  // Get token symbol from AdminManager contract
  const { data: tokenSymbol } = useReadContract({
    address: process.env.NEXT_PUBLIC_P2P_ADMIN_ADDRESS as `0x${string}`,
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

  const isWinningStake = userStakeOption && marketData?.winningOption ? Number(userStakeOption) === Number(marketData.winningOption) : false;
  const canClaim = isWinningStake && !hasClaimed;
  
  // Track previous canClaim value to avoid unnecessary updates
  const prevCanClaimRef = useRef<boolean | null>(null);

  // Update claimable count when canClaim changes
  useEffect(() => {
    if (market && userStakeAmount && userStakeAmount !== BigInt(0) && onClaimableUpdate) {
      // Only update if canClaim value actually changed
      if (prevCanClaimRef.current !== canClaim) {
        prevCanClaimRef.current = canClaim;
        onClaimableUpdate(marketId, canClaim);
      }
    }
  }, [market, userStakeAmount, userStakeOption, hasClaimed, canClaim, marketId, onClaimableUpdate]);

  // Update category when market data changes
  useEffect(() => {
    // Only update when we have both marketData and hasClaimed value (not undefined) and userStakeOption
    if (marketData && hasClaimed !== undefined && userStakeOption !== undefined && onStatusUpdate) {
      const isWinningStake = marketData?.winningOption ? Number(userStakeOption) === Number(marketData.winningOption) : false;
      onStatusUpdate(marketId, marketData, hasClaimed as boolean, Number(userStakeOption), isWinningStake);
    }
  }, [marketData, hasClaimed, userStakeOption, marketId, onStatusUpdate]);

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

  const getMarketImage = () => {
    if (loadingMetadata) return null;
    if (marketMetadata?.imageUrl) {
      return marketMetadata.imageUrl;
    }
    return null;
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
    // Check if market is actually resolved and has a winning option
    if (!marketData?.isResolved || !marketData?.winningOption || marketData.winningOption === 0) {
      return 'Not resolved';
    }
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
    <div className={`border rounded-lg p-2.5 transition-all duration-200 hover:shadow-md ${
      isDarkMode ? 'bg-black border-gray-800 hover:shadow-gray-900/20' : 'bg-[#F5F3F0] border-gray-300 hover:shadow-gray-900/10'
    }`}>
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 min-w-0 pr-2">
          <div className="flex items-center gap-2 mb-0.5">
            {getMarketImage() && (
              <div className="flex-shrink-0">
                <img
                  src={getMarketImage()!}
                  alt=""
                  className={`w-10 h-10 rounded-lg object-cover border ${isDarkMode ? 'border-gray-800' : 'border-gray-400'}`}
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <h3 className={`font-semibold text-sm truncate ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  {getMarketTitle()}
                </h3>
                <span className={`px-1.5 py-0.5 rounded text-xs flex-shrink-0 ${isDarkMode ? 'bg-gray-900 text-gray-300' : 'bg-gray-200 text-gray-600'}`}>
                  #{marketId}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={`px-1.5 py-0.5 rounded text-xs ${
              marketData.isMultiOption 
                ? (isDarkMode ? 'bg-purple-900/40 text-purple-300' : 'bg-purple-100 text-purple-700')
                : (isDarkMode ? 'bg-gray-800 text-gray-300' : 'bg-gray-200 text-gray-600')
            }`}>
              {marketData.isMultiOption ? 'Multi' : 'Y/N'}
            </span>
            {marketData.state === 2 && marketData.isResolved && (
              <span className={`px-1.5 py-0.5 rounded text-xs ${
                canClaim 
                  ? (isDarkMode ? 'bg-[#39FF14]/20 text-[#39FF14]' : 'bg-[#39FF14]/20 text-emerald-700 border border-black')
                  : hasClaimed
                  ? (isDarkMode ? 'bg-blue-900/40 text-blue-300' : 'bg-blue-100 text-blue-700')
                  : (isDarkMode ? 'bg-red-900/40 text-red-300' : 'bg-red-100 text-red-700')
              }`}>
                {canClaim ? 'Won' : hasClaimed ? 'Claimed' : 'Lost'}
              </span>
            )}
          </div>
        </div>
          <div className={`text-right ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            <div className="text-base font-bold">
              {userStakeAmount ? formatEther(userStakeAmount as bigint) : '0'}
            </div>
            <div className={`text-xs ${isDarkMode ? 'text-white/60' : 'text-gray-500'}`}>
              {tokenSymbol ? String(tokenSymbol) : 'P2P'}
            </div>
          </div>
      </div>
      <div className="flex justify-between text-xs mb-1.5">
        <span className={isDarkMode ? 'text-white/60' : 'text-gray-500'}>Option: </span>
        <span className={`font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{getUserOptionText()}</span>
      </div>
      <div className="flex justify-between text-xs mb-1.5">
        <span className={isDarkMode ? 'text-white/60' : 'text-gray-500'}>Winning: </span>
        <span className={`font-medium ${
          marketData.isResolved && Number(marketData.winningOption) > 0
            ? (canClaim ? (isDarkMode ? 'text-[#39FF14]' : 'text-emerald-600') : (isDarkMode ? 'text-red-400' : 'text-red-600'))
            : (isDarkMode ? 'text-white/60' : 'text-gray-500')
        }`}>{getWinningOptionText()}</span>
      </div>
      {marketData.state === 2 && marketData.isResolved && !hasClaimed && userWinnings !== undefined && (
        <div className={`flex justify-between text-xs mb-1.5 p-1.5 rounded ${
          canClaim 
            ? (isDarkMode ? 'bg-[#39FF14]/10 border border-[#39FF14]/30' : 'bg-[#39FF14]/10 border border-black')
            : (isDarkMode ? 'bg-gray-900/50 border border-gray-800' : 'bg-gray-200 border border-gray-300')
        }`}>
          <span className={isDarkMode ? 'text-white/60' : 'text-gray-600'}>Claimable: </span>
          <span className={`font-semibold ${
            canClaim 
              ? (isDarkMode ? 'text-[#39FF14]' : 'text-emerald-600')
              : (isDarkMode ? 'text-white/60' : 'text-gray-600')
          }`}>
            {formatEther(userWinnings)} {tokenSymbol ? String(tokenSymbol) : 'P2P'}
          </span>
        </div>
      )}
      {canClaim && marketData.state === 2 && marketData.isResolved && (
        <div className={`mt-2 pt-2 border-t ${isDarkMode ? 'border-gray-800' : 'border-gray-300'}`}>
          {claimError && (
            <div className={`mb-1.5 p-1.5 rounded text-xs ${
              isDarkMode ? 'bg-red-900/40 text-red-300' : 'bg-red-50 text-red-800'
            }`}>
              {claimError}
            </div>
          )}
          {claimSuccess && (
            <div className={`mb-1.5 p-1.5 rounded text-xs ${
              isDarkMode ? 'bg-green-900/40 text-green-300' : 'bg-green-50 text-green-800'
            }`}>
              ✅ Claimed!
            </div>
          )}
          <button
            className={`w-full py-1.5 px-2 rounded text-xs font-medium transition-colors flex items-center justify-center gap-1 ${
              isClaiming || isConfirming
                ? (isDarkMode ? 'bg-gray-600 text-gray-400' : 'bg-gray-300 text-gray-600')
                : (isDarkMode 
                    ? 'bg-[#39FF14] hover:bg-[#39FF14]/80 text-black' 
                    : 'bg-[#39FF14] hover:bg-[#39FF14]/80 text-black border border-black')
            }`}
            onClick={handleClaimWinnings}
            disabled={isClaiming || isConfirming}
          >
            {isClaiming || isConfirming ? (
              <>
                <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                {isClaiming ? 'Claiming...' : 'Confirming...'}
              </>
            ) : (
              <>
                <Award size={12} />
                Claim
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
  const [activeTab, setActiveTab] = useState<'pending' | 'claimed' | 'resolved' | 'lost'>('pending');
  const [marketCategories, setMarketCategories] = useState<{
    pending: Set<number>;
    claimed: Set<number>;
    resolved: Set<number>;
    lost: Set<number>;
  }>({ pending: new Set(), claimed: new Set(), resolved: new Set(), lost: new Set() });

  const { address, isConnected } = useAccount();

  const MARKET_MANAGER_ADDRESS = process.env.NEXT_PUBLIC_P2P_MARKET_MANAGER_ADDRESS as `0x${string}`;
  const ANALYTICS_ADDRESS = process.env.NEXT_PUBLIC_P2P_ANALYTICS_ADDRESS as `0x${string}`;

  // Fetch user's all markets (regardless of status)
  const { data: userMarketIds } = useReadContract({
    address: ANALYTICS_ADDRESS,
    abi: ANALYTICS_ABI,
    functionName: 'getUserMarkets',
    args: [address || '0x0000000000000000000000000000000000000000'],
  });

  // Sort markets (show all user markets regardless of state)
  const sortedMarkets = React.useMemo(() => {
    if (!Array.isArray(userMarketIds)) return [];
    
    const markets = [...userMarketIds].map(id => Number(id));
    return markets.sort((a, b) => b - a); // Higher market ID = newer
  }, [userMarketIds]);

  // Initialize all markets as pending when they first load
  useEffect(() => {
    if (sortedMarkets.length > 0) {
      setMarketCategories(prev => {
        const newCats = {
          pending: new Set(prev.pending),
          claimed: new Set(prev.claimed),
          resolved: new Set(prev.resolved),
          lost: new Set(prev.lost),
        };
        
        // Add all markets to pending initially (they'll be recategorized as data loads)
        sortedMarkets.forEach(id => {
          if (!newCats.pending.has(id) && !newCats.claimed.has(id) && !newCats.resolved.has(id) && !newCats.lost.has(id)) {
            newCats.pending.add(id);
          }
        });
        
        // Remove markets that are no longer in the user's list
        [newCats.pending, newCats.claimed, newCats.resolved, newCats.lost].forEach(category => {
          category.forEach(id => {
            if (!sortedMarkets.includes(id)) {
              category.delete(id);
            }
          });
        });
        
        return newCats;
      });
    }
  }, [sortedMarkets]);

  // Filter markets by active tab
  const displayedMarkets = React.useMemo(() => {
    const categorySet = marketCategories[activeTab];
    return sortedMarkets.filter(id => categorySet.has(id));
  }, [sortedMarkets, marketCategories, activeTab]);

  // Get counts for each category
  const tabCounts = {
    pending: marketCategories.pending.size,
    claimed: marketCategories.claimed.size,
    resolved: marketCategories.resolved.size,
    lost: marketCategories.lost.size,
  };

  // Update market category when StakesCard reports status
  const handleMarketStatusUpdate = useCallback((marketId: number, marketData: any, hasClaimed: boolean, userStakeOption: number, isWinningStake: boolean) => {
    setMarketCategories(prev => {
      const newCats = {
        pending: new Set(prev.pending),
        claimed: new Set(prev.claimed),
        resolved: new Set(prev.resolved),
        lost: new Set(prev.lost),
      };

      // Remove from all categories first
      newCats.pending.delete(marketId);
      newCats.claimed.delete(marketId);
      newCats.resolved.delete(marketId);
      newCats.lost.delete(marketId);

      // Categorize: 
      // Pending = not resolved
      // Claimed = resolved and claimed
      // Resolved = resolved, user won, but not claimed yet
      // Lost = resolved, user lost (not the winning option)
      if (marketData?.state === 2 && marketData?.isResolved) {
        if (hasClaimed) {
          newCats.claimed.add(marketId);
        } else if (isWinningStake) {
          newCats.resolved.add(marketId); // Resolved, won, but not claimed yet
        } else {
          newCats.lost.add(marketId); // Resolved but user lost
        }
      } else {
        // Market is not resolved (state 0 = Active, state 1 = Ended)
        newCats.pending.add(marketId);
      }

      return newCats;
    });
  }, []);

  // Calculate claimable markets count
  const [claimableCount, setClaimableCount] = useState(0);
  const [claimableMarkets, setClaimableMarkets] = useState<Set<number>>(new Set());
  
  // Memoize the callback to prevent infinite loops
  const handleClaimableUpdate = useCallback((marketId: number, canClaim: boolean) => {
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
  }, []); // Empty deps array since we don't depend on any props/state

  const onSidebarClose = () => setSidebarOpen(false);
  const onToggleCollapse = () => setSidebarCollapsed(!sidebarCollapsed);

  return (
    <div className={`min-h-screen ${isDarkMode ? 'bg-black' : 'bg-[#F5F3F0]'}`}>
      {/* Sidebar */}
      <Sidebar 
        isOpen={sidebarOpen} 
        onClose={onSidebarClose} 
        collapsed={sidebarCollapsed}
        onToggleCollapse={onToggleCollapse}
        isDarkMode={isDarkMode}
      />

      {/* Main Content */}
      <div className={`transition-all duration-300 ${sidebarCollapsed ? 'lg:ml-16' : 'lg:ml-64'}`}>
        {/* Header */}
        <header className={`border-b ${isDarkMode ? 'bg-black border-[#39FF14]/20' : 'bg-[#F5F3F0] border-gray-200'}`}>
          <div className="px-4 lg:px-6 py-1.5 lg:py-2">
            <div className="flex items-center justify-between">
              {/* Mobile: Hamburger + P2P, Desktop: Full title */}
              <div className="flex items-center gap-3">
                {/* Mobile Hamburger Button */}
                <button
                  onClick={() => setSidebarOpen(true)}
                  className={`lg:hidden p-2 rounded-lg transition-colors ${isDarkMode ? 'hover:bg-[#39FF14]/10 text-white' : 'hover:bg-gray-200'}`}
                >
                  <Menu size={20} className={isDarkMode ? 'text-white' : 'text-gray-900'} />
                </button>
                
                {/* Mobile: Just P2P, Desktop: Full title */}
                <Link href="/" className="lg:hidden transition-opacity hover:opacity-80 cursor-pointer">
                  <Image
                    src="/mobile.png"
                    alt="P2P"
                    width={60}
                    height={30}
                    className="object-contain"
                    priority
                  />
                </Link>
                
                <div className="hidden lg:block">
                  <h1 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    Stakes
                  </h1>
                  <p className={`text-sm ${isDarkMode ? 'text-white/70' : 'text-gray-600'}`}>
                    View all your staked markets and claim winnings
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
                
                {/* Wallet Connection */}
                {isConnected ? (
                  <div className={`flex items-center gap-1 lg:gap-2 px-2 lg:px-3 py-1.5 rounded text-xs lg:text-sm font-medium ${
                    isDarkMode 
                      ? 'bg-[#39FF14]/10 text-white border border-[#39FF14]/30' 
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
          {/* Tabs */}
          {isConnected && Array.isArray(userMarketIds) && userMarketIds.length > 0 && (
            <div className={`flex gap-3 mb-4 p-1.5 rounded-lg ${isDarkMode ? 'bg-gray-900' : 'bg-gray-200'}`}>
              <button
                onClick={() => setActiveTab('pending')}
                className={`flex-1 px-4 py-2.5 rounded-md text-sm font-semibold transition-colors relative ${
                  activeTab === 'pending'
                    ? (isDarkMode ? 'bg-[#39FF14] text-black' : 'bg-[#39FF14] text-black border border-black shadow-sm')
                    : (isDarkMode ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900')
                }`}
              >
                Pending ({tabCounts.pending})
              </button>
              <button
                onClick={() => setActiveTab('claimed')}
                className={`flex-1 px-4 py-2.5 rounded-md text-sm font-semibold transition-colors relative ${
                  activeTab === 'claimed'
                    ? (isDarkMode ? 'bg-[#39FF14] text-black' : 'bg-[#39FF14] text-black border border-black shadow-sm')
                    : (isDarkMode ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900')
                }`}
              >
                Claimed ({tabCounts.claimed})
              </button>
              <button
                onClick={() => setActiveTab('resolved')}
                className={`flex-1 px-4 py-2.5 rounded-md text-sm font-semibold transition-colors relative ${
                  activeTab === 'resolved'
                    ? (isDarkMode ? 'bg-[#39FF14] text-black' : 'bg-[#39FF14] text-black border border-black shadow-sm')
                    : (isDarkMode ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900')
                }`}
              >
                Resolved ({tabCounts.resolved})
                {tabCounts.resolved > 0 && Array.from(marketCategories.resolved).some(id => claimableMarkets.has(id)) && (
                  <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-red-500 rounded-full"></span>
                )}
              </button>
              <button
                onClick={() => setActiveTab('lost')}
                className={`flex-1 px-4 py-2.5 rounded-md text-sm font-semibold transition-colors relative ${
                  activeTab === 'lost'
                    ? (isDarkMode ? 'bg-[#39FF14] text-black' : 'bg-[#39FF14] text-black border border-black shadow-sm')
                    : (isDarkMode ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900')
                }`}
              >
                Lost ({tabCounts.lost})
              </button>
            </div>
          )}

          {/* Markets List */}
          {!isConnected ? (
            <div className="text-center py-16">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${
                isDarkMode ? 'bg-gray-900' : 'bg-gray-200'
              }`}>
                <Wallet className={`w-8 h-8 ${isDarkMode ? 'text-white' : 'text-gray-500'}`} />
              </div>
              <h3 className={`text-lg font-semibold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                Connect Your Wallet
              </h3>
              <p className={`text-sm ${isDarkMode ? 'text-white/70' : 'text-gray-600'}`}>
                Connect your wallet to view all your staked markets
              </p>
            </div>
          ) : !Array.isArray(userMarketIds) || userMarketIds.length === 0 ? (
            <div className="text-center py-16">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${
                isDarkMode ? 'bg-gray-900' : 'bg-gray-200'
              }`}>
                <Receipt className={`w-8 h-8 ${isDarkMode ? 'text-white' : 'text-gray-500'}`} />
              </div>
              <h3 className={`text-lg font-semibold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                No Staked Markets
              </h3>
              <p className={`text-sm ${isDarkMode ? 'text-white/70' : 'text-gray-600'}`}>
                You haven't staked in any markets yet. Start betting to see your markets here!
              </p>
            </div>
          ) : displayedMarkets.length === 0 ? (
            <div className="text-center py-12">
              <p className={`text-sm ${isDarkMode ? 'text-white/70' : 'text-gray-600'}`}>
                No {activeTab} markets
              </p>
            </div>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {displayedMarkets.map((marketId: number) => (
                <StakesCard
                  key={marketId}
                  marketId={marketId}
                  userAddress={address!}
                  isDarkMode={isDarkMode}
                  onClaimableUpdate={handleClaimableUpdate}
                  onStatusUpdate={handleMarketStatusUpdate}
                />
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
