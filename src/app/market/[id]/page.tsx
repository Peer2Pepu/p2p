'use client';

import { useState, useEffect, useMemo } from 'react';
import { useReadContract, useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Sidebar } from '../../components/Sidebar';
import { HeaderWallet } from '@/components/HeaderWallet';
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

// Price feed to chart URL mapping
// TradingView widgets for major coins, Gecko Terminal for PEPU
// Keys are lowercase to match the converted priceFeed address
const PRICE_FEED_TO_CHART_CONFIG: Record<string, { symbol: string; type: 'tradingview' | 'gecko'; geckoUrl?: string }> = {
  '0x20d9bbeae75d9e17176520ad473234be293e4c5d': {
    symbol: 'CRYPTOCAP:ETH',
    type: 'tradingview'
  }, // ETH/USD
  '0xa74ccee7759c7bb2ce3f0b1599428fed08fab8ce': {
    symbol: 'CRYPTOCAP:BTC',
    type: 'tradingview'
  }, // BTC/USD
  '0x786be298cfff15c49727c0998392ff38e45f99b3': {
    symbol: 'CRYPTOCAP:SOL',
    type: 'tradingview'
  }, // SOL/USD
  '0x51c17e20994c6c0ee787fe1604ef14ebafdb7ce9': {
    symbol: '',
    type: 'gecko',
    geckoUrl: 'https://www.geckoterminal.com/eth/pools/0xb1b10b05aa043dd8d471d4da999782bc694993e3ecbe8e7319892b261b412ed5'
  } // PEPU/USD - Gecko Terminal
};

// Helper function to get chart URL based on config and theme
const getChartUrl = (config: { symbol: string; type: 'tradingview' | 'gecko'; geckoUrl?: string } | null, isDarkMode: boolean): string | null => {
  if (!config) return null;
  
  if (config.type === 'gecko' && config.geckoUrl) {
    // Gecko Terminal doesn't support simple iframe embeds
    // Return the direct URL - we'll show it as a link or use their widget
    return config.geckoUrl;
  }
  
  if (config.type === 'tradingview') {
    const theme = isDarkMode ? 'dark' : 'light';
    const bgColor = isDarkMode ? '%23111417' : '%23FFFFFF';
    const toolbarBg = isDarkMode ? '%23111417' : '%23FFFFFF';
    // Use TradingView's advanced chart widget which is more reliable
    return `https://www.tradingview.com/widgetembed/?symbol=${config.symbol}&interval=D&theme=${theme}&style=1&locale=en&backgroundColor=${bgColor}&hide_top_toolbar=0&hide_legend=0&save_image=0&toolbar_bg=${toolbarBg}&studies=%5B%5D&hide_volume=0&withdateranges=0&range=1M&allow_symbol_change=0`;
  }
  
  return null;
};

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
          {"name": "isResolved", "type": "bool"},
          {"name": "resolvedTimestamp", "type": "uint256"},
          {"name": "marketType", "type": "uint8"},
          {"name": "priceFeed", "type": "address"},
          {"name": "priceThreshold", "type": "uint256"},
          {"name": "resolvedPrice", "type": "uint256"}
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

const GET_MARKET_ABI_V2 = [
  {
    "inputs": [{ "name": "marketId", "type": "uint256" }],
    "name": "getMarket",
    "outputs": [
      {
        "components": [
          { "name": "creator", "type": "address" },
          { "name": "ipfsHash", "type": "string" },
          { "name": "isMultiOption", "type": "bool" },
          { "name": "maxOptions", "type": "uint256" },
          { "name": "paymentToken", "type": "address" },
          { "name": "minStake", "type": "uint256" },
          { "name": "creatorDeposit", "type": "uint256" },
          { "name": "creatorOutcome", "type": "uint256" },
          { "name": "startTime", "type": "uint256" },
          { "name": "stakeEndTime", "type": "uint256" },
          { "name": "endTime", "type": "uint256" },
          { "name": "resolutionEndTime", "type": "uint256" },
          { "name": "state", "type": "uint8" },
          { "name": "winningOption", "type": "uint256" },
          { "name": "isResolved", "type": "bool" },
          { "name": "resolvedTimestamp", "type": "uint256" },
          { "name": "marketType", "type": "uint8" },
          { "name": "priceFeed", "type": "address" },
          { "name": "priceThreshold", "type": "uint256" },
          { "name": "resolvedPrice", "type": "uint256" }
        ],
        "name": "",
        "type": "tuple"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  }
];

const GET_MARKET_ABI_LEGACY = [
  {
    "inputs": [{ "name": "marketId", "type": "uint256" }],
    "name": "getMarket",
    "outputs": [
      {
        "components": [
          { "name": "creator", "type": "address" },
          { "name": "ipfsHash", "type": "string" },
          { "name": "isMultiOption", "type": "bool" },
          { "name": "maxOptions", "type": "uint256" },
          { "name": "paymentToken", "type": "address" },
          { "name": "minStake", "type": "uint256" },
          { "name": "creatorDeposit", "type": "uint256" },
          { "name": "creatorOutcome", "type": "uint256" },
          { "name": "startTime", "type": "uint256" },
          { "name": "stakeEndTime", "type": "uint256" },
          { "name": "endTime", "type": "uint256" },
          { "name": "resolutionEndTime", "type": "uint256" },
          { "name": "state", "type": "uint8" },
          { "name": "winningOption", "type": "uint256" },
          { "name": "isResolved", "type": "bool" },
          { "name": "marketType", "type": "uint8" },
          { "name": "priceFeed", "type": "address" },
          { "name": "priceThreshold", "type": "uint256" },
          { "name": "p2pAssertionId", "type": "bytes32" },
          { "name": "p2pAssertionMade", "type": "bool" }
        ],
        "name": "",
        "type": "tuple"
      }
    ],
    "stateMutability": "view",
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
}

export default function MarketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const [marketId, setMarketId] = useState<number | null>(null);
  
  useEffect(() => {
    params.then(({ id }) => {
      setMarketId(parseInt(id));
    });
  }, [params]);
  
  const { address, isConnected } = useAccount();
  const { writeContract, data: writeHash } = useWriteContract();
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
  const [betAmount, setBetAmount] = useState('');
  const [selectedOption, setSelectedOption] = useState(1);
  const [isStaking, setIsStaking] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [chartType, setChartType] = useState<'activity' | 'price'>('activity');
  const [resolvedPrice, setResolvedPrice] = useState<string | null>(null);
  const [priceDecimals, setPriceDecimals] = useState<number>(8);
  const [pendingTxType, setPendingTxType] = useState<'approval' | 'stake' | null>(null);
  const [formattedThreshold, setFormattedThreshold] = useState<string | null>(null);
  const [market, setMarket] = useState<any | null>(null);
  const [marketLoading, setMarketLoading] = useState(true);
  const [marketError, setMarketError] = useState<any>(null);

  const MARKET_MANAGER_ADDRESS = (process.env.NEXT_PUBLIC_P2P_MARKET_MANAGER_ADDRESS || process.env.NEXT_PUBLIC_P2P_MARKETMANAGER_ADDRESS) as `0x${string}`;

  // Fetch market data with ABI fallback (v2 -> legacy), matching inspect script behavior.
  useEffect(() => {
    let cancelled = false;

    const fetchMarket = async () => {
      if (!marketId || !MARKET_MANAGER_ADDRESS) {
        if (!cancelled) {
          setMarket(null);
          setMarketLoading(false);
        }
        return;
      }

      try {
        if (!cancelled) {
          setMarketLoading(true);
          setMarketError(null);
        }

        const provider = new ethers.JsonRpcProvider('https://rpc-pepu-v2-mainnet-0.t.conduit.xyz');
        const contractV2 = new ethers.Contract(MARKET_MANAGER_ADDRESS, GET_MARKET_ABI_V2, provider);
        const contractLegacy = new ethers.Contract(MARKET_MANAGER_ADDRESS, GET_MARKET_ABI_LEGACY, provider);

        let fetchedMarket = await contractV2.getMarket(BigInt(marketId));
        if (Number(fetchedMarket?.marketType) > 1) {
          fetchedMarket = await contractLegacy.getMarket(BigInt(marketId));
        }

        const normalizedMarket = {
          ...fetchedMarket,
          resolvedTimestamp: fetchedMarket?.resolvedTimestamp ?? BigInt(0),
          resolvedPrice: fetchedMarket?.resolvedPrice ?? BigInt(0),
        };

        if (!cancelled) {
          setMarket(normalizedMarket);
          setMarketLoading(false);
        }
      } catch (error) {
        console.error('Error fetching market from contract:', error);
        if (!cancelled) {
          setMarket(null);
          setMarketError(error);
          setMarketLoading(false);
        }
      }
    };

    fetchMarket();
    const interval = setInterval(fetchMarket, 10000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [marketId, MARKET_MANAGER_ADDRESS]);

  // Determine if this is a price-feed market.
  // We primarily rely on `priceFeed` being non-zero, because some markets may have
  // `marketType` values that are inconsistent with the UI mapping.
  const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
  const marketTypeValue = market?.marketType !== undefined ? Number(market.marketType) : null;
  const priceFeedAddress = market?.priceFeed?.toLowerCase();
  const isPriceFeedMarket =
    !!market &&
    !!priceFeedAddress &&
    priceFeedAddress !== ZERO_ADDRESS;
  const chartConfig = priceFeedAddress ? PRICE_FEED_TO_CHART_CONFIG[priceFeedAddress] : null;
  const chartUrl = getChartUrl(chartConfig, isDarkMode);

  // Fetch decimals from price feed contract for all price feed markets
  useEffect(() => {
    const fetchDecimals = async () => {
      if (!isPriceFeedMarket || !priceFeedAddress) {
        setPriceDecimals(8); // Default
        return;
      }

      try {
        const provider = new ethers.JsonRpcProvider('https://rpc-pepu-v2-mainnet-0.t.conduit.xyz');
        const priceFeedContract = new ethers.Contract(
          priceFeedAddress,
          [
            {
              "inputs": [],
              "name": "decimals",
              "outputs": [{"name": "", "type": "uint8"}],
              "stateMutability": "view",
              "type": "function"
            }
          ],
          provider
        );

        const decimals = await priceFeedContract.decimals();
        const decimalsNum = Number(decimals);
        setPriceDecimals(decimalsNum);
      } catch (error) {
        console.error('Error fetching decimals:', error);
        setPriceDecimals(8); // Default fallback
      }
    };

    fetchDecimals();
  }, [isPriceFeedMarket, priceFeedAddress]);

  // Format threshold for all price feed markets
  useEffect(() => {
    const formatThreshold = () => {
      if (!isPriceFeedMarket || !market?.priceThreshold) {
        setFormattedThreshold(null);
        return;
      }

      try {
        const thresholdBigInt = BigInt(market.priceThreshold.toString());
        // Cap display decimals so the UI can't create an infinitely-long number string.
        const displayDecimals = Math.min(priceDecimals, 6);
        const divisor = BigInt(10 ** displayDecimals);
        const wholePart = thresholdBigInt / divisor;
        const fractionalPart = thresholdBigInt % divisor;
        const fractionalStr = fractionalPart.toString().padStart(displayDecimals, '0');
        
        // Remove trailing zeros but keep at least one decimal place
        const trimmed = fractionalStr.replace(/0+$/, '');
        const thresholdStr = `${wholePart}.${trimmed || '0'}`;
        setFormattedThreshold(thresholdStr);
      } catch (error) {
        console.error('Error formatting threshold:', error);
        setFormattedThreshold(null);
      }
    };

    formatThreshold();
  }, [isPriceFeedMarket, market?.priceThreshold, priceDecimals]);

  // Format resolved price from contract for resolved price feed markets
  useEffect(() => {
    const formatResolvedPrice = async () => {
      const isResolved = market && Number(market.state) === 2;
      
      if (!isPriceFeedMarket || !isResolved || !priceFeedAddress) {
        setResolvedPrice(null);
        return;
      }

      // Check if resolvedPrice exists (even if 0, it's valid)
      if (market?.resolvedPrice === undefined || market?.resolvedPrice === null) {
        setResolvedPrice(null);
        return;
      }

      try {
        // Format resolved price from contract
        const priceValue = BigInt(market.resolvedPrice.toString());
        // Cap decimals + abbreviate huge integer part so the UI doesn't print
        // extremely long numbers.
        const displayDecimals = Math.min(priceDecimals, 6);
        const divisor = BigInt(10 ** displayDecimals);
        const wholePart = priceValue / divisor;
        const fractionalPart = priceValue % divisor;
        const fractionalStr = fractionalPart.toString().padStart(displayDecimals, '0');
        
        // Format price with full decimals
        let priceStr: string;
        if (wholePart === BigInt(0)) {
          // Remove trailing zeros but keep at least one decimal place
          const trimmed = fractionalStr.replace(/0+$/, '');
          priceStr = `0.${trimmed || '0'}`;
        } else {
          // Remove trailing zeros but keep at least one decimal place
          const trimmed = fractionalStr.replace(/0+$/, '');
          const wholeStr = wholePart.toString();

          // If the integer part is enormous, abbreviate (e.g. 6.86e42) for readability.
          if (wholeStr.length > 10) {
            const exp = wholeStr.length - 1;
            const first4 = wholeStr.slice(0, 4); // 4 digits
            const mantissa = `${first4[0]}.${first4.slice(1)}`;
            priceStr = `${mantissa}e${exp}`;
          } else {
            priceStr = `${wholeStr}.${trimmed || '0'}`;
          }
        }
        
        setResolvedPrice(priceStr);
      } catch (error) {
        console.error('Error formatting resolved price:', error);
        setResolvedPrice(null);
      }
    };

    formatResolvedPrice();
  }, [isPriceFeedMarket, market, priceFeedAddress, priceDecimals]);

  // Debug logging
  useEffect(() => {
    if (market) {
      console.log('Market data:', {
        marketType: market.marketType,
        marketTypeValue,
        priceFeed: market.priceFeed,
        priceFeedLower: priceFeedAddress,
        isPriceFeedMarket,
        chartConfig,
        chartUrl,
        chartType,
        resolvedPrice,
        availablePriceFeeds: Object.keys(PRICE_FEED_TO_CHART_CONFIG)
      });
    }
  }, [market, marketTypeValue, priceFeedAddress, isPriceFeedMarket, chartConfig, chartUrl, chartType, resolvedPrice]);

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
  const { data: tokenAllowance, refetch: refetchAllowance } = useReadContract({
    address: isERC20Market ? market.paymentToken : undefined,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: address && isERC20Market ? [address, MARKET_MANAGER_ADDRESS] : undefined,
    query: {
      enabled: !!isERC20Market && !!address,
      refetchInterval: 10000,
    }
  }) as { data: bigint | undefined; refetch: () => void };

  // Wait for transaction confirmation
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash: writeHash,
  });

  // Handle transaction success
  useEffect(() => {
    if (isConfirmed && writeHash) {
      if (pendingTxType === 'approval') {
        setIsApproving(false);
        setPendingTxType(null);
        // Refetch allowance to update button state
        refetchAllowance();
      } else if (pendingTxType === 'stake') {
        setIsStaking(false);
        setPendingTxType(null);
        // Refresh stakers and chart data
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      }
    }
  }, [isConfirmed, writeHash, pendingTxType, refetchAllowance]);

  // Fetch IPFS metadata
  useEffect(() => {
    const fetchMetadata = async () => {
      if (!market?.ipfsHash) {
        setLoading(false);
        return;
      }
      
      try {
        setLoading(true);
        const { fetchIPFSData } = await import('@/lib/ipfs');
        const metadata = await fetchIPFSData(market.ipfsHash);
        if (metadata) {
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

  // Fetch stakers from API
  useEffect(() => {
    const fetchStakers = async () => {
      if (!marketId || !market) {
        setLoadingStakers(false);
        return;
      }

      try {
        setLoadingStakers(true);
        const response = await fetch(`/api/market/${marketId}/stakers`);
        if (!response.ok) {
          throw new Error('Failed to fetch stakers');
        }
        const { stakers: stakersData } = await response.json();

        // Fetch profiles for all stakers and mark creator
        const stakerList: StakerInfo[] = [];
        const creatorAddress = market.creator?.toLowerCase();
        
        for (const staker of stakersData) {
          try {
            const profile = await getUserProfile(staker.address);
            stakerList.push({
              address: staker.address,
              option: staker.option,
              amount: BigInt(staker.amount),
              username: profile?.username,
              displayName: profile?.display_name,
              isCreator: staker.isCreator || staker.address === creatorAddress
            });
          } catch {
            stakerList.push({
              address: staker.address,
              option: staker.option,
              amount: BigInt(staker.amount),
              isCreator: staker.isCreator || staker.address === creatorAddress
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

    if (market && marketId) {
      fetchStakers();
    } else if (!market || !marketId) {
      setLoadingStakers(false);
    }
  }, [marketId, market]);

  // Fetch chart data from API
  useEffect(() => {
    const fetchChartData = async () => {
      if (!marketId || !market) {
        setLoadingChart(false);
        return;
      }

      try {
        setLoadingChart(true);
        const response = await fetch(`/api/market/${marketId}/chart`);
        if (!response.ok) {
          throw new Error('Failed to fetch chart data');
        }
        const { chartData: processedData } = await response.json();
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
  }, [marketId, market]);

  // Handle stake placement
  const handleStake = async () => {
    if (!betAmount || !selectedOption || !isConnected || !marketId || !market) return;

    const amount = parseEther(betAmount);
    const needsApproval = isERC20Market && tokenAllowance !== undefined && tokenAllowance < amount;

    if (needsApproval) {
      // Approve first - approve 50 million tokens
      try {
        setIsApproving(true);
        setPendingTxType('approval');
        const approvalAmount = parseEther('50000000'); // 50 million
        await writeContract({
          address: market.paymentToken,
          abi: ERC20_ABI,
          functionName: 'approve',
          args: [MARKET_MANAGER_ADDRESS, approvalAmount],
        });
        // Don't reset state here - wait for transaction confirmation
        return;
      } catch (error) {
        console.error('Error approving:', error);
        setIsApproving(false);
        setPendingTxType(null);
        return;
      }
    }

    try {
      setIsStaking(true);
      setPendingTxType('stake');
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
      // Don't reset state here - wait for transaction confirmation
    } catch (error) {
      console.error('Error placing stake:', error);
      setIsStaking(false);
      setPendingTxType(null);
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
                <HeaderWallet isDarkMode={isDarkMode} />
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

              {/* Activity Chart / Price Chart */}
              <div className={`rounded-xl shadow-sm p-4 sm:p-6 border ${
                isDarkMode ? 'bg-black border-gray-800' : 'bg-[#F5F3F0] border-gray-300'
              }`}>
                <div className="flex items-center justify-between mb-4 sm:mb-6">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <TrendingUp className={`${isDarkMode ? 'text-[#39FF14]' : 'text-[#39FF14]'}`} size={24} />
                    <h3 className={`text-base sm:text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                      {chartType === 'activity' ? 'Market Activity' : 'Price Chart'}
                    </h3>
                  </div>
                  {isPriceFeedMarket && chartConfig && (
                    <div className={`flex items-center gap-2 rounded-lg p-1 ${
                      isDarkMode ? 'bg-gray-800' : 'bg-gray-100'
                    }`}>
                      <button
                        onClick={() => setChartType('activity')}
                        className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                          chartType === 'activity'
                            ? 'bg-[#39FF14] text-black'
                            : isDarkMode
                              ? 'text-gray-400 hover:text-white'
                              : 'text-gray-600 hover:text-gray-900'
                        }`}
                      >
                        Activity
                      </button>
                      <button
                        onClick={() => setChartType('price')}
                        className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                          chartType === 'price'
                            ? 'bg-[#39FF14] text-black'
                            : isDarkMode
                              ? 'text-gray-400 hover:text-white'
                              : 'text-gray-600 hover:text-gray-900'
                        }`}
                      >
                        Price
                      </button>
                    </div>
                  )}
                </div>
                {chartType === 'price' && isPriceFeedMarket && chartUrl ? (
                  chartConfig?.type === 'gecko' ? (
                    // Gecko Terminal - show as a card with link since iframe embedding isn't supported
                    <div className={`h-64 sm:h-80 w-full rounded-lg border-2 border-dashed flex flex-col items-center justify-center gap-4 p-6 ${
                      isDarkMode 
                        ? 'border-[#39FF14]/30 bg-[#39FF14]/5' 
                        : 'border-emerald-300 bg-emerald-50/50'
                    }`}>
                      <div className="text-center">
                        <TrendingUp className={`mx-auto mb-3 ${isDarkMode ? 'text-[#39FF14]' : 'text-emerald-600'}`} size={48} />
                        <h4 className={`text-lg font-semibold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                          PEPU/USD Price Chart
                        </h4>
                        <p className={`text-sm mb-4 ${isDarkMode ? 'text-white/70' : 'text-gray-600'}`}>
                          View the live price chart on Gecko Terminal
                        </p>
                        <a
                          href={chartUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                            isDarkMode
                              ? 'bg-[#39FF14] text-black hover:bg-[#39FF14]/90'
                              : 'bg-[#39FF14] text-black hover:bg-[#39FF14]/90'
                          }`}
                        >
                          Open Gecko Terminal
                          <ExternalLink size={16} />
                        </a>
                      </div>
                    </div>
                  ) : (
                    // TradingView charts
                    <div className="h-64 sm:h-80 w-full rounded-lg overflow-hidden border border-gray-300 dark:border-gray-700">
                      <iframe
                        src={chartUrl}
                        className="w-full h-full border-0"
                        title="Price Chart"
                        allow="clipboard-read; clipboard-write"
                        loading="lazy"
                        referrerPolicy="no-referrer-when-downgrade"
                        sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
                      />
                    </div>
                  )
                ) : chartType === 'price' && isPriceFeedMarket && !chartUrl ? (
                  <div className={`h-64 flex items-center justify-center ${isDarkMode ? 'text-white/60' : 'text-gray-600'}`}>
                    <p>Price chart not available for this market</p>
                  </div>
                ) : loadingChart ? (
                  <div className="h-64 flex items-center justify-center">
                    <div className={`animate-spin rounded-full h-8 w-8 border-b-2 ${isDarkMode ? 'border-[#39FF14]' : 'border-[#39FF14]'}`}></div>
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
                  {isPriceFeedMarket && formattedThreshold && (
                    <div>
                      <span className={`text-xs sm:text-sm ${isDarkMode ? 'text-white/60' : 'text-gray-600'}`}>Price Threshold</span>
                      <p
                        className={`text-lg sm:text-xl font-bold mt-1 ${isDarkMode ? 'text-white' : 'text-gray-900'} break-all break-words whitespace-normal leading-snug`}
                      >
                        ${formattedThreshold}
                      </p>
                    </div>
                  )}
                  {isPriceFeedMarket && market && Number(market.state) === 2 && resolvedPrice && (
                    <div>
                      <span className={`text-xs sm:text-sm ${isDarkMode ? 'text-white/60' : 'text-gray-600'}`}>Resolved Price</span>
                      <p className={`text-lg sm:text-xl font-bold mt-1 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                        ${resolvedPrice}
                      </p>
                    </div>
                  )}
                  {isPriceFeedMarket && market && Number(market.state) === 2 && market?.resolvedTimestamp && Number(market.resolvedTimestamp) > 0 && (
                    <div>
                      <span className={`text-xs sm:text-sm ${isDarkMode ? 'text-white/60' : 'text-gray-600'}`}>Resolved Timestamp</span>
                      <p className={`text-sm sm:text-base font-medium mt-1 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                        {new Date(Number(market.resolvedTimestamp) * 1000).toLocaleString()}
                      </p>
                    </div>
                  )}
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
                    {(() => {
                      const amount = betAmount ? parseEther(betAmount) : BigInt(0);
                      const needsApproval = isERC20Market && tokenAllowance !== undefined && tokenAllowance < amount;
                      
                      return (
                        <>
                          <button
                            onClick={handleStake}
                            disabled={!betAmount || isStaking || isApproving || (needsApproval && !isApproving && !isConfirming)}
                            className={`w-full py-3 px-4 rounded-lg font-medium transition-colors ${
                              !betAmount || isStaking || isApproving || (needsApproval && !isApproving && !isConfirming)
                                ? isDarkMode
                                  ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                : isDarkMode
                                  ? 'bg-[#39FF14] hover:bg-[#39FF14]/80 text-black'
                                  : 'bg-[#39FF14] hover:bg-[#39FF14]/80 text-black border border-black'
                            }`}
                          >
                            {isApproving || isConfirming ? 'Approving...' : isStaking ? 'Staking...' : needsApproval ? 'Approve First' : 'Place Stake'}
                          </button>

                          {needsApproval && !isApproving && !isConfirming && (
                            <p className={`text-xs text-center ${isDarkMode ? 'text-yellow-400' : 'text-yellow-600'}`}>
                              Please approve tokens first
                            </p>
                          )}
                        </>
                      );
                    })()}
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
