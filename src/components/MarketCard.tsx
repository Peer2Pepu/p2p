"use client";

import React, { useState, useEffect } from 'react';
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
  
  // Calculate cumulative offsets for each segment
  let cumulativePercentage = 0;
  
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
        
        {/* Segments */}
        {segments.map((segment, index) => {
          const segmentLength = (segment.percentage / 100) * circumference;
          const offset = circumference - cumulativePercentage * circumference / 100;
          cumulativePercentage += segment.percentage;
          
          return (
            <circle
              key={index}
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
        })}
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
  const MARKET_MANAGER_ADDRESS = process.env.NEXT_PUBLIC_P2P_MARKET_MANAGER_ADDRESS as `0x${string}`;

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

  // 3. ALL useReadContract hooks - must always be called
  const { data: market } = useReadContract({
    address: MARKET_MANAGER_ADDRESS,
    abi: MARKET_MANAGER_ABI,
    functionName: 'getMarket',
    args: [BigInt(marketId)],
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
  }) as { data: bigint | undefined };

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
    if (!market) return;
    
    const updateTimes = () => {
      const now = Math.floor(Date.now() / 1000);
      setTimeLeft(Number(market.endTime) - now);
      setStakeTimeLeft(Number(market.stakeEndTime) - now);
    };
    
    updateTimes();
    const interval = setInterval(updateTimes, 1000);
    return () => clearInterval(interval);
  }, [market?.endTime, market?.stakeEndTime]);

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
  const canStake = marketData && marketData.state === 0 && stakeTimeLeft > 0 && !userHasStaked;

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
    const optionPools = [option1Pool || BigInt(0), option2Pool || BigInt(0), option3Pool || BigInt(0), option4Pool || BigInt(0)];
    const maxOptions = market ? Number(market.maxOptions) : 2;
    const relevantPools = optionPools.slice(0, maxOptions);
    const totalOptionPools = relevantPools.reduce((sum, pool) => sum + pool, BigInt(0));
    const supportAmount = supportPool || BigInt(0);
    return totalOptionPools + supportAmount;
  };

  const getOptionPercentage = (optionIndex: number) => {
    const optionPools = [option1Pool || BigInt(0), option2Pool || BigInt(0), option3Pool || BigInt(0), option4Pool || BigInt(0)];
    const maxOptions = market ? Number(market.maxOptions) : 2;
    const relevantPools = optionPools.slice(0, maxOptions);
    const totalPool = relevantPools.reduce((sum, pool) => sum + pool, BigInt(0));
    
    if (totalPool === BigInt(0)) return 0;
    const optionPool = relevantPools[optionIndex] || BigInt(0);
    return Number((optionPool * BigInt(100)) / totalPool);
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
      className={`w-full max-w-sm border rounded-xl overflow-hidden transition-all duration-200 hover:shadow-lg flex flex-col ${
        isDarkMode 
          ? 'bg-black border-gray-800 hover:shadow-gray-900/50' 
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
            segments={options.map((option: string, index: number) => ({
              label: option,
              percentage: getOptionPercentage(index),
              color: ['#10B981', '#EF4444', '#3B82F6', '#F59E0B'][index] || '#6B7280'
            }))}
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
              const optionColor = ['#10B981', '#EF4444', '#3B82F6', '#F59E0B'][index] || '#6B7280';
                
              return (
                <div
                  key={index}
                  onClick={() => !canEndMarket && !isUserStake && setSelectedOption(index + 1)}
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
                  
                  {/* Percentage */}
                  <span className={`text-sm font-bold flex-shrink-0 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    {percentage}%
                  </span>
                  
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
              <span className={`${!canStake ? 'text-red-500 font-medium' : isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                Stake: {canStake ? (() => {
                  if (stakeHoursLeft > 24) return `${Math.floor(stakeHoursLeft / 24)}d`;
                  if (stakeHoursLeft > 0) return `${stakeHoursLeft}h`;
                  return `${stakeMinutesLeft}m`;
                })() : 'Closed'}
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
                  onClick={() => onEndMarket(marketId)}
                  className="w-full py-2.5 px-4 rounded-lg text-sm font-semibold bg-orange-600 hover:bg-orange-700 text-white transition-colors flex items-center justify-center gap-2"
                >
                  <Timer size={16} />
                  End Market
                </button>
              )}
            </div>
          ) : canEndMarket ? (
            <button
              onClick={() => onEndMarket(marketId)}
              className="w-full py-2.5 px-4 rounded-lg text-sm font-semibold bg-orange-600 hover:bg-orange-700 text-white transition-colors flex items-center justify-center gap-2"
            >
              <Timer size={16} />
              End Market
            </button>
          ) : (
            <div className="flex gap-1">
              <input
                type="number"
                value={betAmount}
                onChange={(e) => setBetAmount(e.target.value)}
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
                  onClick={() => onBet(marketId, selectedOption, betAmount, true)}
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
                  onClick={() => onBet(marketId, selectedOption, betAmount)}
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