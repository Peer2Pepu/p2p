"use client";

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
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
import { getUserMarketsFromSupabase } from '@/lib/profile';

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

  const { data: userMarketIds } = useReadContract({
    address: ANALYTICS_CONTRACT,
    abi: ANALYTICS_ABI,
    functionName: 'getUserMarkets',
    args: profile?.address ? [profile.address as `0x${string}`] : undefined,
    query: {
      enabled: !!profile?.address && !!ANALYTICS_CONTRACT
    }
  });

  // Load profile data
  useEffect(() => {
    if (username) {
      loadProfile();
    }
  }, [username]);

  // Update analytics when contract data changes
  useEffect(() => {
    if (userStats) {
      setAnalytics(userStats as UserAnalytics);
    }
  }, [userStats]);

  // Load user markets when market IDs are available
  useEffect(() => {
    if (userMarketIds && Array.isArray(userMarketIds)) {
      loadUserMarkets(userMarketIds.map(id => id.toString()));
    }
  }, [userMarketIds]);

  const loadUserMarkets = async (marketIds: string[]) => {
    try {
      const markets = await getUserMarketsFromSupabase(marketIds);
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
          <div className="p-6">
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
                <div className="space-y-6">
                  {/* Profile Header */}
                  <div className={`p-6 rounded-lg border ${isDarkMode ? 'bg-black border-[#39FF14]' : 'bg-[#F5F3F0] border-[#39FF14]'} shadow-sm`}>
                    <div className="flex items-start gap-6">
                      {/* Profile Image */}
                      <div className="relative">
                        <div className={`w-24 h-24 rounded-full overflow-hidden border ${isDarkMode ? 'bg-black border-[#39FF14]' : 'bg-[#F5F3F0] border-[#39FF14]'}`}>
                          {profile?.image ? (
                            <img 
                              src={profile.image} 
                              alt="Profile" 
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <User className={`h-8 w-8 ${isDarkMode ? 'text-white/60' : 'text-gray-400'}`} />
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Profile Info */}
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-4">
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
                    <div className={`p-6 rounded-lg border ${isDarkMode ? 'bg-black border-[#39FF14]' : 'bg-[#F5F3F0] border-[#39FF14]'} shadow-sm`}>
                      <h2 className={`text-xl font-bold mb-6 flex items-center gap-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                        <BarChart3 className={`h-5 w-5 ${isDarkMode ? 'text-[#39FF14]' : 'text-gray-900'}`} />
                        Trading Analytics
                      </h2>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className={`text-center p-4 rounded-lg border ${isDarkMode ? 'bg-black border-[#39FF14]' : 'bg-[#F5F3F0] border-[#39FF14]'}`}>
                          <Trophy className={`h-8 w-8 mx-auto mb-2 ${isDarkMode ? 'text-[#39FF14]' : 'text-yellow-500'}`} />
                          <div className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                            {calculateWinRate()}%
                          </div>
                          <div className={`text-sm ${isDarkMode ? 'text-white/60' : 'text-gray-600'}`}>
                            Win Rate
                          </div>
                        </div>
                        
                        <div className={`text-center p-4 rounded-lg border ${isDarkMode ? 'bg-black border-[#39FF14]' : 'bg-[#F5F3F0] border-[#39FF14]'}`}>
                          <Target className={`h-8 w-8 mx-auto mb-2 ${isDarkMode ? 'text-[#39FF14]' : 'text-blue-500'}`} />
                          <div className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                            {analytics.totalStakesPlaced.toString()}
                          </div>
                          <div className={`text-sm ${isDarkMode ? 'text-white/60' : 'text-gray-600'}`}>
                            Total Stakes
                          </div>
                        </div>
                        
                        <div className={`text-center p-4 rounded-lg border ${isDarkMode ? 'bg-black border-[#39FF14]' : 'bg-[#F5F3F0] border-[#39FF14]'}`}>
                          <DollarSign className={`h-8 w-8 mx-auto mb-2 ${isDarkMode ? 'text-[#39FF14]' : 'text-green-500'}`} />
                          <div className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                            {formatEther(analytics.totalWinnings)} ETH
                          </div>
                          <div className={`text-sm ${isDarkMode ? 'text-white/60' : 'text-gray-600'}`}>
                            Total Winnings
                          </div>
                        </div>
                        
                        <div className={`text-center p-4 rounded-lg border ${isDarkMode ? 'bg-black border-[#39FF14]' : 'bg-[#F5F3F0] border-[#39FF14]'}`}>
                          <Users className={`h-8 w-8 mx-auto mb-2 ${isDarkMode ? 'text-[#39FF14]' : 'text-purple-500'}`} />
                          <div className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                            {analytics.marketsCreated.toString()}
                          </div>
                          <div className={`text-sm ${isDarkMode ? 'text-white/60' : 'text-gray-600'}`}>
                            Markets Created
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* User Markets Section */}
                  <div className={`p-6 rounded-lg border ${isDarkMode ? 'bg-black border-[#39FF14]' : 'bg-[#F5F3F0] border-[#39FF14]'} shadow-sm`}>
                    <h2 className={`text-xl font-bold mb-6 flex items-center gap-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                      <TrendingUp className={`h-5 w-5 ${isDarkMode ? 'text-[#39FF14]' : 'text-gray-900'}`} />
                      Markets
                    </h2>
                    
                    {userMarkets.length === 0 ? (
                      <div className="text-center py-8">
                        <Target className={`h-12 w-12 mx-auto mb-4 ${isDarkMode ? 'text-white/60' : 'text-gray-400'}`} />
                        <p className={isDarkMode ? 'text-white/70' : 'text-gray-600'}>
                          This user hasn't created any markets yet.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {userMarkets.map((market) => (
                          <Link
                            key={market.marketId}
                            href={`/market/${market.marketId}`}
                            className={`block p-4 border rounded-lg transition-colors ${
                              isDarkMode ? 'bg-black border-[#39FF14] hover:bg-gray-900' : 'bg-[#F5F3F0] border-[#39FF14] hover:bg-gray-50'
                            }`}
                          >
                            <div className="flex items-center gap-4">
                              <img 
                                src={market.image} 
                                alt="Market" 
                                className={`w-16 h-16 rounded-lg object-cover border ${
                                  isDarkMode ? 'border-[#39FF14]' : 'border-[#39FF14]'
                                }`}
                              />
                              <div className="flex-1">
                                <h3 className={`font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{market.title}</h3>
                                <p className={`text-sm ${isDarkMode ? 'text-white/70' : 'text-gray-600'}`}>
                                  {market.description}
                                </p>
                                <div className={`flex items-center gap-4 mt-2 text-sm ${isDarkMode ? 'text-white/60' : 'text-gray-500'}`}>
                                  <span>Type: {market.type}</span>
                                  <span>State: {market.state}</span>
                                </div>
                              </div>
                            </div>
                          </Link>
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

