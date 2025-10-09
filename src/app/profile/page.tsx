"use client";

import React, { useState, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { 
  User, 
  Edit3, 
  Save, 
  X, 
  Upload, 
  Camera,
  TrendingUp,
  TrendingDown,
  Trophy,
  Target,
  Clock,
  DollarSign,
  Users,
  Heart,
  BarChart3,
  Menu,
  Sun,
  Moon,
  Wallet,
  Loader2,
  AlertCircle,
  CheckCircle
} from 'lucide-react';
import { Sidebar } from '../components/Sidebar';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, useReadContract } from 'wagmi';
import { useTheme } from '../context/ThemeContext';
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

export default function ProfilePage() {
  const { isDarkMode, toggleTheme } = useTheme();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { address, isConnected } = useAccount();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Profile state
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    username: '',
    display_name: '',
    bio: ''
  });

  // Analytics state
  const [analytics, setAnalytics] = useState<UserAnalytics | null>(null);
  const [userMarkets, setUserMarkets] = useState<UserMarketData[]>([]);

  // Contract addresses (you'll need to add these to your env)
  const ANALYTICS_CONTRACT = process.env.NEXT_PUBLIC_ANALYTICS_CONTRACT_ADDRESS as `0x${string}`;

  // Sidebar handlers
  const onSidebarClose = () => setSidebarOpen(false);
  const onToggleCollapse = () => setSidebarCollapsed(!sidebarCollapsed);
  const onMenuClick = () => setSidebarOpen(true);

  // Read analytics data from contract
  const { data: userStats } = useReadContract({
    address: ANALYTICS_CONTRACT,
    abi: ANALYTICS_ABI,
    functionName: 'getUserStats',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address && !!ANALYTICS_CONTRACT
    }
  });

  const { data: userMarketIds } = useReadContract({
    address: ANALYTICS_CONTRACT,
    abi: ANALYTICS_ABI,
    functionName: 'getUserMarkets',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address && !!ANALYTICS_CONTRACT
    }
  });

  // Load profile data
  useEffect(() => {
    if (address) {
      loadProfile();
    }
  }, [address]);

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
    if (!address) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/profile?address=${address}`);
      const data = await response.json();

      if (response.ok) {
        setProfile(data.profile);
        if (data.profile) {
          setFormData({
            username: data.profile.username || '',
            display_name: data.profile.display_name || '',
            bio: data.profile.bio || ''
          });
        }
      } else {
        setError(data.error || 'Failed to load profile');
      }
    } catch (err) {
      setError('Failed to load profile');
      console.error('Profile load error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!address) return;

    setIsSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const url = profile ? '/api/profile' : '/api/profile';
      const method = profile ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          address,
          ...formData
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setProfile(data.profile);
        setIsEditing(false);
        setSuccess('Profile updated successfully!');
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(data.error || 'Failed to save profile');
      }
    } catch (err) {
      setError('Failed to save profile');
      console.error('Profile save error:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleImageUpload = async (file: File) => {
    if (!address) return;

    setIsUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('address', address);

      const response = await fetch('/api/profile/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (response.ok) {
        // Update profile with new image URL
        const updateResponse = await fetch('/api/profile', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            address,
            image: data.url
          }),
        });

        const updateData = await updateResponse.json();
        if (updateResponse.ok) {
          setProfile(updateData.profile);
          setSuccess('Profile image updated successfully!');
          setTimeout(() => setSuccess(null), 3000);
        }
      } else {
        setError(data.error || 'Failed to upload image');
      }
    } catch (err) {
      setError('Failed to upload image');
      console.error('Image upload error:', err);
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleImageUpload(file);
    }
  };

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const calculateWinRate = () => {
    if (!analytics || analytics.totalStakesPlaced === BigInt(0)) return 0;
    return Number((analytics.totalStakesWon * BigInt(100)) / analytics.totalStakesPlaced);
  };

  if (!isConnected) {
    return (
      <ClientOnly>
        <div className={`min-h-screen ${isDarkMode ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-900'}`}>
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
              isDarkMode ? 'bg-gray-900/95 border-gray-800' : 'bg-white/95 border-gray-200'
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
                    <div className="flex flex-col">
                      <h1 className="text-sm lg:text-xl font-semibold">Profile</h1>
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
                <div className="text-center py-12">
                  <User className="h-16 w-16 mx-auto mb-4 text-gray-400" />
                  <h1 className="text-2xl font-bold mb-2">Connect Your Wallet</h1>
                  <p className="text-gray-600 dark:text-gray-400 mb-6">
                    Please connect your wallet to view and manage your profile.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </ClientOnly>
    );
  }

  return (
    <ClientOnly>
      <div className={`min-h-screen ${isDarkMode ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-900'}`}>
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
            isDarkMode ? 'bg-gray-900/95 border-gray-800' : 'bg-white/95 border-gray-200'
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
                  <div className="flex flex-col">
                    <h1 className="text-sm lg:text-xl font-semibold">Profile</h1>
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
              {/* Error/Success Messages */}
              {error && (
                <div className="mb-6 p-4 bg-red-100 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded-lg flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-red-500" />
                  <span className="text-red-700 dark:text-red-300">{error}</span>
                </div>
              )}

              {success && (
                <div className="mb-6 p-4 bg-green-100 dark:bg-green-900/20 border border-green-300 dark:border-green-700 rounded-lg flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <span className="text-green-700 dark:text-green-300">{success}</span>
                </div>
              )}

              {isLoading ? (
                <div className="text-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
                  <p>Loading profile...</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Profile Header */}
                  <div className={`p-6 rounded-lg ${isDarkMode ? 'bg-gray-800' : 'bg-white'} shadow-sm`}>
                    <div className="flex items-start gap-6">
                      {/* Profile Image */}
                      <div className="relative">
                        <div className="w-24 h-24 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700">
                          {profile?.image ? (
                            <img 
                              src={profile.image} 
                              alt="Profile" 
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <User className="h-8 w-8 text-gray-400" />
                            </div>
                          )}
                        </div>
                        
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          disabled={isUploading}
                          className="absolute -bottom-2 -right-2 p-2 bg-blue-500 text-white rounded-full hover:bg-blue-600 disabled:opacity-50"
                        >
                          {isUploading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Camera className="h-4 w-4" />
                          )}
                        </button>
                        
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleFileSelect}
                          className="hidden"
                        />
                      </div>

                      {/* Profile Info */}
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-4">
                          <div>
                            <h1 className="text-2xl font-bold">
                              {profile?.display_name || 'Anonymous User'}
                            </h1>
                            <p className="text-gray-600 dark:text-gray-400">
                              @{profile?.username || 'no-username'}
                            </p>
                            <p className="text-sm text-gray-500 dark:text-gray-500">
                              {formatAddress(address || '')}
                            </p>
                          </div>
                          
                          <button
                            onClick={() => setIsEditing(!isEditing)}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                          >
                            <Edit3 className="h-4 w-4" />
                            {isEditing ? 'Cancel' : 'Edit Profile'}
                          </button>
                        </div>

                        {profile?.bio && (
                          <p className="text-gray-700 dark:text-gray-300 mb-4">
                            {profile.bio}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Edit Form */}
                    {isEditing && (
                      <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium mb-2">
                              Username
                            </label>
                            <input
                              type="text"
                              value={formData.username}
                              onChange={(e) => setFormData({...formData, username: e.target.value})}
                              className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                              placeholder="Enter username"
                            />
                          </div>
                          
                          <div>
                            <label className="block text-sm font-medium mb-2">
                              Display Name
                            </label>
                            <input
                              type="text"
                              value={formData.display_name}
                              onChange={(e) => setFormData({...formData, display_name: e.target.value})}
                              className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                              placeholder="Enter display name"
                            />
                          </div>
                        </div>
                        
                        <div className="mt-4">
                          <label className="block text-sm font-medium mb-2">
                            Bio
                          </label>
                          <textarea
                            value={formData.bio}
                            onChange={(e) => setFormData({...formData, bio: e.target.value})}
                            rows={3}
                            className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                            placeholder="Tell us about yourself..."
                          />
                        </div>
                        
                        <div className="flex gap-3 mt-4">
                          <button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50"
                          >
                            {isSaving ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Save className="h-4 w-4" />
                            )}
                            Save Changes
                          </button>
                          
                          <button
                            onClick={() => setIsEditing(false)}
                            className="flex items-center gap-2 px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
                          >
                            <X className="h-4 w-4" />
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Analytics Section */}
                  {analytics && (
                    <div className={`p-6 rounded-lg ${isDarkMode ? 'bg-gray-800' : 'bg-white'} shadow-sm`}>
                      <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                        <BarChart3 className="h-5 w-5" />
                        Trading Analytics
                      </h2>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                          <Trophy className="h-8 w-8 mx-auto mb-2 text-yellow-500" />
                          <div className="text-2xl font-bold">
                            {calculateWinRate()}%
                          </div>
                          <div className="text-sm text-gray-600 dark:text-gray-400">
                            Win Rate
                          </div>
                        </div>
                        
                        <div className="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                          <Target className="h-8 w-8 mx-auto mb-2 text-blue-500" />
                          <div className="text-2xl font-bold">
                            {analytics.totalStakesPlaced.toString()}
                          </div>
                          <div className="text-sm text-gray-600 dark:text-gray-400">
                            Total Stakes
                          </div>
                        </div>
                        
                        <div className="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                          <DollarSign className="h-8 w-8 mx-auto mb-2 text-green-500" />
                          <div className="text-2xl font-bold">
                            {formatEther(analytics.totalWinnings)} ETH
                          </div>
                          <div className="text-sm text-gray-600 dark:text-gray-400">
                            Total Winnings
                          </div>
                        </div>
                        
                        <div className="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                          <Users className="h-8 w-8 mx-auto mb-2 text-purple-500" />
                          <div className="text-2xl font-bold">
                            {analytics.marketsCreated.toString()}
                          </div>
                          <div className="text-sm text-gray-600 dark:text-gray-400">
                            Markets Created
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* User Markets Section */}
                  <div className={`p-6 rounded-lg ${isDarkMode ? 'bg-gray-800' : 'bg-white'} shadow-sm`}>
                    <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                      <TrendingUp className="h-5 w-5" />
                      Your Markets
                    </h2>
                    
                    {userMarkets.length === 0 ? (
                      <div className="text-center py-8">
                        <Target className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                        <p className="text-gray-600 dark:text-gray-400">
                          You haven't created any markets yet.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {userMarkets.map((market) => (
                          <div key={market.marketId} className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                            <div className="flex items-center gap-4">
                              <img 
                                src={market.image} 
                                alt="Market" 
                                className="w-16 h-16 rounded-lg object-cover"
                              />
                              <div className="flex-1">
                                <h3 className="font-semibold">{market.title}</h3>
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                  {market.description}
                                </p>
                                <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                                  <span>Type: {market.type}</span>
                                  <span>State: {market.state}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </ClientOnly>
  );
}
