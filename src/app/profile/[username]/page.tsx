"use client";

import React, { useState, useEffect } from 'react';
import { useParams, useRouter, notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { 
  User, 
  Edit3,
  TrendingUp,
  Trophy,
  Target,
  DollarSign,
  Users,
  BarChart3,
  Menu,
  Sun,
  Moon,
  Wallet,
  Loader2,
  AlertCircle,
  ArrowLeft
} from 'lucide-react';
import { Sidebar } from '../../components/Sidebar';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, useReadContract } from 'wagmi';
import { useTheme } from '../../context/ThemeContext';
import { formatEther } from 'viem';
import { UserProfile, UserAnalytics, UserMarketData } from '@/types/profile';
import { getUserMarketsFromSupabase, getUserMarketsByCreator } from '@/lib/profile';
import { SeedAvatar } from '@/components/SeedAvatar';

// Client-only wrapper to prevent hydration issues
function ClientOnly({ children }: { children: React.ReactNode }) {
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  if (!hasMounted) {
    return null;
  }

  return <>{children}</>;
}

// Analytics contract ABI (simplified)
const ANALYTICS_ABI = [
  {
    "inputs": [{"name": "user", "type": "address"}],
    "name": "getUserStats",
    "outputs": [
      {"name": "totalStakesPlaced", "type": "uint256"},
      {"name": "totalStakesWon", "type": "uint256"},
      {"name": "totalStakesLost", "type": "uint256"},
      {"name": "totalWinnings", "type": "uint256"},
      {"name": "totalLosses", "type": "uint256"},
      {"name": "totalSupportDonated", "type": "uint256"},
      {"name": "marketsCreated", "type": "uint256"},
      {"name": "marketsWon", "type": "uint256"},
      {"name": "marketsLost", "type": "uint256"},
      {"name": "favoriteOption", "type": "uint256"},
      {"name": "lastActivity", "type": "uint256"}
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"name": "user", "type": "address"}],
    "name": "getUserMarkets",
    "outputs": [{"name": "", "type": "uint256[]"}],
    "stateMutability": "view",
    "type": "function"
  }
];

// Market Manager ABI
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
  }
];

// Market Card Component for Profile Page
function ProfileMarketCard({ marketId, marketData, isDarkMode }: { 
  marketId: string; 
  marketData: UserMarketData;
  isDarkMode: boolean;
}) {
  const MARKET_MANAGER_ADDRESS = (process.env.NEXT_PUBLIC_P2P_MARKET_MANAGER_ADDRESS || process.env.NEXT_PUBLIC_P2P_MARKETMANAGER_ADDRESS) as `0x${string}`;
  const marketIdNum = parseInt(marketId);
  const [marketMetadata, setMarketMetadata] = useState<any>(null);
  const [loadingMetadata, setLoadingMetadata] = useState(false);

  // Fetch market details from contract
  const { data: market } = useReadContract({
    address: MARKET_MANAGER_ADDRESS,
    abi: MARKET_MANAGER_ABI,
    functionName: 'getMarket',
    args: marketIdNum ? [BigInt(marketIdNum)] : undefined,
    query: {
      enabled: !!marketIdNum && !!MARKET_MANAGER_ADDRESS,
      refetchInterval: 10000,
    }
  }) as { data: any | undefined };

  const { data: totalPool } = useReadContract({
    address: MARKET_MANAGER_ADDRESS,
    abi: MARKET_MANAGER_ABI,
    functionName: 'getTotalPool',
    args: marketIdNum && market?.paymentToken ? [BigInt(marketIdNum), market.paymentToken] : undefined,
    query: {
      enabled: !!marketIdNum && !!market?.paymentToken && !!MARKET_MANAGER_ADDRESS,
      refetchInterval: 10000,
    }
  }) as { data: bigint | undefined };

  const { data: stakerCount } = useReadContract({
    address: MARKET_MANAGER_ADDRESS,
    abi: MARKET_MANAGER_ABI,
    functionName: 'getStakerCount',
    args: marketIdNum ? [BigInt(marketIdNum)] : undefined,
    query: {
      enabled: !!marketIdNum && !!MARKET_MANAGER_ADDRESS,
      refetchInterval: 10000,
    }
  }) as { data: bigint | undefined };

  const { data: option1Pool } = useReadContract({
    address: MARKET_MANAGER_ADDRESS,
    abi: MARKET_MANAGER_ABI,
    functionName: 'getOptionPool',
    args: marketIdNum && market?.paymentToken ? [BigInt(marketIdNum), BigInt(1), market.paymentToken] : undefined,
    query: {
      enabled: !!marketIdNum && !!market?.paymentToken && !!MARKET_MANAGER_ADDRESS,
      refetchInterval: 10000,
    }
  }) as { data: bigint | undefined };

  const { data: option2Pool } = useReadContract({
    address: MARKET_MANAGER_ADDRESS,
    abi: MARKET_MANAGER_ABI,
    functionName: 'getOptionPool',
    args: marketIdNum && market?.paymentToken ? [BigInt(marketIdNum), BigInt(2), market.paymentToken] : undefined,
    query: {
      enabled: !!marketIdNum && !!market?.paymentToken && !!MARKET_MANAGER_ADDRESS,
      refetchInterval: 10000,
    }
  }) as { data: bigint | undefined };

  const marketState = market ? Number(market.state) : marketData.state;
  const isERC20Market = market?.paymentToken && market.paymentToken !== '0x0000000000000000000000000000000000000000';

  // Fetch IPFS metadata
  useEffect(() => {
    if (market && !marketMetadata && !loadingMetadata) {
      setLoadingMetadata(true);
      const fetchMetadata = async () => {
        try {
          const ipfsHash = (market as any).ipfsHash;
          if (ipfsHash) {
            const { fetchIPFSData } = await import('@/lib/ipfs');
            const metadata = await fetchIPFSData(ipfsHash);
            if (metadata) {
              setMarketMetadata(metadata);
            }
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

  const getMarketTitle = () => {
    if (loadingMetadata) return 'Loading...';
    if (marketMetadata?.title) return marketMetadata.title;
    return marketData.title || `Market #${marketId}`;
  };

  const getMarketDescription = () => {
    if (loadingMetadata) return null;
    if (marketMetadata?.description) return marketMetadata.description;
    return marketData.description || null;
  };

  const getMarketImage = () => {
    if (loadingMetadata) return null;
    if (marketMetadata?.imageUrl) return marketMetadata.imageUrl;
    return marketData.image || null;
  };

  return (
    <div
      className={`block py-4 sm:py-5 border-b last:border-b-0 transition-colors ${
        isDarkMode ? 'border-white/10' : 'border-gray-300'
      }`}
    >
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        {getMarketImage() && (
          <img 
            src={getMarketImage()!} 
            alt="Market" 
            className={`w-full sm:w-20 sm:h-20 h-40 sm:h-20 rounded-lg object-cover flex-shrink-0 ${
              isDarkMode ? 'ring-1 ring-white/10' : 'ring-1 ring-gray-200'
            }`}
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
        )}
        <div className="flex-1 min-w-0 w-full sm:w-auto">
          <div className="flex items-start justify-between gap-2 mb-1.5">
            <Link 
              href={`/market/${marketId}`}
              className={`font-semibold text-sm sm:text-base hover:underline ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
            >
              {getMarketTitle()}
            </Link>
            <span className={`text-xs font-medium px-2 py-0.5 rounded flex-shrink-0 ${
              marketState === 0 
                ? isDarkMode ? 'bg-yellow-900/30 text-yellow-400' : 'bg-yellow-100 text-yellow-700'
                : marketState === 1
                ? isDarkMode ? 'bg-green-900/30 text-green-400' : 'bg-green-100 text-green-700'
                : isDarkMode ? 'bg-blue-900/30 text-blue-400' : 'bg-blue-100 text-blue-700'
            }`}>
              {marketState === 0 ? 'Active' : marketState === 1 ? 'Ended' : 'Resolved'}
            </span>
          </div>
          {getMarketDescription() && (
            <p className={`text-xs sm:text-sm mb-2 line-clamp-2 ${isDarkMode ? 'text-white/70' : 'text-gray-600'}`}>
              {getMarketDescription()}
            </p>
          )}
          <div className={`flex flex-wrap items-center gap-2 sm:gap-3 text-xs ${isDarkMode ? 'text-white/60' : 'text-gray-500'}`}>
            <span className={`px-2 py-0.5 rounded ${isDarkMode ? 'bg-gray-800' : 'bg-gray-100'}`}>
              {marketData.type}
            </span>
            {totalPool !== undefined && (
              <span className={isDarkMode ? 'text-white/70' : 'text-gray-600'}>
                Volume: {Number(formatEther(totalPool)).toFixed(2)} {isERC20Market ? 'Tokens' : 'PEPU'}
              </span>
            )}
            {stakerCount !== undefined && (
              <span className={isDarkMode ? 'text-white/70' : 'text-gray-600'}>
                Stakers: {Number(stakerCount)}
              </span>
            )}
            {option1Pool !== undefined && option2Pool !== undefined && (
              <span className={isDarkMode ? 'text-white/70' : 'text-gray-600'}>
                Pools: {Number(formatEther(option1Pool)).toFixed(2)} / {Number(formatEther(option2Pool)).toFixed(2)}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ProfileViewPage() {
  const { isDarkMode, toggleTheme } = useTheme();
  const params = useParams();
  const router = useRouter();
  const username = params?.username as string;
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { address, isConnected } = useAccount();

  // Profile state
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Analytics state
  const [analytics, setAnalytics] = useState<UserAnalytics | null>(null);
  const [userMarkets, setUserMarkets] = useState<UserMarketData[]>([]);

  // Contract addresses
  const ANALYTICS_CONTRACT = process.env.NEXT_PUBLIC_ANALYTICS_CONTRACT_ADDRESS as `0x${string}`;

  // Check if viewing own profile
  const isOwnProfile = profile && address && profile.address?.toLowerCase() === address.toLowerCase();

  // Sidebar handlers
  const onSidebarClose = () => setSidebarOpen(false);
  const onToggleCollapse = () => setSidebarCollapsed(!sidebarCollapsed);
  const onMenuClick = () => setSidebarOpen(true);

  // Read analytics data from contract
  const { data: userStats } = useReadContract({
    address: ANALYTICS_CONTRACT,
    abi: ANALYTICS_ABI,
    functionName: 'getUserStats',
    args: profile?.address ? [profile.address as `0x${string}`] : undefined,
    query: {
      enabled: !!profile?.address && !!ANALYTICS_CONTRACT
    }
  });

  // Load profile data
  useEffect(() => {
    if (!username || typeof username !== 'string' || !username.trim()) {
      notFound();
      return;
    }
    loadProfile();
  }, [username]);

  // Update analytics when contract data changes
  useEffect(() => {
    if (userStats) {
      setAnalytics(userStats as UserAnalytics);
    }
  }, [userStats]);

  // Load user markets by creator address
  useEffect(() => {
    if (profile?.address) {
      loadUserMarkets();
    }
  }, [profile?.address]);

  const loadUserMarkets = async () => {
    if (!profile?.address) return;
    try {
      const markets = await getUserMarketsByCreator(profile.address);
      setUserMarkets(markets);
    } catch (error) {
      console.error('Error loading user markets:', error);
    }
  };

  const loadProfile = async () => {
    if (!username) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/profile/${username}`);
      const data = await response.json();

      if (response.ok) {
        setProfile(data.profile);
      } else if (response.status === 404) {
        notFound();
      } else {
        setError(data.error || 'Profile not found');
      }
    } catch (err) {
      setError('Failed to load profile');
      console.error('Profile load error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const calculateWinRate = () => {
    if (!analytics || analytics.totalStakesPlaced === BigInt(0)) return 0;
    return Number((analytics.totalStakesWon * BigInt(100)) / analytics.totalStakesPlaced);
  };

  return (
    <ClientOnly>
      <div className={`min-h-screen ${isDarkMode ? 'bg-black text-white' : 'bg-[#F5F3F0] text-gray-900'}`}>
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
          <header className={`sticky top-0 z-30 border-b backdrop-blur-sm ${
            isDarkMode ? 'bg-black border-[#39FF14]/20' : 'bg-[#F5F3F0] border-gray-200'
          }`}>
            <div className="px-4 py-3">
              <div className="flex items-center justify-between">
                {/* Left: Menu + Title */}
                <div className="flex items-center gap-3">
                  <button
                    onClick={onMenuClick}
                    className={`lg:hidden p-2 rounded-lg transition-colors ${
                      isDarkMode ? 'hover:bg-gray-800' : 'hover:bg-gray-100'
                    }`}
                  >
                    <Menu size={20} />
                  </button>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => router.back()}
                      className={`p-2 rounded-lg transition-colors ${
                        isDarkMode ? 'hover:bg-gray-800' : 'hover:bg-gray-100'
                      }`}
                    >
                      <ArrowLeft size={20} />
                    </button>
                    <div className="flex flex-col">
                      <h1 className="text-sm lg:text-xl font-semibold">Profile</h1>
                    </div>
                  </div>
                </div>

                {/* Right: Theme + Connect */}
                <div className="flex items-center gap-3">
                  <button
                    onClick={toggleTheme}
                    className={`p-2 rounded-lg transition-colors ${
                      isDarkMode ? 'hover:bg-gray-800' : 'hover:bg-gray-100'
                    }`}
                  >
                    {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
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

          {/* Content */}
          <div className="p-3 sm:p-4 lg:p-6">
            <div className="max-w-4xl mx-auto">
              {/* Error Message */}
              {error && (
                <div className={`mb-6 p-4 rounded-lg flex items-center gap-2 ${
                  isDarkMode ? 'bg-red-900/40 border border-red-700' : 'bg-red-50 border border-red-200'
                }`}>
                  <AlertCircle className={`h-5 w-5 ${isDarkMode ? 'text-red-300' : 'text-red-500'}`} />
                  <span className={isDarkMode ? 'text-red-300' : 'text-red-700'}>{error}</span>
                </div>
              )}

              {isLoading ? (
                <div className="text-center py-12">
                  <Loader2 className={`h-8 w-8 animate-spin mx-auto mb-4 ${isDarkMode ? 'text-white' : 'text-gray-600'}`} />
                  <p className={isDarkMode ? 'text-white' : 'text-gray-900'}>Loading profile...</p>
                </div>
              ) : profile ? (
                <div className="space-y-0">
                  {/* Profile header — flush to page background */}
                  <div className="pb-6 sm:pb-8">
                    <div className="flex flex-col sm:flex-row items-start gap-4 sm:gap-6">
                      {/* Profile Image */}
                      <div className="relative mx-auto sm:mx-0 shrink-0">
                        <div className={`w-24 h-24 rounded-full overflow-hidden border ${isDarkMode ? 'bg-black border-[#39FF14]' : 'bg-[#F5F3F0] border-[#39FF14]'}`}>
                          {profile?.image ? (
                            <img 
                              src={profile.image} 
                              alt="Profile" 
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <SeedAvatar
                              seed={profile?.display_name || profile?.username || profile?.address || 'user'}
                              isDarkMode={isDarkMode}
                              className="w-full h-full"
                            />
                          )}
                        </div>
                      </div>

                      {/* Profile Info */}
                      <div className="flex-1 w-full text-center sm:text-left">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                          <div>
                            <h1 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                              {profile?.display_name || 'Anonymous User'}
                            </h1>
                            <p className={isDarkMode ? 'text-white/70' : 'text-gray-600'}>
                              @{profile?.username || 'no-username'}
                            </p>
                            <p className={`text-sm ${isDarkMode ? 'text-white/60' : 'text-gray-500'}`}>
                              {formatAddress(profile?.address || '')}
                            </p>
                          </div>
                          
                          {isOwnProfile && (
                            <Link
                              href="/profile"
                              className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
                                isDarkMode 
                                  ? 'bg-[#39FF14] text-black hover:bg-[#39FF14]/80' 
                                  : 'bg-[#39FF14] text-black border border-black hover:bg-[#39FF14]/80'
                              }`}
                            >
                              <Edit3 className="h-4 w-4" />
                              Edit Profile
                            </Link>
                          )}
                        </div>

                        {profile?.bio && (
                          <p className={`mb-4 ${isDarkMode ? 'text-white/80' : 'text-gray-700'}`}>
                            {profile.bio}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Analytics Section */}
                  {analytics && (
                    <div className={`py-6 sm:py-8 border-t ${isDarkMode ? 'border-white/10' : 'border-gray-300'}`}>
                      <h2 className={`text-lg sm:text-xl font-bold mb-4 sm:mb-6 flex items-center gap-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                        <BarChart3 className={`h-5 w-5 ${isDarkMode ? 'text-[#39FF14]' : 'text-gray-900'}`} />
                        Trading Analytics
                      </h2>
                      
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 lg:gap-8">
                        <div className="text-center py-1">
                          <Trophy className={`h-5 w-5 sm:h-6 sm:w-6 lg:h-8 lg:w-8 mx-auto mb-1.5 sm:mb-2 ${isDarkMode ? 'text-[#39FF14]' : 'text-yellow-500'}`} />
                          <div className={`text-lg sm:text-xl lg:text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                            {calculateWinRate()}%
                          </div>
                          <div className={`text-xs ${isDarkMode ? 'text-white/60' : 'text-gray-600'}`}>
                            Win Rate
                          </div>
                        </div>
                        
                        <div className="text-center py-1">
                          <Target className={`h-5 w-5 sm:h-6 sm:w-6 lg:h-8 lg:w-8 mx-auto mb-1.5 sm:mb-2 ${isDarkMode ? 'text-[#39FF14]' : 'text-blue-500'}`} />
                          <div className={`text-lg sm:text-xl lg:text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                            {analytics.totalStakesPlaced.toString()}
                          </div>
                          <div className={`text-xs ${isDarkMode ? 'text-white/60' : 'text-gray-600'}`}>
                            Total Stakes
                          </div>
                        </div>
                        
                        <div className="text-center py-1">
                          <DollarSign className={`h-5 w-5 sm:h-6 sm:w-6 lg:h-8 lg:w-8 mx-auto mb-1.5 sm:mb-2 ${isDarkMode ? 'text-[#39FF14]' : 'text-green-500'}`} />
                          <div className={`text-sm sm:text-lg lg:text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                            {formatEther(analytics.totalWinnings)} ETH
                          </div>
                          <div className={`text-xs ${isDarkMode ? 'text-white/60' : 'text-gray-600'}`}>
                            Total Winnings
                          </div>
                        </div>
                        
                        <div className="text-center py-1">
                          <Users className={`h-5 w-5 sm:h-6 sm:w-6 lg:h-8 lg:w-8 mx-auto mb-1.5 sm:mb-2 ${isDarkMode ? 'text-[#39FF14]' : 'text-purple-500'}`} />
                          <div className={`text-lg sm:text-xl lg:text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                            {analytics.marketsCreated.toString()}
                          </div>
                          <div className={`text-xs ${isDarkMode ? 'text-white/60' : 'text-gray-600'}`}>
                            Markets Created
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* User markets — flush to background */}
                  <div className={`py-6 sm:py-8 border-t ${isDarkMode ? 'border-white/10' : 'border-gray-300'}`}>
                    <h2 className={`text-lg sm:text-xl font-bold mb-4 sm:mb-6 flex items-center gap-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                      <TrendingUp className={`h-4 w-4 sm:h-5 sm:w-5 ${isDarkMode ? 'text-[#39FF14]' : 'text-gray-900'}`} />
                      Markets
                    </h2>
                    
                    {userMarkets.length === 0 ? (
                      <div className="text-center py-6 sm:py-8">
                        <Target className={`h-10 w-10 sm:h-12 sm:w-12 mx-auto mb-3 sm:mb-4 ${isDarkMode ? 'text-white/60' : 'text-gray-400'}`} />
                        <p className={`text-sm sm:text-base ${isDarkMode ? 'text-white/70' : 'text-gray-600'}`}>
                          This user hasn't created any markets yet.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2 sm:space-y-3">
                        {userMarkets.map((market) => (
                          <ProfileMarketCard
                            key={market.marketId}
                            marketId={market.marketId}
                            marketData={market}
                            isDarkMode={isDarkMode}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </ClientOnly>
  );
}

