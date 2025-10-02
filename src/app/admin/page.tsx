'use client';

import { useState, useEffect } from 'react';
import { 
  Users, 
  DollarSign, 
  Timer, 
  AlertCircle, 
  Trash2, 
  X,
  Menu
} from 'lucide-react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, useReadContract, useWriteContract } from 'wagmi';
import { formatEther } from 'viem';
import { ethers } from 'ethers';
import { Sidebar } from '../components/Sidebar';
import { useTheme } from '../context/ThemeContext';

// Contract ABIs
const MARKET_MANAGER_ABI = [
  {
    "inputs": [],
    "name": "getMarketCount",
    "outputs": [{"name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"name": "marketId", "type": "uint256"}],
    "name": "getMarket",
    "outputs": [
      {"name": "creator", "type": "address"},
      {"name": "ipfsHash", "type": "string"},
      {"name": "endTime", "type": "uint256"},
      {"name": "state", "type": "uint8"},
      {"name": "isMultiOption", "type": "bool"},
      {"name": "maxOptions", "type": "uint8"},
      {"name": "minStake", "type": "uint256"},
      {"name": "paymentToken", "type": "address"},
      {"name": "stakeEndTime", "type": "uint256"}
    ],
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
    "inputs": [{"name": "marketId", "type": "uint256"}, {"name": "amount", "type": "uint256"}],
    "name": "supportMarket",
    "outputs": [],
    "stateMutability": "nonpayable",
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
    "inputs": [{"name": "marketId", "type": "uint256"}, {"name": "reason", "type": "string"}],
    "name": "deleteMarket",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{"name": "marketId", "type": "uint256"}],
    "name": "permanentlyRemoveMarket",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }
];

// Admin Access Hook
function useAdminAccess() {
  const { address, isConnected } = useAccount();
  const [isOwner, setIsOwner] = useState(false);
  const [isPartner, setIsPartner] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAccess = async () => {
      if (!address || !isConnected) {
        setIsOwner(false);
        setIsPartner(false);
        setIsLoading(false);
        return;
      }

      try {
        const ownerAddress = process.env.NEXT_PUBLIC_OWNER_ADDRESS || '0x62942BbBb86482bFA0C064d0262E23Ca04ea99C5';
        const partnerAddress = process.env.NEXT_PUBLIC_PARTNER_ADDRESS;
        
        setIsOwner(address.toLowerCase() === ownerAddress?.toLowerCase());
        setIsPartner(address.toLowerCase() === partnerAddress?.toLowerCase());
      } catch (error) {
        console.error('Error checking admin access:', error);
        setIsOwner(false);
        setIsPartner(false);
      } finally {
        setIsLoading(false);
      }
    };

    checkAccess();
  }, [address, isConnected]);

  return { isOwner, isPartner, hasAccess: isOwner || isPartner, isLoading, isConnected };
}

// Market Search Component
function MarketSearch({ isDarkMode }: { isDarkMode: boolean }) {
  const [searchId, setSearchId] = useState('');
  const [searchedMarketId, setSearchedMarketId] = useState<number | null>(null);
  const [searchError, setSearchError] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  const marketManagerAddress = process.env.NEXT_PUBLIC_P2P_MARKET_MANAGER_ADDRESS as `0x${string}`;
  const { writeContract } = useWriteContract();
  const { address: userAddress } = useAccount();

  const handleSearch = async () => {
    if (!searchId || isNaN(Number(searchId))) {
      setSearchError('Enter a valid market ID number');
      return;
    }
    
    setIsSearching(true);
    setSearchError('');
    setSearchedMarketId(null);
    
    try {
      const provider = new ethers.JsonRpcProvider('https://rpc-pepu-v2-mainnet-0.t.conduit.xyz');
      const contract = new ethers.Contract(marketManagerAddress, MARKET_MANAGER_ABI, provider);
      
      const market = await contract.getMarket(BigInt(searchId));
      
      if (!market || !market.creator || market.creator === '0x0000000000000000000000000000000000000000') {
        setSearchError(`Market #${searchId} does not exist on the blockchain`);
        setIsSearching(false);
        return;
      }
      
      setSearchedMarketId(Number(searchId));
      
    } catch (err: any) {
      console.error('Search error:', err);
      setSearchError(`Market #${searchId} does not exist or failed to load`);
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className={`p-6 rounded-xl border ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
        <h2 className={`text-2xl font-bold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
          Market Management
        </h2>
        
        <div className="flex gap-4 mb-6">
          <div className="flex-1">
            <input
              type="number"
              value={searchId}
              onChange={(e) => setSearchId(e.target.value)}
              placeholder="Enter Market ID"
              className={`w-full px-4 py-3 border rounded-lg text-sm ${
                isDarkMode 
                  ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                  : 'bg-white border-gray-300 text-gray-900'
              }`}
            />
          </div>
          <button
            onClick={handleSearch}
            disabled={isSearching}
            className={`px-6 py-3 rounded-lg text-sm font-semibold transition-colors ${
              isSearching
                ? 'bg-gray-600 cursor-not-allowed text-gray-400'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            {isSearching ? 'Searching...' : 'Search Market'}
          </button>
        </div>

        {searchError && (
          <div className={`p-4 rounded-lg border flex items-start gap-3 mb-6 ${
            isDarkMode ? 'bg-red-900/20 border-red-800 text-red-300' : 'bg-red-50 border-red-200 text-red-800'
          }`}>
            <AlertCircle size={20} className="flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Error</p>
              <p className="text-sm">{searchError}</p>
            </div>
          </div>
        )}

        {searchedMarketId && (
          <div className={`p-4 rounded-lg border ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
            <h3 className={`text-xl font-bold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              Market #{searchedMarketId}
            </h3>
            <p className={`${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              Market found! MarketCard component would load here.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// Main Admin Page Component
export default function AdminPage() {
  const { isDarkMode, toggleTheme } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState<'market' | 'user' | 'token' | 'blacklist'>('market');

  const { hasAccess, isLoading, isConnected } = useAdminAccess();
  const { address } = useAccount();

  if (isLoading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isDarkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  const onSidebarClose = () => setSidebarOpen(false);
  const onToggleCollapse = () => setSidebarCollapsed(!sidebarCollapsed);

  return (
    <div className={`min-h-screen ${isDarkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
      <Sidebar 
        isOpen={sidebarOpen} 
        onClose={onSidebarClose} 
        collapsed={sidebarCollapsed}
        onToggleCollapse={onToggleCollapse}
        isDarkMode={isDarkMode}
      />
      
      <div className={`transition-all duration-300 ${sidebarCollapsed ? 'ml-16' : 'ml-64'}`}>
        {/* Header */}
        <div className={`sticky top-0 z-40 border-b ${isDarkMode ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'}`}>
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setSidebarOpen(true)}
                  className={`p-2 rounded-lg ${isDarkMode ? 'bg-gray-800 text-white hover:bg-gray-700' : 'bg-white text-gray-900 hover:bg-gray-50'} shadow-sm transition-colors`}
                >
                  <Menu size={20} />
                </button>
                <div>
                  <h1 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    Admin Panel
                  </h1>
                  <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    Manage markets, users, and platform settings
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <ConnectButton />
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="p-6">
          {!isConnected ? (
            <div className={`p-8 rounded-xl border ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
              <h2 className={`text-2xl font-bold mb-4 text-center ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                Connect Wallet Required
              </h2>
              <p className={`text-center mb-6 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                Please connect your wallet to access the admin panel.
              </p>
              <div className="flex justify-center">
                <ConnectButton />
              </div>
            </div>
          ) : !hasAccess ? (
            <div className={`p-8 rounded-xl border ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
              <h2 className={`text-2xl font-bold mb-4 text-center ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                Access Denied
              </h2>
              <p className={`text-center mb-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                You don't have permission to access the admin panel.
              </p>
              <div className={`text-center text-sm ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                <p>Owner: {process.env.NEXT_PUBLIC_OWNER_ADDRESS?.slice(0, 6)}...{process.env.NEXT_PUBLIC_OWNER_ADDRESS?.slice(-4)}</p>
                <p>Partner: {process.env.NEXT_PUBLIC_PARTNER_ADDRESS?.slice(0, 6)}...{process.env.NEXT_PUBLIC_PARTNER_ADDRESS?.slice(-4)}</p>
                <p>Your Address: {address?.slice(0, 6)}...{address?.slice(-4)}</p>
              </div>
            </div>
          ) : (
            <>
              {/* Tab Navigation */}
              <div className={`flex gap-1 p-1 rounded-lg mb-6 ${isDarkMode ? 'bg-gray-800' : 'bg-gray-200'}`}>
                {[
                  { id: 'market', label: 'Market Management' },
                  { id: 'user', label: 'User Management' },
                  { id: 'token', label: 'Token Management' },
                  { id: 'blacklist', label: 'Blacklist Management' }
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                      activeTab === tab.id
                        ? isDarkMode
                          ? 'bg-blue-600 text-white'
                          : 'bg-white text-blue-600 shadow-sm'
                        : isDarkMode
                          ? 'text-gray-400 hover:text-white'
                          : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Tab Content */}
              <div className="space-y-6">
                {activeTab === 'market' && <MarketSearch isDarkMode={isDarkMode} />}
                {activeTab === 'user' && (
                  <div className={`p-6 rounded-xl border ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                    <h2 className={`text-2xl font-bold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                      User Management
                    </h2>
                    <p className={`${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                      User management features coming soon...
                    </p>
                  </div>
                )}
                {activeTab === 'token' && (
                  <div className={`p-6 rounded-xl border ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                    <h2 className={`text-2xl font-bold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                      Token Management
                    </h2>
                    <p className={`${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                      Token management features coming soon...
                    </p>
                  </div>
                )}
                {activeTab === 'blacklist' && (
                  <div className={`p-6 rounded-xl border ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                    <h2 className={`text-2xl font-bold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                      Blacklist Management
                    </h2>
                    <p className={`${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                      Blacklist management features coming soon...
                    </p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
