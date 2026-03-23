"use client";

import React, { useState, useEffect } from 'react';
import { useParams, useRouter, notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { 
  User, 
  Edit3,
  TrendingUp,
  Target,
  Menu,
  Sun,
  Moon,
  Loader2,
  AlertCircle,
  ArrowLeft
} from 'lucide-react';
import { Sidebar } from '../../components/Sidebar';
import { HeaderWallet } from '@/components/HeaderWallet';
import { useAccount, useReadContract } from 'wagmi';
import { useTheme } from '../../context/ThemeContext';
import { UserProfile, UserAnalytics, UserMarketData } from '@/types/profile';
import { toBigIntSafe } from '@/lib/toBigInt';
import { normalizeUserStatsContract } from '@/lib/normalizeUserStats';
import { getUserMarketsFromSupabase, getUserMarketsByCreator } from '@/lib/profile';
import { SeedAvatar } from '@/components/SeedAvatar';
import { ProfileMarketCard } from '@/components/ProfileMarketCard';
import { ProfileTradingAnalytics } from '@/components/ProfileTradingAnalytics';

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
      {"name": "lastActivity", "type": "uint256"},
      {"name": "totalStakesWonNative", "type": "uint256"},
      {"name": "totalStakesWonP2PToken", "type": "uint256"},
      {"name": "totalWinningsNative", "type": "uint256"},
      {"name": "totalWinningsP2PToken", "type": "uint256"}
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
  const { address } = useAccount();

  // Profile state
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Analytics state
  const [analytics, setAnalytics] = useState<UserAnalytics | null>(null);
  const [userMarkets, setUserMarkets] = useState<UserMarketData[]>([]);

  // MetricsHub / analytics (NEXT_PUBLIC_P2P_ANALYTICS_ADDRESS; legacy NEXT_PUBLIC_ANALYTICS_CONTRACT_ADDRESS as fallback)
  const ANALYTICS_ADDRESS = (process.env.NEXT_PUBLIC_P2P_ANALYTICS_ADDRESS ||
    process.env.NEXT_PUBLIC_ANALYTICS_CONTRACT_ADDRESS) as `0x${string}` | undefined;

  // Check if viewing own profile
  const isOwnProfile = profile && address && profile.address?.toLowerCase() === address.toLowerCase();

  // Sidebar handlers
  const onSidebarClose = () => setSidebarOpen(false);
  const onToggleCollapse = () => setSidebarCollapsed(!sidebarCollapsed);
  const onMenuClick = () => setSidebarOpen(true);

  // Read analytics data from contract
  const { data: userStats } = useReadContract({
    address: ANALYTICS_ADDRESS,
    abi: ANALYTICS_ABI,
    functionName: 'getUserStats',
    args: profile?.address ? [profile.address as `0x${string}`] : undefined,
    query: {
      enabled: !!profile?.address && !!ANALYTICS_ADDRESS
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
    if (userStats == null) {
      setAnalytics(null);
      return;
    }
    setAnalytics(normalizeUserStatsContract(userStats));
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

  const copyProfileAddress = async () => {
    const addr = profile?.address;
    if (!addr) return;
    try {
      await navigator.clipboard.writeText(addr);
      setError(null);
    } catch {
      setError('Could not copy address');
      setTimeout(() => setError(null), 2500);
    }
  };

  const calculateWinRate = () => {
    if (!analytics) return 0;
    const placed = toBigIntSafe(analytics.totalStakesPlaced);
    const won = toBigIntSafe(analytics.totalStakesWon);
    if (placed === BigInt(0)) return 0;
    return Number((won * BigInt(100)) / placed);
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
                  
                  {/* Wallet — display name from profile API (matches home / own profile) */}
                  <HeaderWallet isDarkMode={isDarkMode} />
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
                            <p
                              onClick={copyProfileAddress}
                              title="Click to copy address"
                              className={`text-sm cursor-pointer hover:underline ${isDarkMode ? 'text-white/60 hover:text-white/90' : 'text-gray-500 hover:text-gray-800'}`}
                            >
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
                          <p className={`mb-0 ${isDarkMode ? 'text-white/80' : 'text-gray-700'}`}>
                            {profile.bio}
                          </p>
                        )}

                        {analytics && (
                          <ProfileTradingAnalytics
                            isDarkMode={isDarkMode}
                            analytics={analytics}
                            winRatePercent={calculateWinRate()}
                          />
                        )}
                      </div>
                    </div>
                  </div>

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

