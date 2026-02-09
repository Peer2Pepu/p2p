'use client';

import { useState, useEffect, useMemo } from 'react';
import { useReadContract, useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Sidebar } from '../../components/Sidebar';
import { useTheme } from '../../context/ThemeContext';
import Image from 'next/image';
import { 
  Menu, 
  Sun, 
  Moon, 
  ArrowLeft,
  Clock,
  Users,
  Wallet,
  TrendingUp,
  ExternalLink,
  User,
  Shield,
  Crown
} from 'lucide-react';
import Link from 'next/link';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';
import { formatEther, parseEther } from 'viem';
import { ethers } from 'ethers';
import { createClient } from '@supabase/supabase-js';
import { getUserProfile } from '@/lib/profile';

// Supabase client
const supabase = createClient(
  `https://${process.env.NEXT_PUBLIC_SUPABASE_PROJECT_ID}.supabase.co`,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Explorer URL
const EXPLORER_URL = 'https://explorer-pepu-v2-mainnet-0.t.conduit.xyz';

// Contract ABI
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
    "inputs": [{"name": "marketId", "type": "uint256"}, {"name": "token", "type": "address"}],
    "name": "getTotalPool",
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
  }
];

const ERC20_ABI = [
  {
    "inputs": [{"name": "owner", "type": "address"}, {"name": "spender", "type": "address"}],
    "name": "allowance",
    "outputs": [{"name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"name": "spender", "type": "address"}, {"name": "amount", "type": "uint256"}],
    "name": "approve",
    "outputs": [{"name": "", "type": "bool"}],
    "stateMutability": "nonpayable",
    "type": "function"
  }
];

interface StakerInfo {
  address: string;
  option: number;
  amount: bigint;
  username?: string;
  displayName?: string;
  isCreator?: boolean;
  isValidator?: boolean;
}

const VALIDATION_CORE_ABI = [
  {
    "inputs": [],
    "name": "getVerifiers",
    "outputs": [{"name": "", "type": "address[]"}],
    "stateMutability": "view",
    "type": "function"
  }
];

export default function MarketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const [marketId, setMarketId] = useState<number | null>(null);
  
  useEffect(() => {
    params.then(({ id }) => {
      setMarketId(parseInt(id));
    });
  }, [params]);
  
  const { address, isConnected } = useAccount();
  const { writeContract } = useWriteContract();
  const { isDarkMode, toggleTheme } = useTheme();
  
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [marketMetadata, setMarketMetadata] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [chartData, setChartData] = useState<Array<{time: string, volume: number, cumulative: number}>>([]);
  const [loadingChart, setLoadingChart] = useState(true);
  const [stakers, setStakers] = useState<StakerInfo[]>([]);
  const [loadingStakers, setLoadingStakers] = useState(true);
  const [creatorProfile, setCreatorProfile] = useState<any>(null);
  const [validators, setValidators] = useState<Set<string>>(new Set());
  const [betAmount, setBetAmount] = useState('');
  const [selectedOption, setSelectedOption] = useState(1);
  const [isStaking, setIsStaking] = useState(false);
  const [isApproving, setIsApproving] = useState(false);

  const MARKET_MANAGER_ADDRESS = (process.env.NEXT_PUBLIC_P2P_MARKET_MANAGER_ADDRESS || process.env.NEXT_PUBLIC_P2P_MARKETMANAGER_ADDRESS) as `0x${string}`;

  // Fetch market data
  const { data: market, isLoading: marketLoading, error: marketError } = useReadContract({
    address: MARKET_MANAGER_ADDRESS,
    abi: MARKET_MANAGER_ABI,
    functionName: 'getMarket',
    args: marketId !== null ? [BigInt(marketId)] : [BigInt(0)],
    query: {
      enabled: !!marketId && !!MARKET_MANAGER_ADDRESS,
      refetchInterval: 10000,
    }
  }) as { data: any; isLoading: boolean; error: any };

  // Fetch market statistics
  const { data: totalVolume } = useReadContract({
    address: MARKET_MANAGER_ADDRESS,
    abi: MARKET_MANAGER_ABI,
    functionName: 'getTotalPool',
    args: marketId !== null && market?.paymentToken ? [BigInt(marketId), market.paymentToken] : undefined,
    query: {
      enabled: !!marketId && !!market?.paymentToken && !!MARKET_MANAGER_ADDRESS,
      refetchInterval: 10000,
    }
  }) as { data: bigint | undefined };

  const { data: stakerCount } = useReadContract({
    address: MARKET_MANAGER_ADDRESS,
    abi: MARKET_MANAGER_ABI,
    functionName: 'getStakerCount',
    args: marketId !== null ? [BigInt(marketId)] : undefined,
    query: {
      enabled: !!marketId && !!MARKET_MANAGER_ADDRESS,
      refetchInterval: 10000,
    }
  }) as { data: bigint | undefined };

  // Fetch option pools
  const { data: option1Pool } = useReadContract({
    address: MARKET_MANAGER_ADDRESS,
    abi: MARKET_MANAGER_ABI,
    functionName: 'getOptionPool',
    args: marketId !== null && market?.paymentToken ? [BigInt(marketId), BigInt(1), market.paymentToken] : undefined,
    query: {
      enabled: !!marketId && !!market?.paymentToken && !!MARKET_MANAGER_ADDRESS,
      refetchInterval: 10000,
    }
  }) as { data: bigint | undefined };

  const { data: option2Pool } = useReadContract({
    address: MARKET_MANAGER_ADDRESS,
    abi: MARKET_MANAGER_ABI,
    functionName: 'getOptionPool',
    args: marketId !== null && market?.paymentToken ? [BigInt(marketId), BigInt(2), market.paymentToken] : undefined,
    query: {
      enabled: !!marketId && !!market?.paymentToken && !!MARKET_MANAGER_ADDRESS,
      refetchInterval: 10000,
    }
  }) as { data: bigint | undefined };

  // Check if user has staked
  const { data: userHasStaked } = useReadContract({
    address: MARKET_MANAGER_ADDRESS,
    abi: MARKET_MANAGER_ABI,
    functionName: 'userHasStaked',
    args: marketId !== null && address ? [BigInt(marketId), address] : undefined,
    query: {
      enabled: !!marketId && !!address && !!MARKET_MANAGER_ADDRESS,
      refetchInterval: 10000,
    }
  }) as { data: boolean | undefined };

  // Check token allowance for ERC20 markets
  const isERC20Market = market?.paymentToken && market.paymentToken !== '0x0000000000000000000000000000000000000000';
  const { data: tokenAllowance } = useReadContract({
    address: isERC20Market ? market.paymentToken : undefined,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: address && isERC20Market ? [address, MARKET_MANAGER_ADDRESS] : undefined,
    query: {
      enabled: !!isERC20Market && !!address,
      refetchInterval: 10000,
    }
  }) as { data: bigint | undefined };

  // Fetch IPFS metadata
  useEffect(() => {
    const fetchMetadata = async () => {
      if (!market?.ipfsHash) {
        setLoading(false);
        return;
      }
      
      try {
        setLoading(true);
        const response = await fetch(`https://gateway.lighthouse.storage/ipfs/${market.ipfsHash}`);
        if (response.ok) {
          const metadata = await response.json();
          setMarketMetadata(metadata);
        }
      } catch (error) {
        console.error('Error fetching metadata:', error);
      } finally {
        setLoading(false);
      }
    };

    if (market) {
      fetchMetadata();
    }
  }, [market]);

  // Fetch creator profile
  useEffect(() => {
    const fetchCreatorProfile = async () => {
      if (!market?.creator) return;
      try {
        const profile = await getUserProfile(market.creator);
        setCreatorProfile(profile);
      } catch (error) {
        console.error('Error fetching creator profile:', error);
      }
    };
    if (market) {
      fetchCreatorProfile();
    }
  }, [market]);

  // Fetch validators
  useEffect(() => {
    const fetchValidators = async () => {
      const VALIDATION_CORE_ADDRESS = process.env.NEXT_PUBLIC_P2P_VERIFICATION_ADDRESS as `0x${string}`;
      if (!VALIDATION_CORE_ADDRESS) return;

      try {
        const provider = new ethers.JsonRpcProvider('https://rpc-pepu-v2-mainnet-0.t.conduit.xyz');
        const contract = new ethers.Contract(VALIDATION_CORE_ADDRESS, VALIDATION_CORE_ABI, provider);
        const verifiers = await contract.getVerifiers() as string[];
        const validatorSet = new Set<string>(verifiers.map((v: string) => v.toLowerCase()));
        setValidators(validatorSet);
      } catch (error) {
        console.error('Error fetching validators:', error);
      }
    };

    fetchValidators();
  }, []);

  // Fetch stakers from events
  useEffect(() => {
    const fetchStakers = async () => {
      if (!marketId || !MARKET_MANAGER_ADDRESS || !market) {
        setLoadingStakers(false);
        return;
      }

      try {
        setLoadingStakers(true);
        const provider = new ethers.JsonRpcProvider('https://rpc-pepu-v2-mainnet-0.t.conduit.xyz');
        const contract = new ethers.Contract(MARKET_MANAGER_ADDRESS, [
          {
            "anonymous": false,
            "inputs": [
              {"indexed": true, "name": "marketId", "type": "uint256"},
              {"indexed": true, "name": "user", "type": "address"},
              {"indexed": false, "name": "option", "type": "uint256"},
              {"indexed": false, "name": "amount", "type": "uint256"}
            ],
            "name": "StakePlaced",
            "type": "event"
          }
        ], provider);

        const filter = contract.filters.StakePlaced(marketId);
        const events = await contract.queryFilter(filter, 0, 'latest');

        // Get unique stakers with their latest option and total amount
        const stakerMap = new Map<string, { option: number; amount: bigint }>();
        for (const event of events) {
          if (!('args' in event) || !event.args) continue;
          const stakerAddress = (event.args as any).user.toLowerCase();
          const option = Number((event.args as any).option);
          const amount = (event.args as any).amount as bigint;
          
          if (stakerMap.has(stakerAddress)) {
            const existing = stakerMap.get(stakerAddress)!;
            stakerMap.set(stakerAddress, {
              option: option,
              amount: existing.amount + amount
            });
          } else {
            stakerMap.set(stakerAddress, { option, amount });
          }
        }

        // Add creator's stake if they have a creatorDeposit (creator's stake doesn't emit StakePlaced event)
        if (market.creator && market.creatorDeposit && market.creatorDeposit > 0) {
          const creatorAddress = market.creator.toLowerCase();
          const creatorOption = Number(market.creatorOutcome);
          const creatorAmount = market.creatorDeposit as bigint;
          
          if (stakerMap.has(creatorAddress)) {
            // Creator already in map (if they staked again after creation), add creatorDeposit to their total
            const existing = stakerMap.get(creatorAddress)!;
            stakerMap.set(creatorAddress, {
              option: existing.option,
              amount: existing.amount + creatorAmount
            });
          } else {
            // Creator not in map, add them
            stakerMap.set(creatorAddress, {
              option: creatorOption,
              amount: creatorAmount
            });
          }
        }

        // Fetch profiles for all stakers and mark creator/validator
        const stakerList: StakerInfo[] = [];
        const creatorAddress = market.creator?.toLowerCase();
        
        for (const [addr, data] of stakerMap.entries()) {
          try {
            const profile = await getUserProfile(addr);
            stakerList.push({
              address: addr,
              option: data.option,
              amount: data.amount,
              username: profile?.username,
              displayName: profile?.display_name,
              isCreator: addr === creatorAddress,
              isValidator: validators.has(addr)
            });
          } catch {
            stakerList.push({
              address: addr,
              option: data.option,
              amount: data.amount,
              isCreator: addr === creatorAddress,
              isValidator: validators.has(addr)
            });
          }
        }

        setStakers(stakerList);
      } catch (error) {
        console.error('Error fetching stakers:', error);
        setStakers([]);
      } finally {
        setLoadingStakers(false);
      }
    };

    if (market && marketId && validators.size > 0) {
      fetchStakers();
    }
  }, [marketId, market, MARKET_MANAGER_ADDRESS, validators]);

  // Fetch chart data from StakePlaced events
  useEffect(() => {
    const fetchChartData = async () => {
      if (!marketId || !MARKET_MANAGER_ADDRESS || !market) {
        setLoadingChart(false);
        return;
      }

      try {
        setLoadingChart(true);
        const provider = new ethers.JsonRpcProvider('https://rpc-pepu-v2-mainnet-0.t.conduit.xyz');
        const contract = new ethers.Contract(MARKET_MANAGER_ADDRESS, [
          {
            "anonymous": false,
            "inputs": [
              {"indexed": true, "name": "marketId", "type": "uint256"},
              {"indexed": true, "name": "user", "type": "address"},
              {"indexed": false, "name": "option", "type": "uint256"},
              {"indexed": false, "name": "amount", "type": "uint256"}
            ],
            "name": "StakePlaced",
            "type": "event"
          }
        ], provider);

        const filter = contract.filters.StakePlaced(marketId);
        const events = await contract.queryFilter(filter, 0, 'latest');

        const processedData: Array<{time: string, volume: number, cumulative: number}> = [];
        let cumulative = 0;

        for (const event of events) {
          if (!('args' in event) || !event.args) continue;
          const block = await provider.getBlock(event.blockNumber);
          if (!block) continue;
          const amount = Number(formatEther((event.args as any).amount as bigint));
          cumulative += amount;
          
          processedData.push({
            time: new Date(Number(block.timestamp) * 1000).toLocaleTimeString('en-US', { 
              hour: '2-digit', 
              minute: '2-digit',
              month: 'short',
              day: 'numeric'
            }),
            volume: amount,
            cumulative: cumulative
          });
        }

        if (processedData.length === 0) {
          processedData.push({
            time: new Date(Number(market.startTime) * 1000).toLocaleTimeString('en-US', { 
              hour: '2-digit', 
              minute: '2-digit',
              month: 'short',
              day: 'numeric'
            }),
            volume: 0,
            cumulative: 0
          });
        }

        setChartData(processedData);
      } catch (error) {
        console.error('Error fetching chart data:', error);
        setChartData([]);
      } finally {
        setLoadingChart(false);
      }
    };

    if (market && marketId) {
      fetchChartData();
    }
  }, [marketId, market, MARKET_MANAGER_ADDRESS]);

  // Handle stake placement
  const handleStake = async () => {
    if (!betAmount || !selectedOption || !isConnected || !marketId || !market) return;

    const amount = parseEther(betAmount);
    const needsApproval = isERC20Market && tokenAllowance !== undefined && tokenAllowance < amount;

    if (needsApproval) {
      // Approve first
      try {
        setIsApproving(true);
        await writeContract({
          address: market.paymentToken,
          abi: ERC20_ABI,
          functionName: 'approve',
          args: [MARKET_MANAGER_ADDRESS, amount],
        });
      } catch (error) {
        console.error('Error approving:', error);
        setIsApproving(false);
        return;
      }
    }

    try {
      setIsStaking(true);
      if (isERC20Market) {
        await writeContract({
          address: MARKET_MANAGER_ADDRESS,
          abi: MARKET_MANAGER_ABI,
          functionName: 'placeStakeWithToken',
          args: [BigInt(marketId), BigInt(selectedOption), amount],
        });
      } else {
        await writeContract({
          address: MARKET_MANAGER_ADDRESS,
          abi: MARKET_MANAGER_ABI,
          functionName: 'placeStake',
          args: [BigInt(marketId), BigInt(selectedOption)],
          value: amount,
        });
      }
    } catch (error) {
      console.error('Error placing stake:', error);
    } finally {
      setIsStaking(false);
      setIsApproving(false);
    }
  };

  const getMarketTitle = () => {
    if (loading) return 'Loading...';
    if (marketMetadata?.title) return marketMetadata.title;
    return `Market #${marketId}`;
  };

  const getMarketOptions = () => {
    if (marketMetadata?.options && Array.isArray(marketMetadata.options)) {
      return marketMetadata.options;
    }
    return ['Yes', 'No'];
  };

  const getMarketImage = () => {
    if (marketMetadata?.imageUrl) {
      return marketMetadata.imageUrl;
    }
    return null;
  };

  const getDisplayName = (address: string, username?: string, displayName?: string) => {
    if (username) return `@${username}`;
    if (displayName) return displayName;
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const getExplorerLink = (address: string) => {
    return `${EXPLORER_URL}/address/${address}`;
  };

  // Show loading state
  if (marketLoading || loading || marketId === null) {
    return (
      <div className={`min-h-screen ${isDarkMode ? 'bg-black' : 'bg-[#F5F3F0]'} flex items-center justify-center`}>
        <div className="text-center">
          <div className={`animate-spin rounded-full h-12 w-12 border-b-2 ${isDarkMode ? 'border-[#39FF14]' : 'border-emerald-600'} mx-auto mb-4`}></div>
          <p className={isDarkMode ? 'text-white/70' : 'text-gray-600'}>Loading market data...</p>
        </div>
      </div>
    );
  }

  // Show error if market doesn't exist
  if (marketError || !market) {
    return (
      <div className={`min-h-screen ${isDarkMode ? 'bg-black' : 'bg-[#F5F3F0]'} flex items-center justify-center`}>
        <div className="text-center">
          <h1 className={`text-2xl font-bold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Market Not Found</h1>
          <p className={isDarkMode ? 'text-white/70' : 'text-gray-600'}>Market #{marketId} does not exist.</p>
          <Link 
            href="/"
            className={`mt-4 inline-block px-4 py-2 rounded-lg transition-colors ${
              isDarkMode 
                ? 'bg-[#39FF14] hover:bg-[#39FF14]/80 text-black' 
                : 'bg-[#39FF14] hover:bg-[#39FF14]/80 text-black border border-black'
            }`}
          >
            Back to Markets
          </Link>
        </div>
      </div>
    );
  }

  const isMarketEnded = Number(market.state) === 1;
  const isMarketResolved = Number(market.state) === 2;
  const options = getMarketOptions();
  const canStake = market.state === 0 && Number(market.stakeEndTime) * 1000 > Date.now() && !userHasStaked;
  const needsApproval = isERC20Market && betAmount && tokenAllowance !== undefined && tokenAllowance < parseEther(betAmount);

  return (
    <div className={`min-h-screen ${isDarkMode ? 'bg-black' : 'bg-[#F5F3F0]'}`}>
      {/* Sidebar */}
      <Sidebar 
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        isDarkMode={isDarkMode}
      />

      {/* Main Content */}
      <div className={`transition-all duration-300 ${
        sidebarCollapsed ? 'lg:ml-16' : 'lg:ml-64'
      }`}>
        {/* Header */}
        <div className={`sticky top-0 z-30 border-b ${
          isDarkMode 
            ? 'bg-black border-[#39FF14]/20' 
            : 'bg-[#F5F3F0] border-gray-200'
        }`}>
          <div className="px-3 sm:px-4 lg:px-8 py-1.5 lg:py-2">
            <div className="flex items-center justify-between">
              {/* Left side */}
              <div className="flex items-center gap-2 sm:gap-4">
                <button
                  onClick={() => setSidebarOpen(true)}
                  className={`lg:hidden p-2 rounded-lg transition-colors ${
                    isDarkMode 
                      ? 'hover:bg-[#39FF14]/10 text-white' 
                      : 'hover:bg-gray-200 text-gray-700'
                  }`}
                >
                  <Menu size={20} className={isDarkMode ? 'text-white' : 'text-gray-900'} />
                </button>
                
                <Link href="/" className="lg:hidden transition-opacity hover:opacity-80 cursor-pointer">
                  <Image
                    src="/mobile.png"
                    alt="P2P"
                    width={90}
                    height={45}
                    className="object-contain"
                    priority
                  />
                </Link>
                
                <Link 
                  href="/"
                  className={`flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-2 rounded-lg transition-colors ${
                    isDarkMode 
                      ? 'hover:bg-[#39FF14]/10 text-white' 
                      : 'hover:bg-gray-200 text-gray-700'
                  }`}
                >
                  <ArrowLeft size={18} />
                  <span className="font-medium text-sm sm:text-base hidden sm:inline">Back to Markets</span>
                  <span className="font-medium text-sm sm:hidden">Back</span>
                </Link>
              </div>

              {/* Right side */}
              <div className="flex items-center gap-2 sm:gap-3">
                <button
                  onClick={toggleTheme}
                  className={`p-1.5 lg:p-2 rounded-lg transition-colors ${
                    isDarkMode 
                      ? 'hover:bg-[#39FF14]/10 text-white' 
                      : 'hover:bg-gray-200 text-gray-700'
                  }`}
                >
                  {isDarkMode ? <Sun size={20} className="text-white" /> : <Moon size={20} className="text-gray-600" />}
                </button>
                {isConnected ? (
                  <div className={`flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1.5 rounded text-xs sm:text-sm font-medium ${
                    isDarkMode 
                      ? 'bg-[#39FF14]/10 text-white border border-[#39FF14]/30' 
                      : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  }`}>
                    <Wallet size={16} />
                    <span className="font-mono hidden sm:inline">
                      {address?.slice(0, 6)}...{address?.slice(-4)}
                    </span>
                    <span className="font-mono sm:hidden">
                      {address?.slice(0, 4)}...{address?.slice(-2)}
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 sm:gap-2">
                    <Wallet size={16} className={isDarkMode ? 'text-white/60' : 'text-gray-400'} />
                    <div className="scale-90 sm:scale-100">
                      <ConnectButton />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-4 sm:py-6 lg:py-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
            {/* Left Column - Main Content */}
            <div className="lg:col-span-2 space-y-4 sm:space-y-6">
              {/* Market Header */}
              <div className={`rounded-xl shadow-sm p-4 sm:p-6 border ${
                isDarkMode ? 'bg-black border-gray-800' : 'bg-[#F5F3F0] border-gray-300'
              }`}>
                <div className="flex items-center gap-3 sm:gap-4 mb-3 sm:mb-4">
                  {getMarketImage() && (
                    <img
                      src={getMarketImage()!}
                      alt=""
                      className={`w-12 h-12 sm:w-16 sm:h-16 rounded-lg object-cover border ${
                        isDarkMode ? 'border-gray-800' : 'border-gray-300'
                      }`}
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <h1 className={`text-lg sm:text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                      {getMarketTitle()}
                    </h1>
                    <div className="flex items-center gap-2 mt-1">
                      <p className={`text-xs sm:text-sm ${isDarkMode ? 'text-white/60' : 'text-gray-600'}`}>
                        Market ID: #{marketId}
                      </p>
                      <span className={`text-xs ${isDarkMode ? 'text-white/40' : 'text-gray-400'}`}>•</span>
                      <a
                        href={getExplorerLink(market.creator)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`text-xs sm:text-sm hover:underline inline-flex items-center gap-1 ${
                          isDarkMode ? 'text-blue-400' : 'text-blue-600'
                        }`}
                      >
                        Creator: {getDisplayName(market.creator, creatorProfile?.username, creatorProfile?.display_name)}
                        <ExternalLink size={12} />
                      </a>
                    </div>
                  </div>
                </div>
                
                {/* Description and Vanity Info Section */}
                {(marketMetadata?.description || marketMetadata?.vanityInfo) && (
                  <div className={`mt-4 sm:mt-6 pt-4 sm:pt-6 border-t ${isDarkMode ? 'border-gray-800' : 'border-gray-300'}`}>
                    {marketMetadata?.description && (
                      <div className="mb-4 sm:mb-6">
                        <h3 className={`text-sm sm:text-base font-semibold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-700'}`}>
                          Description
                        </h3>
                        <p className={`text-sm sm:text-base leading-relaxed ${isDarkMode ? 'text-white/70' : 'text-gray-600'}`}>
                          {marketMetadata.description}
                        </p>
                      </div>
                    )}
                    {marketMetadata?.vanityInfo && (
                      <div>
                        <h3 className={`text-sm sm:text-base font-semibold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-700'}`}>
                          Resources & Links
                        </h3>
                        <div className={`text-sm sm:text-base leading-relaxed whitespace-pre-wrap break-words ${isDarkMode ? 'text-white/70' : 'text-gray-600'}`}>
                          {marketMetadata.vanityInfo.split('\n').map((line: string, idx: number) => {
                            const urlPattern = /(https?:\/\/[^\s]+)/g;
                            const parts = line.split(urlPattern);
                            return (
                              <div key={idx} className="mb-2 break-words">
                                {parts.map((part, partIdx) => {
                                  if (urlPattern.test(part)) {
                                    return (
                                      <a
                                        key={partIdx}
                                        href={part}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className={`inline-flex items-center gap-1 underline hover:opacity-80 break-all ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}
                                      >
                                        <span className="break-all">{part}</span>
                                        <ExternalLink size={14} className="flex-shrink-0" />
                                      </a>
                                    );
                                  }
                                  return <span key={partIdx} className="break-words">{part}</span>;
                                })}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Activity Chart */}
              <div className={`rounded-xl shadow-sm p-4 sm:p-6 border ${
                isDarkMode ? 'bg-black border-gray-800' : 'bg-[#F5F3F0] border-gray-300'
              }`}>
                <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
                  <TrendingUp className={`${isDarkMode ? 'text-[#39FF14]' : 'text-emerald-600'}`} size={24} />
                  <h3 className={`text-base sm:text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    Market Activity
                  </h3>
                </div>
                {loadingChart ? (
                  <div className="h-64 flex items-center justify-center">
                    <div className={`animate-spin rounded-full h-8 w-8 border-b-2 ${isDarkMode ? 'border-[#39FF14]' : 'border-emerald-600'}`}></div>
                  </div>
                ) : chartData.length > 0 ? (
                  <div className="h-64 sm:h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData}>
                        <defs>
                          <linearGradient id="colorVolume" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={isDarkMode ? '#39FF14' : '#10B981'} stopOpacity={0.3}/>
                            <stop offset="95%" stopColor={isDarkMode ? '#39FF14' : '#10B981'} stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? '#374151' : '#D1D5DB'} />
                        <XAxis 
                          dataKey="time" 
                          stroke={isDarkMode ? '#9CA3AF' : '#6B7280'}
                          fontSize={12}
                          tick={{ fill: isDarkMode ? '#9CA3AF' : '#6B7280' }}
                        />
                        <YAxis 
                          stroke={isDarkMode ? '#9CA3AF' : '#6B7280'}
                          fontSize={12}
                          tick={{ fill: isDarkMode ? '#9CA3AF' : '#6B7280' }}
                          tickFormatter={(value) => `${value.toFixed(2)}`}
                        />
                        <Tooltip 
                          contentStyle={{
                            backgroundColor: isDarkMode ? '#111827' : '#F9FAFB',
                            border: isDarkMode ? '1px solid #374151' : '1px solid #E5E7EB',
                            borderRadius: '8px',
                            color: isDarkMode ? '#F9FAFB' : '#111827'
                          }}
                          formatter={(value: number) => [`${value.toFixed(4)}`, 'Volume']}
                        />
                        <Area 
                          type="monotone" 
                          dataKey="cumulative" 
                          stroke={isDarkMode ? '#39FF14' : '#10B981'} 
                          strokeWidth={2}
                          fillOpacity={1} 
                          fill="url(#colorVolume)" 
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className={`h-64 flex items-center justify-center ${isDarkMode ? 'text-white/60' : 'text-gray-600'}`}>
                    <p>No activity data available</p>
                  </div>
                )}
              </div>

              {/* Market Details */}
              <div className={`rounded-xl shadow-sm p-4 sm:p-6 border ${
                isDarkMode ? 'bg-black border-gray-800' : 'bg-[#F5F3F0] border-gray-300'
              }`}>
                <h3 className={`text-base sm:text-lg font-semibold mb-3 sm:mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  Market Details
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                  <div>
                    <span className={`text-xs sm:text-sm ${isDarkMode ? 'text-white/60' : 'text-gray-600'}`}>Total Volume</span>
                    <p className={`text-lg sm:text-xl font-bold mt-1 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                      {totalVolume ? `${Number(formatEther(totalVolume)).toFixed(2)}` : '0.00'} {isERC20Market ? 'Tokens' : 'PEPU'}
                    </p>
                  </div>
                  <div>
                    <span className={`text-xs sm:text-sm ${isDarkMode ? 'text-white/60' : 'text-gray-600'}`}>Total Stakers</span>
                    <p className={`text-lg sm:text-xl font-bold mt-1 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                      {stakerCount ? Number(stakerCount).toLocaleString() : '0'}
                    </p>
                  </div>
                  <div>
                    <span className={`text-xs sm:text-sm ${isDarkMode ? 'text-white/60' : 'text-gray-600'}`}>Market State</span>
                    <p className={`text-lg sm:text-xl font-bold mt-1 ${
                      Number(market?.state) === 0 
                        ? isDarkMode ? 'text-yellow-400' : 'text-yellow-600'
                        : Number(market?.state) === 1
                        ? isDarkMode ? 'text-[#39FF14]' : 'text-green-600'
                        : isDarkMode ? 'text-blue-400' : 'text-blue-600'
                    }`}>
                      {Number(market?.state) === 0 ? 'Active' : Number(market?.state) === 1 ? 'Ended' : 'Resolved'}
                    </p>
                  </div>
                  <div>
                    <span className={`text-xs sm:text-sm ${isDarkMode ? 'text-white/60' : 'text-gray-600'}`}>Stake End Time</span>
                    <p className={`text-sm sm:text-base font-medium mt-1 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                      {market?.stakeEndTime ? new Date(Number(market.stakeEndTime) * 1000).toLocaleString() : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <span className={`text-xs sm:text-sm ${isDarkMode ? 'text-white/60' : 'text-gray-600'}`}>End Time</span>
                    <p className={`text-sm sm:text-base font-medium mt-1 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                      {market?.endTime ? new Date(Number(market.endTime) * 1000).toLocaleString() : 'N/A'}
                    </p>
                  </div>
                  {option1Pool && option2Pool && (
                    <>
                      <div>
                        <span className={`text-xs sm:text-sm ${isDarkMode ? 'text-white/60' : 'text-gray-600'}`}>
                          {options[0] || 'Option 1'} Pool
                        </span>
                        <p className={`text-sm sm:text-base font-medium mt-1 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                          {Number(formatEther(option1Pool)).toFixed(2)}
                        </p>
                      </div>
                      <div>
                        <span className={`text-xs sm:text-sm ${isDarkMode ? 'text-white/60' : 'text-gray-600'}`}>
                          {options[1] || 'Option 2'} Pool
                        </span>
                        <p className={`text-sm sm:text-base font-medium mt-1 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                          {Number(formatEther(option2Pool)).toFixed(2)}
                        </p>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Stakers List */}
              <div className={`rounded-xl shadow-sm p-4 sm:p-6 border ${
                isDarkMode ? 'bg-black border-gray-800' : 'bg-[#F5F3F0] border-gray-300'
              }`}>
                <div className="flex items-center gap-2 sm:gap-3 mb-4">
                  <Users className={`${isDarkMode ? 'text-[#39FF14]' : 'text-emerald-600'}`} size={24} />
                  <h3 className={`text-base sm:text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    Stakers ({stakers.length})
                  </h3>
                </div>
                {loadingStakers ? (
                  <div className="flex items-center justify-center py-8">
                    <div className={`animate-spin rounded-full h-6 w-6 border-b-2 ${isDarkMode ? 'border-[#39FF14]' : 'border-emerald-600'}`}></div>
                  </div>
                ) : stakers.length > 0 ? (
                  <div className="space-y-2">
                    {stakers.map((staker, idx) => (
                      <div
                        key={idx}
                        className={`flex items-center justify-between p-3 rounded-lg border ${
                          isDarkMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <User size={16} className={isDarkMode ? 'text-white/60' : 'text-gray-400'} />
                          <a
                            href={getExplorerLink(staker.address)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`hover:underline inline-flex items-center gap-1 ${
                              isDarkMode ? 'text-blue-400' : 'text-blue-600'
                            }`}
                          >
                            {getDisplayName(staker.address, staker.username, staker.displayName)}
                            <ExternalLink size={12} />
                          </a>
                          {staker.isCreator && (
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                              isDarkMode 
                                ? 'bg-yellow-900/40 text-yellow-300 border border-yellow-700/50' 
                                : 'bg-yellow-100 text-yellow-800 border border-yellow-300'
                            }`}>
                              <Crown size={12} />
                              Creator
                            </span>
                          )}
                          {staker.isValidator && (
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                              isDarkMode 
                                ? 'bg-blue-900/40 text-blue-300 border border-blue-700/50' 
                                : 'bg-blue-100 text-blue-800 border border-blue-300'
                            }`}>
                              <Shield size={12} />
                              Validator
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-4">
                          <span className={`text-sm ${isDarkMode ? 'text-white/70' : 'text-gray-600'}`}>
                            {options[staker.option - 1] || `Option ${staker.option}`}
                          </span>
                          <span className={`text-sm font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                            {Number(formatEther(staker.amount)).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className={`text-center py-8 ${isDarkMode ? 'text-white/60' : 'text-gray-600'}`}>
                    No stakers yet
                  </p>
                )}
              </div>
            </div>

            {/* Right Column - Stake Placement */}
            <div className="lg:col-span-1">
              <div className={`rounded-xl shadow-sm p-4 sm:p-6 border sticky top-20 ${
                isDarkMode ? 'bg-black border-gray-800' : 'bg-[#F5F3F0] border-gray-300'
              }`}>
                <h3 className={`text-lg font-semibold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  Place Your Stake
                </h3>
                
                {!isConnected ? (
                  <div className="text-center py-6">
                    <p className={`mb-4 text-sm ${isDarkMode ? 'text-white/70' : 'text-gray-600'}`}>
                      Connect your wallet to place a stake
                    </p>
                    <div className="scale-90">
                      <ConnectButton />
                    </div>
                  </div>
                ) : userHasStaked ? (
                  <div className={`text-center py-6 ${isDarkMode ? 'text-white/70' : 'text-gray-600'}`}>
                    <p>You have already staked on this market</p>
                  </div>
                ) : !canStake ? (
                  <div className={`text-center py-6 ${isDarkMode ? 'text-white/70' : 'text-gray-600'}`}>
                    <p>Staking period has ended</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Options */}
                    <div>
                      <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-white' : 'text-gray-700'}`}>
                        Select Option
                      </label>
                      <div className="space-y-2">
                        {options.map((option: string, index: number) => (
                          <button
                            key={index}
                            onClick={() => setSelectedOption(index + 1)}
                            className={`w-full p-3 rounded-lg border text-left transition-colors ${
                              selectedOption === index + 1
                                ? isDarkMode
                                  ? 'border-[#39FF14] bg-[#39FF14]/10'
                                  : 'border-[#39FF14] bg-[#39FF14]/10 border-2'
                                : isDarkMode
                                  ? 'border-gray-700 hover:bg-gray-800'
                                  : 'border-gray-300 hover:bg-gray-100'
                            }`}
                          >
                            <span className={`font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                              {option}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Amount Input */}
                    <div>
                      <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-white' : 'text-gray-700'}`}>
                        Amount
                      </label>
                      <input
                        type="number"
                        value={betAmount}
                        onChange={(e) => setBetAmount(e.target.value)}
                        placeholder={`Min: ${market?.minStake ? formatEther(market.minStake) : '0'}`}
                        className={`w-full px-3 py-2 border rounded-lg ${
                          isDarkMode
                            ? 'bg-gray-900 border-gray-700 text-white placeholder-gray-500'
                            : 'bg-white border-gray-300 text-gray-900'
                        }`}
                      />
                    </div>

                    {/* Stake Button */}
                    <button
                      onClick={handleStake}
                      disabled={!betAmount || isStaking || isApproving || needsApproval}
                      className={`w-full py-3 px-4 rounded-lg font-medium transition-colors ${
                        !betAmount || isStaking || isApproving || needsApproval
                          ? isDarkMode
                            ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                            : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                          : isDarkMode
                            ? 'bg-[#39FF14] hover:bg-[#39FF14]/80 text-black'
                            : 'bg-[#39FF14] hover:bg-[#39FF14]/80 text-black border border-black'
                      }`}
                    >
                      {isApproving ? 'Approving...' : isStaking ? 'Staking...' : needsApproval ? 'Approve First' : 'Place Stake'}
                    </button>

                    {needsApproval && (
                      <p className={`text-xs text-center ${isDarkMode ? 'text-yellow-400' : 'text-yellow-600'}`}>
                        Please approve tokens first
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
