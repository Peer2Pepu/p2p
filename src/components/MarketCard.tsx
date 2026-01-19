"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Users,
  Timer,
  Clock,
  Wallet
} from 'lucide-react';
import { useReadContract, useAccount } from 'wagmi';
import { parseEther, formatEther } from 'viem';
import { createClient } from '@supabase/supabase-js';

// Supabase client
const supabase = createClient(
  `https://${process.env.NEXT_PUBLIC_SUPABASE_PROJECT_ID}.supabase.co`,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

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
    "inputs": [{"name": "marketId", "type": "uint256"}, {"name": "option", "type": "uint256"}, {"name": "token", "type": "address"}],
    "name": "getOptionPool",
    "outputs": [{"name": "", "type": "uint256"}],
    "stateMutability": "view",
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
    "inputs": [{"name": "marketId", "type": "uint256"}, {"name": "token", "type": "address"}],
    "name": "getSupportPool",
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

// Multi-segment Circular Progress Component
function MultiSegmentCircle({ segments, size = 60, isDarkMode }: { 
  segments: Array<{label: string, percentage: number, color: string}>;
  size?: number;
  isDarkMode: boolean;
}) {
  const radius = (size - 6) / 2;
  const circumference = radius * 2 * Math.PI;
  
  return (
    <div className="relative inline-flex items-center justify-center flex-shrink-0">
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={isDarkMode ? '#1F2937' : '#D1D5DB'}
          strokeWidth="5"
          fill="none"
        />
        
        {/* Segments - render all segments with > 0% */}
        {(() => {
          const validSegments = segments.filter(s => s.percentage > 0.1 && isFinite(s.percentage) && !isNaN(s.percentage));
          
          // If no valid segments, show first segment with 100% (default state)
          if (validSegments.length === 0) {
            const defaultSegment = segments[0] || { label: 'Yes', percentage: 100, color: '#6B7280' };
            return (
              <circle
                key="default"
                cx={size / 2}
                cy={size / 2}
                r={radius}
                stroke={defaultSegment.color}
                strokeWidth="5"
                fill="none"
                strokeDasharray={`${circumference} ${circumference}`}
                strokeDashoffset={0}
                strokeLinecap="round"
                className="transition-all duration-500"
              />
            );
          }
          
          let cumulative = 0;
          return validSegments.map((segment, index) => {
            const segmentLength = (segment.percentage / 100) * circumference;
            const offset = circumference - (cumulative / 100) * circumference;
            cumulative += segment.percentage;
            
            return (
              <circle
                key={`${segment.label}-${index}`}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                stroke={segment.color}
                strokeWidth="5"
                fill="none"
                strokeDasharray={`${segmentLength} ${circumference}`}
                strokeDashoffset={offset}
                strokeLinecap="round"
                className="transition-all duration-500"
              />
            );
          });
        })()}
      </svg>
      
      {/* Center display - show highest percentage */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-sm font-bold leading-none ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
          {Math.max(...segments.map(s => s.percentage))}%
        </span>
      </div>
    </div>
  );
}

// Market Card Component
export function MarketCard({ 
  marketId, 
  isDarkMode, 
  onBet, 
  onEndMarket, 
  userAddress,
  isApprovalPending,
  isStakePending,
  isApprovalConfirming,
  isStakeConfirming
}: {
  marketId: number;
  isDarkMode: boolean;
  onBet: (marketId: number, option: number, amount: string, isApproval?: boolean) => void;
  onEndMarket: (marketId: number) => void;
  userAddress?: `0x${string}`;
  isApprovalPending?: boolean;
  isStakePending?: boolean;
  isApprovalConfirming?: boolean;
  isStakeConfirming?: boolean;
}) {
  const MARKET_MANAGER_ADDRESS = (process.env.NEXT_PUBLIC_P2P_MARKET_MANAGER_ADDRESS || process.env.NEXT_PUBLIC_P2P_MARKETMANAGER_ADDRESS) as `0x${string}`;

  // ============================================
  // ALL HOOKS MUST BE AT THE TOP - NEVER CONDITIONAL
  // ============================================
  
  // 1. ALL useState hooks
  const [betAmount, setBetAmount] = useState('');
  const [selectedOption, setSelectedOption] = useState(1);
  const [marketMetadata, setMarketMetadata] = useState<any>(null);
  const [loadingMetadata, setLoadingMetadata] = useState(false);
  const [needsApproval, setNeedsApproval] = useState(false);
  const [supabaseData, setSupabaseData] = useState<any>(null);
  const [loadingSupabase, setLoadingSupabase] = useState(true);
  const [timeLeft, setTimeLeft] = useState(0);
  const [stakeTimeLeft, setStakeTimeLeft] = useState(0);

  // 2. Get user account
  const { address: currentUserAddress } = useAccount();
  const router = useRouter();

  // 3. ALL useReadContract hooks - must always be called
  const { data: market } = useReadContract({
    address: MARKET_MANAGER_ADDRESS,
    abi: MARKET_MANAGER_ABI,
    functionName: 'getMarket',
    args: [BigInt(marketId)],
    query: {
      refetchInterval: 10000, // Refetch every 10 seconds to keep data fresh
    },
  }) as { data: any | undefined };

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
    args: [market?.paymentToken || '0x0000000000000000000000000000000000000000'],
  });

  const { data: userHasStaked } = useReadContract({
    address: MARKET_MANAGER_ADDRESS,
    abi: MARKET_MANAGER_ABI,
    functionName: 'userHasStaked',
    args: [BigInt(marketId), userAddress || '0x0000000000000000000000000000000000000000'],
  }) as { data: boolean | undefined };

  const { data: userStakeOption } = useReadContract({
    address: MARKET_MANAGER_ADDRESS,
    abi: MARKET_MANAGER_ABI,
    functionName: 'userStakeOptions',
    args: [BigInt(marketId), userAddress || '0x0000000000000000000000000000000000000000'],
  }) as { data: bigint | undefined };

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
    query: {
      refetchInterval: 10000, // Refetch every 10 seconds to keep volume fresh
    },
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
    query: {
      refetchInterval: 10000, // Refetch every 10 seconds to keep volume fresh
    },
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
    query: {
      refetchInterval: 10000, // Refetch every 10 seconds to keep volume fresh
    },
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
    query: {
      refetchInterval: 10000, // Refetch every 10 seconds to keep volume fresh
    },
  });

  const { data: stakerCount } = useReadContract({
    address: MARKET_MANAGER_ADDRESS,
    abi: [
      {
        "inputs": [{"name": "marketId", "type": "uint256"}],
        "name": "getStakerCount",
        "outputs": [{"name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function"
      }
    ],
    functionName: 'getStakerCount',
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

  const { data: supportPool } = useReadContract({
    address: MARKET_MANAGER_ADDRESS,
    abi: [
      {
        "inputs": [{"name": "marketId", "type": "uint256"}, {"name": "token", "type": "address"}],
        "name": "getSupportPool",
        "outputs": [{"name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function"
      }
    ],
    functionName: 'getSupportPool',
    args: [BigInt(marketId), market?.paymentToken || '0x0000000000000000000000000000000000000000'],
    query: {
      refetchInterval: 10000, // Refetch every 10 seconds to keep volume fresh
    },
  }) as { data: bigint | undefined };

  // Get total pool directly from contract (more accurate than summing manually)
  const { data: totalPool } = useReadContract({
    address: MARKET_MANAGER_ADDRESS,
    abi: [
      {
        "inputs": [{"name": "marketId", "type": "uint256"}, {"name": "token", "type": "address"}],
        "name": "getTotalPool",
        "outputs": [{"name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function"
      }
    ],
    functionName: 'getTotalPool',
    args: [BigInt(marketId), market?.paymentToken || '0x0000000000000000000000000000000000000000'],
    query: {
      refetchInterval: 10000, // Refetch every 10 seconds to keep volume fresh
    },
  }) as { data: bigint | undefined };

  // Debug logging for volume and dates
  useEffect(() => {
    if (market) {
      console.log(`[MarketCard ${marketId}] Contract Data:`, {
        totalPool: totalPool?.toString(),
        option1Pool: option1Pool?.toString(),
        option2Pool: option2Pool?.toString(),
        option3Pool: option3Pool?.toString(),
        option4Pool: option4Pool?.toString(),
        supportPool: supportPool?.toString(),
        paymentToken: market.paymentToken,
        endTime: market.endTime?.toString(),
        stakeEndTime: market.stakeEndTime?.toString(),
        endTimeType: typeof market.endTime,
        stakeEndTimeType: typeof market.stakeEndTime,
        endTimeDate: market.endTime ? new Date(Number(market.endTime) * 1000).toISOString() : 'N/A',
        stakeEndTimeDate: market.stakeEndTime ? new Date(Number(market.stakeEndTime) * 1000).toISOString() : 'N/A',
      });
    }
  }, [marketId, market, totalPool, option1Pool, option2Pool, option3Pool, option4Pool, supportPool]);

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
    args: market?.paymentToken && MARKET_MANAGER_ADDRESS && currentUserAddress ? [
      currentUserAddress,
      MARKET_MANAGER_ADDRESS
    ] : undefined,
  });

  // 4. ALL useEffect hooks
  useEffect(() => {
    const fetchSupabaseData = async () => {
      try {
        setLoadingSupabase(true);
        
        console.log('Environment check:', {
          projectId: process.env.NEXT_PUBLIC_SUPABASE_PROJECT_ID,
          anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'Present' : 'Missing',
          supabaseUrl: `https://${process.env.NEXT_PUBLIC_SUPABASE_PROJECT_ID}.supabase.co`
        });
        
        const { data, error } = await supabase
          .from('market')
          .select('*')
          .eq('market_id', marketId)
          .single();

        console.log('Supabase query result:', { data, error });
        
        if (error) {
          console.error('Supabase error:', error);
          return;
        }

        if (!data) {
          console.error('No data found for market', marketId);
          return;
        }

        console.log('Supabase data for market', marketId, ':', data);
        setSupabaseData(data);
        
        // Fetch IPFS metadata if available
        if (data?.ipfs) {
          const gatewayUrl = `https://gateway.lighthouse.storage/ipfs/${data.ipfs}`;
          console.log('Fetching IPFS metadata from:', gatewayUrl);
          
          try {
            const response = await fetch(gatewayUrl);
            if (response.ok) {
              const metadata = await response.json();
              console.log('IPFS metadata:', metadata);
              // Use the full image URL from Supabase
              if (data.image) {
                metadata.imageUrl = data.image;
                console.log('Using Supabase image URL:', data.image);
              }
              setMarketMetadata(metadata);
            }
          } catch (error) {
            console.error('Error fetching IPFS metadata:', error);
          }
        }
      } catch (error) {
        console.error('Error fetching Supabase data:', error);
      } finally {
        setLoadingSupabase(false);
      }
    };

    fetchSupabaseData();
  }, [marketId]);

  useEffect(() => {
    if (!market || market.endTime === undefined || market.stakeEndTime === undefined) return;
    
    const updateTimes = () => {
      const now = Math.floor(Date.now() / 1000);
      
      // Convert BigInt to Number properly - handle both BigInt and string/number formats
      let endTime: number;
      let stakeEndTime: number;
      
      if (typeof market.endTime === 'bigint') {
        endTime = Number(market.endTime);
      } else if (typeof market.endTime === 'string') {
        endTime = parseInt(market.endTime, 10);
      } else {
        endTime = Number(market.endTime);
      }
      
      if (typeof market.stakeEndTime === 'bigint') {
        stakeEndTime = Number(market.stakeEndTime);
      } else if (typeof market.stakeEndTime === 'string') {
        stakeEndTime = parseInt(market.stakeEndTime, 10);
      } else {
        stakeEndTime = Number(market.stakeEndTime);
      }
      
      // Validate that times are reasonable (not 0 or negative, and not too far in the future)
      if (isNaN(endTime) || isNaN(stakeEndTime) || endTime <= 0 || stakeEndTime <= 0) {
        return;
      }
      
      const calculatedTimeLeft = endTime - now;
      const calculatedStakeTimeLeft = stakeEndTime - now;
      
      const finalTimeLeft = Math.max(0, calculatedTimeLeft);
      const finalStakeTimeLeft = Math.max(0, calculatedStakeTimeLeft);
      
      setTimeLeft(finalTimeLeft);
      setStakeTimeLeft(finalStakeTimeLeft);
    };
    
    // Run immediately
    updateTimes();
    // Then update every second
    const interval = setInterval(updateTimes, 1000);
    return () => clearInterval(interval);
  }, [market?.endTime, market?.stakeEndTime, marketId]);

  useEffect(() => {
    if (isApprovalPending === false && market?.paymentToken && market.paymentToken !== '0x0000000000000000000000000000000000000000' && betAmount) {
      const timer = setTimeout(() => {
        refetchAllowance();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [isApprovalPending, market?.paymentToken, betAmount, refetchAllowance]);

  // ============================================
  // NOW WE CAN DO CONDITIONAL LOGIC AND RETURNS
  // ============================================

  // Check if this is an ERC20 market
  const isERC20Market = market?.paymentToken && market.paymentToken !== '0x0000000000000000000000000000000000000000';

  // Check approval needs
  const requiredAmount = betAmount ? parseEther(betAmount) : BigInt(0);
  const hasSufficientAllowance = tokenAllowance !== undefined && betAmount ? tokenAllowance >= requiredAmount : false;
  const needsTokenApproval = isERC20Market && betAmount && !hasSufficientAllowance;

  // Loading state
  if (loadingSupabase || !supabaseData) {
    return (
      <div className={`border rounded-xl p-4 w-full max-w-sm ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
        <div className="animate-pulse">
          <div className={`h-4 rounded mb-2 ${isDarkMode ? 'bg-gray-600' : 'bg-gray-300'}`}></div>
          <div className={`h-3 rounded mb-3 ${isDarkMode ? 'bg-gray-600' : 'bg-gray-300'}`}></div>
        </div>
      </div>
    );
  }

  const marketData = market;
  
  // Skip markets that are not active
  if (marketData && marketData.state !== 0) {
    return null;
  }

  // Helper functions
  const hoursLeft = Math.max(0, Math.floor(timeLeft / 3600));
  const minutesLeft = Math.max(0, Math.floor((timeLeft % 3600) / 60));
  const canEndMarket = marketData && marketData.state === 0 && timeLeft <= 0;

  const stakeHoursLeft = Math.max(0, Math.floor(stakeTimeLeft / 3600));
  const stakeMinutesLeft = Math.max(0, Math.floor((stakeTimeLeft % 3600) / 60));
  // Can stake if market is active, stake period hasn't ended, and user hasn't staked yet
  const canStake = marketData && marketData.state === 0 && stakeTimeLeft > 0 && !userHasStaked;
  // Stake period is open if time hasn't ended (regardless of whether user has staked)
  const isStakePeriodOpen = marketData && marketData.state === 0 && stakeTimeLeft > 0;

  const getMarketTitle = () => {
    if (loadingSupabase) return 'Loading...';
    if (marketMetadata?.title) return marketMetadata.title;
    return `Market #${marketId}`;
  };

  const getMarketImage = () => {
    if (loadingSupabase) return null;
    if (marketMetadata?.imageUrl) {
      return marketMetadata.imageUrl;
    }
    return null;
  };

  const getMarketOptions = () => {
    if (marketMetadata?.options && Array.isArray(marketMetadata.options)) {
      return marketMetadata.options;
    }
    return ['Yes', 'No'];
  };

  const getTotalPool = () => {
    // Use contract's getTotalPool for accurate volume (includes all option pools + support pool)
    if (totalPool !== undefined && totalPool !== null) {
      return totalPool;
    }
    // Fallback to manual calculation if contract call hasn't loaded yet
    const optionPools = [option1Pool || BigInt(0), option2Pool || BigInt(0), option3Pool || BigInt(0), option4Pool || BigInt(0)];
    const maxOptions = market ? Number(market.maxOptions) : 2;
    const relevantPools = optionPools.slice(0, maxOptions);
    const totalOptionPools = relevantPools.reduce((sum, pool) => sum + pool, BigInt(0));
    const supportAmount = supportPool || BigInt(0);
    const manualTotal = totalOptionPools + supportAmount;
    return manualTotal;
  };

  // Accurate percentage calculation using BigInt for precision
  const calculateAccuratePercentages = () => {
    // Get pools - handle undefined by defaulting to 0
    const optionPools = [
      option1Pool !== undefined && option1Pool !== null ? option1Pool : BigInt(0),
      option2Pool !== undefined && option2Pool !== null ? option2Pool : BigInt(0),
      option3Pool !== undefined && option3Pool !== null ? option3Pool : BigInt(0),
      option4Pool !== undefined && option4Pool !== null ? option4Pool : BigInt(0)
    ];
    const maxOptions = market ? Number(market.maxOptions) : 2;
    const relevantPools = optionPools.slice(0, maxOptions);
    
    // Calculate total of option pools ONLY (exclude support pool)
    const totalOptionPools = relevantPools.reduce((sum, pool) => sum + pool, BigInt(0));
    
    // If no stakes, return equal distribution
    if (totalOptionPools === BigInt(0)) {
      return relevantPools.map(() => 100 / relevantPools.length);
    }
    
    // Calculate percentages with high precision using BigInt
    // Use 1000000 for better precision (6 decimal places)
    const percentages = relevantPools.map((pool) => {
      if (pool === BigInt(0)) return 0;
      // (pool * 1000000) / totalOptionPools gives percentage * 10000 (e.g., 500000 = 50%)
      const percentageScaled = (pool * BigInt(1000000)) / totalOptionPools;
      // Convert to number and divide by 10000 to get actual percentage
      return Number(percentageScaled) / 10000;
    });
    
    // Normalize to ensure they sum to exactly 100% (handle rounding errors)
    const sum = percentages.reduce((s, p) => s + p, 0);
    if (sum > 0 && Math.abs(sum - 100) > 0.01) {
      // Only normalize if sum is significantly different from 100
      return percentages.map(p => (p / sum) * 100);
    }
    
    return percentages;
  };

  const getOptionPercentage = (optionIndex: number) => {
    const percentages = calculateAccuratePercentages();
    return percentages[optionIndex] || 0;
  };

  const totalParticipants = (stakerCount ? Number(stakerCount) : 0) + (supporterCount ? Number(supporterCount) : 0) + 1;

  const formatTime = () => {
    if (canEndMarket) return 'Ready';
    if (hoursLeft > 24) return `${Math.floor(hoursLeft / 24)}d`;
    if (hoursLeft > 0) return `${hoursLeft}h`;
    return `${minutesLeft}m`;
  };

  const options = getMarketOptions();

  return (
    <div 
      onClick={(e) => {
        // Only navigate if NOT clicking on interactive elements
        const target = e.target as HTMLElement;
        const isInteractive = 
          target.tagName === 'INPUT' ||
          target.tagName === 'BUTTON' ||
          target.closest('input') !== null ||
          target.closest('button') !== null ||
          target.closest('.flex.gap-1') !== null ||
          target.closest('[data-interactive]') !== null;
        
        if (!isInteractive) {
          router.push(`/market/${marketId}`);
        }
      }}
      className={`w-full max-w-sm border rounded-xl overflow-hidden transition-all duration-200 hover:shadow-lg flex flex-col cursor-pointer ${
        isDarkMode 
          ? 'bg-black border-gray-800 hover:border-[#39FF14]/30 hover:shadow-[#39FF14]/20 hover:bg-gray-900/50' 
          : 'bg-[#F5F3F0] border-gray-300 hover:shadow-gray-900/20'
      }`}
      style={{ height: '380px' }}
    >
      <div className="p-4 flex flex-col flex-1 min-h-0">
        {/* Header with small image and multi-segment circle */}
        <div className="flex items-start justify-between gap-3 mb-4 flex-shrink-0">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            {getMarketImage() && (
              <div className="flex-shrink-0">
                <img
                  src={getMarketImage()!}
                  alt=""
                  className={`w-12 h-12 rounded-lg object-cover border ${isDarkMode ? 'border-gray-800' : 'border-gray-400'}`}
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              </div>
            )}
            
            <div className="flex-1 min-w-0">
              <h3 className={`font-semibold text-base leading-tight ${
                isDarkMode ? 'text-white' : 'text-gray-900'
              }`}>
                {getMarketTitle()}
              </h3>
            </div>
          </div>
          
          {/* Multi-segment circle at top-right */}
          <MultiSegmentCircle
            segments={(() => {
              // Use accurate percentage calculation
              const percentages = calculateAccuratePercentages();
              
              // Map colors based on option name: Yes=Red, No=Green, others by index
              const getOptionColor = (option: string, index: number): string => {
                const optionLower = option.toLowerCase().trim();
                if (optionLower === 'yes') return '#EF4444'; // Red
                if (optionLower === 'no') return '#10B981'; // Green
                // For other options, use a color palette
                const colors = ['#3B82F6', '#F59E0B', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316'];
                return colors[index % colors.length] || '#6B7280';
              };
              
              // Create segments with accurate percentages and correct colors
              const segments = options.map((option: string, index: number) => {
                const color = getOptionColor(option, index);
                let percentage = percentages[index] || 0;
                
                // Ensure percentage is valid and clamped
                percentage = isNaN(percentage) || !isFinite(percentage) 
                  ? (100 / options.length) 
                  : Math.max(0, Math.min(100, percentage));
                
                return {
                  label: option,
                  percentage,
                  color
                };
              });
              
              return segments;
            })()}
            size={60}
            isDarkMode={isDarkMode}
          />
        </div>

        {/* Scrollable Options */}
        <div 
          className="flex-1 min-h-0 overflow-y-auto mb-3 pr-1" 
          style={{ 
            minHeight: '90px', 
            maxHeight: '130px',
            scrollbarWidth: 'thin',
            scrollbarColor: '#9CA3AF transparent'
          }}
        >
          <div className="space-y-2">
            {options.map((option: string, index: number) => {
              const percentage = getOptionPercentage(index);
              const isSelected = selectedOption === index + 1;
              const isUserStake = userHasStaked && userStakeOption && Number(userStakeOption) === index + 1;
              
              // Map colors based on option name: Yes=Red, No=Green, others by index
              const getOptionColor = (opt: string, idx: number): string => {
                const optLower = opt.toLowerCase().trim();
                if (optLower === 'yes') return '#EF4444'; // Red
                if (optLower === 'no') return '#10B981'; // Green
                // For other options, use a color palette
                const colors = ['#3B82F6', '#F59E0B', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316'];
                return colors[idx % colors.length] || '#6B7280';
              };
              
              const optionColor = getOptionColor(option, index);
                
              return (
                <div
                  key={index}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (!canEndMarket && !isUserStake) {
                      setSelectedOption(index + 1);
                    }
                  }}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  className={`flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-all ${
                    isUserStake
                      ? (isDarkMode ? 'border border-[#39FF14] bg-[#39FF14]/10' : 'border-2 border-black bg-[#39FF14]/10')
                      : isSelected 
                        ? (isDarkMode ? 'border border-[#39FF14] bg-[#39FF14]/10' : 'border-2 border-black bg-[#39FF14]/10')
                        : (isDarkMode ? 'border border-gray-700 hover:bg-gray-800/50' : 'border border-gray-300 hover:bg-gray-200/50')
                  }`}
                >
                  {/* Color indicator dot */}
                  <div 
                    className="w-3 h-3 rounded-full flex-shrink-0" 
                    style={{ backgroundColor: optionColor }}
                  />
                  
                  {/* Option text */}
                  <div className="flex-1 min-w-0">
                    <span className={`font-semibold text-sm ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                      {option} {isUserStake ? '✓' : ''}
                    </span>
                  </div>
                  
                  {/* Radio button */}
                  <input
                    type="radio"
                    name={`option-${marketId}`}
                    value={index + 1}
                    checked={isSelected || !!isUserStake}
                    onChange={() => {}}
                    disabled={canEndMarket || !!isUserStake}
                    className="w-4 h-4 flex-shrink-0"
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* Volume & Stats */}
        <div className={`border-t pt-3 space-y-2 ${
          isDarkMode ? 'border-gray-800' : 'border-gray-300'
        }`}>
          <div className="flex items-center justify-between">
            <div className={`text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
              {formatEther(getTotalPool())} {tokenSymbol || 'PEPU'} Vol.
            </div>
            <div className="flex items-center gap-1">
              <Users size={14} className={isDarkMode ? 'text-gray-500' : 'text-gray-400'} />
              <span className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                {totalParticipants}
              </span>
            </div>
          </div>
                
          {/* Time indicators */}
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1">
              <Timer size={12} className={isDarkMode ? 'text-gray-500' : 'text-gray-400'} />
              <span className={`${!isStakePeriodOpen ? 'text-red-500 font-medium' : isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                Stake: {isStakePeriodOpen ? (() => {
                  if (stakeHoursLeft > 24) return `${Math.floor(stakeHoursLeft / 24)}d`;
                  if (stakeHoursLeft > 0) return `${stakeHoursLeft}h`;
                  return `${stakeMinutesLeft}m`;
                })() : 'Closed'}
                {userHasStaked && isStakePeriodOpen && ' (You staked)'}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <Clock size={12} className={isDarkMode ? 'text-gray-500' : 'text-gray-400'} />
              <span className={`${canEndMarket ? 'text-orange-500 font-medium' : isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                Resolve: {formatTime()}
              </span>
            </div>
          </div>
        </div>

        {/* Bet Input Section */}
        <div className="flex-shrink-0 mt-3">
          {userHasStaked === true && userAddress && canEndMarket ? (
            <div>
              {canEndMarket && (
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onEndMarket(marketId);
                  }}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  className="w-full py-2.5 px-4 rounded-lg text-sm font-semibold bg-orange-600 hover:bg-orange-700 text-white transition-colors flex items-center justify-center gap-2"
                >
                  <Timer size={16} />
                  End Market
                </button>
              )}
            </div>
          ) : canEndMarket ? (
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onEndMarket(marketId);
              }}
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              className="w-full py-2.5 px-4 rounded-lg text-sm font-semibold bg-orange-600 hover:bg-orange-700 text-white transition-colors flex items-center justify-center gap-2"
            >
              <Timer size={16} />
              End Market
            </button>
          ) : (
            <div 
              data-interactive="true"
              className="flex gap-1 relative z-10" 
              style={{ pointerEvents: 'auto' }}
              onClick={(e) => { 
                e.preventDefault();
                e.stopPropagation(); 
              }}
              onMouseDown={(e) => { 
                e.preventDefault();
                e.stopPropagation(); 
              }}
            >
              <input
                type="number"
                value={betAmount}
                onChange={(e) => {
                  e.stopPropagation();
                  setBetAmount(e.target.value);
                }}
                onClick={(e) => {
                  e.stopPropagation();
                }}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  // Don't prevent default - allow input to focus normally
                }}
                onFocus={(e) => {
                  e.stopPropagation();
                }}
                placeholder={`Min: ${market?.minStake ? formatEther(market.minStake) : '0'} ${tokenSymbol || 'PEPU'}`}
                disabled={!canStake}
                className={`flex-1 px-2 py-1.5 border rounded text-xs ${
                  isDarkMode 
                    ? 'bg-gray-900 border-gray-700 text-white placeholder-gray-500' 
                    : 'bg-[#F5F3F0] border-gray-400 text-gray-900'
                }`}
              />
              {needsTokenApproval ? (
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onBet(marketId, selectedOption, betAmount, true);
                  }}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  disabled={!betAmount || !canStake || isApprovalPending || isApprovalConfirming}
                  className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                    !betAmount || !canStake || isApprovalPending || isApprovalConfirming
                      ? 'bg-gray-600 cursor-not-allowed text-gray-400'
                      : isDarkMode 
                        ? 'bg-[#39FF14] hover:bg-[#39FF14]/80 text-black'
                        : 'bg-[#39FF14] hover:bg-[#39FF14]/80 text-black border border-black'
                  }`}
                >
                  {isApprovalPending ? 'Approving...' : isApprovalConfirming ? 'Confirming...' : 'Approve'}
                </button>
              ) : (
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onBet(marketId, selectedOption, betAmount);
                  }}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  disabled={!betAmount || !canStake || isStakePending || isStakeConfirming}
                  className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                    !betAmount || !canStake || isStakePending || isStakeConfirming
                      ? 'bg-gray-600 cursor-not-allowed text-gray-400'
                      : isDarkMode 
                        ? 'bg-[#39FF14] hover:bg-[#39FF14]/80 text-black' 
                        : 'bg-[#39FF14] hover:bg-[#39FF14]/80 text-black border border-black'
                  }`}
                >
                  {!canStake ? (userHasStaked ? 'Already Staked' : 'Staking Closed') : 
                    isStakePending ? 'Staking...' : 
                    isStakeConfirming ? 'Confirming...' : 
                    'Stake'}
                </button>
              )}
            </div>
          )}
          {needsTokenApproval && (
            <p className="text-xs text-yellow-600 mt-2 text-center">
              Approve {tokenSymbol || 'tokens'} before staking
            </p>
          )}
        </div>
      </div>
    </div>
  );
}