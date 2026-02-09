"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { 
  BarChart3,
  TrendingUp,
  Users,
  DollarSign,
  Activity,
  Sun,
  Moon,
  Menu,
  Wallet,
  Target,
  Award,
  Clock,
  Zap,
  ExternalLink
} from 'lucide-react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, useReadContract } from 'wagmi';
import { Sidebar } from '../components/Sidebar';
import { HeaderWallet } from '@/components/HeaderWallet';
import { useTheme } from '../context/ThemeContext';
import { 
  LineChart as RechartsLineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  AreaChart,
  Area
} from 'recharts';

// Real Contract ABIs
const ANALYTICS_ABI = [
  {
    "inputs": [],
    "name": "getGlobalStats",
    "outputs": [
      {
        "components": [
          {"name": "totalMarkets", "type": "uint256"},
          {"name": "totalVolume", "type": "uint256"},
          {"name": "totalStakes", "type": "uint256"},
          {"name": "totalSupports", "type": "uint256"},
          {"name": "totalUsers", "type": "uint256"},
          {"name": "totalRevenue", "type": "uint256"}
        ],
        "name": "",
        "type": "tuple"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"name": "limit", "type": "uint256"}],
    "name": "getActiveMarketsByVolume",
    "outputs": [
      {"name": "marketIds", "type": "uint256[]"},
      {"name": "volumes", "type": "uint256[]"}
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"name": "limit", "type": "uint256"}],
    "name": "getTopStakers",
    "outputs": [
      {"name": "stakers", "type": "address[]"},
      {"name": "amounts", "type": "uint256[]"}
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"name": "daysBack", "type": "uint256"}, {"name": "limit", "type": "uint256"}],
    "name": "getRecentActiveMarkets",
    "outputs": [
      {"name": "marketIds", "type": "uint256[]"},
      {"name": "volumes", "type": "uint256[]"}
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"name": "limit", "type": "uint256"}],
    "name": "getActiveMarketsByStakerCount",
    "outputs": [
      {"name": "marketIds", "type": "uint256[]"},
      {"name": "stakerCounts", "type": "uint256[]"}
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"name": "limit", "type": "uint256"}],
    "name": "getActiveMarketsByParticipants",
    "outputs": [
      {"name": "marketIds", "type": "uint256[]"},
      {"name": "participantCounts", "type": "uint256[]"}
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"name": "limit", "type": "uint256"}],
    "name": "getTodayActiveMarkets",
    "outputs": [
      {"name": "marketIds", "type": "uint256[]"},
      {"name": "volumes", "type": "uint256[]"}
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"name": "limit", "type": "uint256"}],
    "name": "getThisWeekActiveMarkets",
    "outputs": [
      {"name": "marketIds", "type": "uint256[]"},
      {"name": "volumes", "type": "uint256[]"}
    ],
    "stateMutability": "view",
    "type": "function"
  }
];

const MARKET_MANAGER_ABI = [
  {
    "inputs": [],
    "name": "getNextMarketId",
    "outputs": [{"name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  }
];

// PEPU Pool Data Component
function PEPUPoolData({ isDarkMode }: { isDarkMode: boolean }) {
  const [poolData, setPoolData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchPoolData = async () => {
      try {
        // Using GeckoTerminal API for PEPU pool data
        const response = await fetch('https://api.geckoterminal.com/api/v2/networks/pepe-unchained/tokens/0x0000000000000000000000000000000000000000');
        if (response.ok) {
          const data = await response.json();
          setPoolData(data.data);
        }
      } catch (error) {
        console.error('Failed to fetch PEPU pool data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPoolData();
  }, []);

  if (isLoading) {
    return (
      <div className={`p-6 rounded-lg border ${
        isDarkMode ? 'bg-black border-[#39FF14]' : 'bg-[#F5F3F0] border-[#39FF14]'
      }`}>
        <div className="flex items-center justify-center h-32">
          <div className={`animate-spin rounded-full h-6 w-6 border-b-2 ${isDarkMode ? 'border-[#39FF14]' : 'border-emerald-500'}`}></div>
        </div>
      </div>
    );
  }

  return (
    <div className={`p-6 rounded-lg border ${
      isDarkMode ? 'bg-black border-[#39FF14]' : 'bg-[#F5F3F0] border-[#39FF14]'
    }`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
          PEPU Pool Data
        </h3>
        <a 
          href="https://www.geckoterminal.com/pepe-unchained/pools/0xb1ff9a6a353e7ada85a6a100b7992fde9de566f3"
          target="_blank"
          rel="noopener noreferrer"
          className={`flex items-center gap-1 text-sm ${isDarkMode ? 'text-[#39FF14] hover:text-[#39FF14]/80' : 'text-emerald-600 hover:text-emerald-700'}`}
        >
          View Pool
          <ExternalLink size={14} />
        </a>
      </div>

      {poolData ? (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className={`text-sm ${isDarkMode ? 'text-white/70' : 'text-gray-600'}`}>Price</p>
            <p className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              ${poolData.attributes.price_usd ? parseFloat(poolData.attributes.price_usd).toFixed(6) : 'N/A'}
            </p>
          </div>
          <div>
            <p className={`text-sm ${isDarkMode ? 'text-white/70' : 'text-gray-600'}`}>Market Cap</p>
            <p className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              ${poolData.attributes.fdv_usd ? (parseFloat(poolData.attributes.fdv_usd) / 1000000).toFixed(2) + 'M' : 'N/A'}
            </p>
          </div>
          <div>
            <p className={`text-sm ${isDarkMode ? 'text-white/70' : 'text-gray-600'}`}>24h Volume</p>
            <p className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              ${poolData.attributes.volume_usd ? (parseFloat(poolData.attributes.volume_usd) / 1000000).toFixed(2) + 'M' : 'N/A'}
            </p>
          </div>
          <div>
            <p className={`text-sm ${isDarkMode ? 'text-white/70' : 'text-gray-600'}`}>24h Change</p>
            <p className={`text-lg font-semibold ${
              poolData.attributes.price_change_percentage?.h24 >= 0 ? (isDarkMode ? 'text-[#39FF14]' : 'text-emerald-600') : 'text-red-500'
            }`}>
              {poolData.attributes.price_change_percentage?.h24 ? 
                `${poolData.attributes.price_change_percentage.h24 >= 0 ? '+' : ''}${poolData.attributes.price_change_percentage.h24.toFixed(2)}%` : 
                'N/A'
              }
            </p>
          </div>
        </div>
      ) : (
        <p className={`text-sm ${isDarkMode ? 'text-white/70' : 'text-gray-600'}`}>
          Failed to load pool data
        </p>
      )}
    </div>
  );
}

// Types for contract data
interface GlobalStats {
  totalMarkets: bigint;
  totalVolume: bigint;
  totalStakes: bigint;
  totalSupports: bigint;
  totalUsers: bigint;
  totalRevenue: bigint;
}

// Real Contract Data Component
function ContractAnalytics({ isDarkMode }: { isDarkMode: boolean }) {
  const analyticsAddress = process.env.NEXT_PUBLIC_P2P_ANALYTICS_ADDRESS as `0x${string}`;
  const marketManagerAddress = process.env.NEXT_PUBLIC_P2P_MARKET_MANAGER_ADDRESS as `0x${string}`;

  // Global Stats
  const { data: globalStats } = useReadContract({
    address: analyticsAddress,
    abi: ANALYTICS_ABI,
    functionName: 'getGlobalStats',
    query: {
      enabled: !!analyticsAddress
    }
  }) as { data: GlobalStats | undefined };

  // Top Markets by Volume
  const { data: topMarketsData } = useReadContract({
    address: analyticsAddress,
    abi: ANALYTICS_ABI,
    functionName: 'getActiveMarketsByVolume',
    args: [BigInt(10)],
    query: {
      enabled: !!analyticsAddress
    }
  }) as { data: [bigint[], bigint[]] | undefined };

  // Top Stakers
  const { data: topStakersData } = useReadContract({
    address: analyticsAddress,
    abi: ANALYTICS_ABI,
    functionName: 'getTopStakers',
    args: [BigInt(10)],
    query: {
      enabled: !!analyticsAddress
    }
  }) as { data: [string[], bigint[]] | undefined };

  // Today's Markets
  const { data: todayMarketsData } = useReadContract({
    address: analyticsAddress,
    abi: ANALYTICS_ABI,
    functionName: 'getTodayActiveMarkets',
    args: [BigInt(10)],
    query: {
      enabled: !!analyticsAddress
    }
  }) as { data: [bigint[], bigint[]] | undefined };

  // This Week's Markets
  const { data: weekMarketsData } = useReadContract({
    address: analyticsAddress,
    abi: ANALYTICS_ABI,
    functionName: 'getThisWeekActiveMarkets',
    args: [BigInt(10)],
    query: {
      enabled: !!analyticsAddress
    }
  }) as { data: [bigint[], bigint[]] | undefined };

  // Market Count
  const { data: nextMarketId } = useReadContract({
    address: marketManagerAddress,
    abi: MARKET_MANAGER_ABI,
    functionName: 'getNextMarketId',
    query: {
      enabled: !!marketManagerAddress
    }
  }) as { data: bigint | undefined };

  const formatEther = (value: bigint) => {
    return (Number(value) / 1e18).toFixed(4);
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  return (
    <div className="space-y-6">
      {/* Global Stats */}
      <div className={`p-6 rounded-lg border ${
        isDarkMode ? 'bg-black border-[#39FF14]' : 'bg-[#F5F3F0] border-[#39FF14]'
      }`}>
        <h3 className={`text-lg font-semibold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
          Platform Statistics
        </h3>
        
        {globalStats ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className={`p-4 rounded-lg ${isDarkMode ? 'bg-black' : 'bg-[#F5F3F0]'}`}>
              <p className={`text-sm ${isDarkMode ? 'text-white/70' : 'text-gray-600'}`}>Total Markets</p>
              <p className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                {nextMarketId ? (Number(nextMarketId) - 1).toString() : '0'}
              </p>
            </div>
            <div className={`p-4 rounded-lg ${isDarkMode ? 'bg-black' : 'bg-[#F5F3F0]'}`}>
              <p className={`text-sm ${isDarkMode ? 'text-white/70' : 'text-gray-600'}`}>Total Volume</p>
              <p className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                {formatEther(globalStats.totalVolume)} PEPU
              </p>
            </div>
            <div className={`p-4 rounded-lg ${isDarkMode ? 'bg-black' : 'bg-[#F5F3F0]'}`}>
              <p className={`text-sm ${isDarkMode ? 'text-white/70' : 'text-gray-600'}`}>Total Stakes</p>
              <p className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                {globalStats.totalStakes.toString()}
              </p>
            </div>
            <div className={`p-4 rounded-lg ${isDarkMode ? 'bg-black' : 'bg-[#F5F3F0]'}`}>
              <p className={`text-sm ${isDarkMode ? 'text-white/70' : 'text-gray-600'}`}>Total Users</p>
              <p className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                {globalStats.totalUsers.toString()}
              </p>
            </div>
            <div className={`p-4 rounded-lg ${isDarkMode ? 'bg-black' : 'bg-[#F5F3F0]'}`}>
              <p className={`text-sm ${isDarkMode ? 'text-white/70' : 'text-gray-600'}`}>Total Revenue</p>
              <p className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                {formatEther(globalStats.totalRevenue)} PEPU
              </p>
            </div>
            <div className={`p-4 rounded-lg ${isDarkMode ? 'bg-black' : 'bg-[#F5F3F0]'}`}>
              <p className={`text-sm ${isDarkMode ? 'text-white/70' : 'text-gray-600'}`}>Total Supports</p>
              <p className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                {globalStats.totalSupports.toString()}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-32">
            <div className={`animate-spin rounded-full h-6 w-6 border-b-2 ${isDarkMode ? 'border-[#39FF14]' : 'border-emerald-500'}`}></div>
          </div>
        )}
      </div>

      {/* Top Markets by Volume */}
      {topMarketsData && topMarketsData[0] && topMarketsData[0].length > 0 && (
        <div className={`p-6 rounded-lg border ${
          isDarkMode ? 'bg-black border-gray-800' : 'bg-[#F5F3F0] border-gray-300'
        }`}>
          <h3 className={`text-lg font-semibold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            Top Markets by Volume
          </h3>
          
          <div className="space-y-3">
            {topMarketsData[0].slice(0, 5).map((marketId: bigint, index: number) => (
              <div key={index} className={`p-3 rounded-lg ${
                isDarkMode ? 'bg-black' : 'bg-[#F5F3F0]'
              }`}>
                <div className="flex items-center justify-between">
                  <span className={`font-mono text-sm ${isDarkMode ? 'text-white' : 'text-gray-700'}`}>
                    Market #{marketId.toString()}
                  </span>
                  <span className={`text-sm font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    {formatEther(topMarketsData[1][index])} PEPU
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top Stakers */}
      {topStakersData && topStakersData[0] && topStakersData[0].length > 0 && (
        <div className={`p-6 rounded-lg border ${
          isDarkMode ? 'bg-black border-gray-800' : 'bg-[#F5F3F0] border-gray-300'
        }`}>
          <h3 className={`text-lg font-semibold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            Top Stakers
          </h3>
          
          <div className="space-y-3">
            {topStakersData[0].slice(0, 5).map((staker: string, index: number) => (
              <div key={index} className={`p-3 rounded-lg ${
                isDarkMode ? 'bg-black' : 'bg-[#F5F3F0]'
              }`}>
                <div className="flex items-center justify-between">
                  <span className={`font-mono text-sm ${isDarkMode ? 'text-white' : 'text-gray-700'}`}>
                    {formatAddress(staker)}
                  </span>
                  <span className={`text-sm font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    {formatEther(topStakersData[1][index])} PEPU
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Today's Activity */}
      {todayMarketsData && todayMarketsData[0] && todayMarketsData[0].length > 0 && (
        <div className={`p-6 rounded-lg border ${
          isDarkMode ? 'bg-black border-gray-800' : 'bg-[#F5F3F0] border-gray-300'
        }`}>
          <h3 className={`text-lg font-semibold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            Today's Markets ({todayMarketsData[0].length})
          </h3>
          
          <div className="space-y-2">
            {todayMarketsData[0].slice(0, 3).map((marketId: bigint, index: number) => (
              <div key={index} className={`p-2 rounded ${
                isDarkMode ? 'bg-black' : 'bg-[#F5F3F0]'
              }`}>
                <div className="flex items-center justify-between">
                  <span className={`font-mono text-xs ${isDarkMode ? 'text-white' : 'text-gray-700'}`}>
                    Market #{marketId.toString()}
                  </span>
                  <span className={`text-xs ${isDarkMode ? 'text-white/70' : 'text-gray-600'}`}>
                    {formatEther(todayMarketsData[1][index])} PEPU
                  </span>
                </div>
              </div>
            ))}
            {todayMarketsData[0].length > 3 && (
              <p className={`text-xs ${isDarkMode ? 'text-white/70' : 'text-gray-600'}`}>
                +{todayMarketsData[0].length - 3} more markets today
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Main Analytics Page Component
export default function AnalyticsPage() {
  const { isDarkMode, toggleTheme } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const { address, isConnected } = useAccount();

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
        <header className={`sticky top-0 z-30 border-b ${
          isDarkMode ? 'bg-black border-[#39FF14]/20' : 'bg-[#F5F3F0] border-gray-200'
        }`}>
          <div className="px-4 sm:px-6 py-1.5 lg:py-2">
            <div className="flex items-center justify-between">
              {/* Left side - Mobile menu and logo */}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setSidebarOpen(true)}
                  className={`lg:hidden p-2 rounded-lg transition-colors ${
                    isDarkMode ? 'hover:bg-[#39FF14]/10 text-white' : 'hover:bg-gray-200 text-gray-700'
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
                <h1 className={`text-xl sm:text-2xl font-bold hidden lg:block ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Analytics</h1>
              </div>

              {/* Right side controls */}
              <div className="flex items-center gap-2 sm:gap-3">
                {/* Theme Toggle */}
                <button
                  onClick={toggleTheme}
                  className={`p-1.5 lg:p-2 rounded-lg transition-colors ${
                    isDarkMode ? 'hover:bg-[#39FF14]/10 text-white' : 'hover:bg-gray-200 text-gray-700'
                  }`}
                >
                  {isDarkMode ? <Sun size={20} className="text-white" /> : <Moon size={20} className="text-gray-600" />}
                </button>

                {/* Wallet Connection */}
                <HeaderWallet isDarkMode={isDarkMode} />
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="p-4 lg:p-6">
          <div className="max-w-7xl mx-auto">
            {/* Header */}
            <div className="mb-8">
              <div className="flex items-center gap-3 mb-2">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  isDarkMode ? 'bg-[#39FF14]/20' : 'bg-emerald-50'
                }`}>
                  <BarChart3 className={`w-5 h-5 ${isDarkMode ? 'text-[#39FF14]' : 'text-emerald-500'}`} />
                </div>
                <div>
                  <h1 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    Analytics Dashboard
                  </h1>
                  <p className={`text-sm ${isDarkMode ? 'text-white/70' : 'text-gray-600'}`}>
                    Real platform data and PEPU pool information
                  </p>
                </div>
              </div>
            </div>

            {/* PEPU Pool Data */}
            <div className="mb-8">
              <PEPUPoolData isDarkMode={isDarkMode} />
            </div>

            {/* Contract Analytics */}
            <ContractAnalytics isDarkMode={isDarkMode} />
          </div>
        </div>
      </div>
    </div>
  );
}