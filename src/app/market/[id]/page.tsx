'use client';

import { useState, useEffect } from 'react';
import { useReadContract, useAccount, useWriteContract } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Sidebar } from '../../components/Sidebar';
import { useTheme } from '../../context/ThemeContext';
import { 
  Menu, 
  Sun, 
  Moon, 
  ArrowLeft,
  Shield,
  CheckCircle,
  Clock,
  Users,
  Target,
  Wallet
} from 'lucide-react';
import Link from 'next/link';

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
    "inputs": [
      {"name": "marketId", "type": "uint256"},
      {"name": "outcome", "type": "uint256"}
    ],
    "name": "verifyMarket",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{"name": "marketId", "type": "uint256"}],
    "name": "getVerificationCount",
    "outputs": [{"name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  }
];

export default function MarketVerification({ params }: { params: { id: string } }) {
  const marketId = parseInt(params.id);
  const { address, isConnected } = useAccount();
  const { writeContract } = useWriteContract();
  const { isDarkMode, toggleTheme } = useTheme();
  
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [marketMetadata, setMarketMetadata] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  const MARKET_MANAGER_ADDRESS = process.env.NEXT_PUBLIC_P2P_MARKET_MANAGER_ADDRESS as `0x${string}`;

  // Fetch market data
  const { data: market, isLoading: marketLoading, error: marketError } = useReadContract({
    address: MARKET_MANAGER_ADDRESS,
    abi: MARKET_MANAGER_ABI,
    functionName: 'getMarket',
    args: [BigInt(marketId)],
  }) as { data: any; isLoading: boolean; error: any };

  // Fetch verification count
  const { data: verifications } = useReadContract({
    address: MARKET_MANAGER_ADDRESS,
    abi: MARKET_MANAGER_ABI,
    functionName: 'getVerificationCount',
    args: [BigInt(marketId)],
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

  const handleVerify = async () => {
    if (!selectedOption || !isConnected) return;

    try {
      setIsVerifying(true);
      
      await writeContract({
        address: MARKET_MANAGER_ADDRESS,
        abi: MARKET_MANAGER_ABI,
        functionName: 'verifyMarket',
        args: [BigInt(marketId), BigInt(selectedOption)],
      });

      // Refresh page after verification
      setTimeout(() => {
        window.location.reload();
      }, 2000);

    } catch (error) {
      console.error('Error verifying market:', error);
    } finally {
      setIsVerifying(false);
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

  // Show loading state
  if (marketLoading || loading) {
    return (
      <div className={`min-h-screen ${isDarkMode ? 'bg-gray-900' : 'bg-gray-50'} flex items-center justify-center`}>
        <div className="text-center">
          <div className={`animate-spin rounded-full h-12 w-12 border-b-2 ${isDarkMode ? 'border-emerald-500' : 'border-emerald-600'} mx-auto mb-4`}></div>
          <p className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>Loading market data...</p>
        </div>
      </div>
    );
  }

  // Show error if market doesn't exist
  if (marketError || !market) {
    return (
      <div className={`min-h-screen ${isDarkMode ? 'bg-gray-900' : 'bg-gray-50'} flex items-center justify-center`}>
        <div className="text-center">
          <h1 className={`text-2xl font-bold mb-4 ${isDarkMode ? 'text-gray-200' : 'text-gray-900'}`}>Market Not Found</h1>
          <p className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>Market #{marketId} does not exist.</p>
          <Link 
            href="/"
            className={`mt-4 inline-block px-4 py-2 rounded-lg transition-colors ${
              isDarkMode 
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white' 
                : 'bg-emerald-600 hover:bg-emerald-700 text-white'
            }`}
          >
            Back to Markets
          </Link>
        </div>
      </div>
    );
  }

  const isMarketEnded = Number(market.state) === 1; // Convert BigInt to number
  const verificationCount = verifications ? Number(verifications) : 0;
  const options = getMarketOptions();

  return (
    <div className={`min-h-screen ${isDarkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
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
            ? 'bg-gray-900 border-gray-800' 
            : 'bg-white border-gray-200'
        }`}>
          <div className="px-3 sm:px-4 lg:px-8">
            <div className="flex items-center justify-between h-14 sm:h-16">
              {/* Left side */}
              <div className="flex items-center gap-2 sm:gap-4">
                <button
                  onClick={() => setSidebarOpen(true)}
                  className={`lg:hidden p-2 rounded-lg transition-colors ${
                    isDarkMode 
                      ? 'hover:bg-gray-800 text-gray-300' 
                      : 'hover:bg-gray-100 text-gray-700'
                  }`}
                >
                  <Menu size={20} />
                </button>
                
                <Link 
                  href="/"
                  className={`flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-2 rounded-lg transition-colors ${
                    isDarkMode 
                      ? 'hover:bg-gray-800 text-gray-300' 
                      : 'hover:bg-gray-100 text-gray-700'
                  }`}
                >
                  <ArrowLeft size={18} />
                  <span className="font-medium text-sm sm:text-base hidden sm:inline">Back to Markets</span>
                  <span className="font-medium text-sm sm:hidden">Back</span>
                </Link>
              </div>

              {/* Right side */}
              <div className="flex items-center gap-2 sm:gap-3">
                {isConnected ? (
                  <div className="flex items-center gap-1 sm:gap-2">
                    <Wallet size={16} className="text-emerald-500" />
                    <span className={`font-mono text-xs sm:text-sm hidden sm:inline ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                      {address?.slice(0, 6)}...{address?.slice(-4)}
                    </span>
                    <span className={`font-mono text-xs sm:hidden ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                      {address?.slice(0, 4)}...{address?.slice(-2)}
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 sm:gap-2">
                    <Wallet size={16} className="text-gray-400" />
                    <div className="scale-90 sm:scale-100">
                      <ConnectButton />
                    </div>
                  </div>
                )}
                <button
                  onClick={toggleTheme}
                  className={`p-2 rounded-lg transition-colors ${
                    isDarkMode 
                      ? 'hover:bg-gray-800 text-gray-300' 
                      : 'hover:bg-gray-100 text-gray-700'
                  }`}
                >
                  {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="max-w-4xl mx-auto px-3 sm:px-4 lg:px-8 py-4 sm:py-6 lg:py-8">
          {/* Market Header */}
          <div className={`rounded-xl shadow-sm p-4 sm:p-6 mb-4 sm:mb-6 ${
            isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
          } border`}>
            <div className="flex items-center gap-3 sm:gap-4 mb-3 sm:mb-4">
              {getMarketImage() && (
                <img
                  src={getMarketImage()!}
                  alt=""
                  className="w-12 h-12 sm:w-16 sm:h-16 rounded-lg object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              )}
              <div className="flex-1 min-w-0">
                <h1 className={`text-lg sm:text-2xl font-bold truncate ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>
                  {getMarketTitle()}
                </h1>
                <p className={`text-xs sm:text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  Market ID: #{marketId}
                </p>
              </div>
              <div className="flex items-center gap-2 sm:gap-3">
                <div className={`flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm ${
                  isMarketEnded 
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200' 
                    : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                }`}>
                  {isMarketEnded ? <CheckCircle size={16} /> : <Clock size={16} />}
                  <span className="hidden sm:inline">
                    {isMarketEnded ? 'Ended' : 'Active'}
                  </span>
                  <span className="sm:hidden">
                    {isMarketEnded ? 'End' : 'Live'}
                  </span>
                </div>
                <div className={`flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm ${
                  isDarkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-700'
                }`}>
                  <Users size={16} />
                  <span className="hidden sm:inline">{verificationCount} Verifications</span>
                  <span className="sm:hidden">{verificationCount}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Verification Section */}
          <div className={`rounded-xl shadow-sm p-4 sm:p-6 ${
            isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
          } border`}>
            <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
              <Shield className={`${isDarkMode ? 'text-emerald-400' : 'text-emerald-600'}`} size={24} />
              <h2 className={`text-lg sm:text-xl font-semibold ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>
                Verify Market Outcome
              </h2>
            </div>
            
            {!isConnected ? (
              <div className="text-center py-6 sm:py-8">
                <div className={`w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-3 sm:mb-4 rounded-full flex items-center justify-center ${
                  isDarkMode ? 'bg-gray-700' : 'bg-gray-100'
                }`}>
                  <Target className={`${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`} size={32} />
                </div>
                <p className={`mb-4 text-sm sm:text-base ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  Please connect your wallet to verify this market
                </p>
                <div className="scale-90 sm:scale-100">
                  <ConnectButton />
                </div>
              </div>
            ) : !isMarketEnded ? (
              <div className="text-center py-6 sm:py-8">
                <div className={`w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-3 sm:mb-4 rounded-full flex items-center justify-center ${
                  isDarkMode ? 'bg-gray-700' : 'bg-gray-100'
                }`}>
                  <Clock className={`${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`} size={32} />
                </div>
                <p className={`mb-4 text-sm sm:text-base ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  This market is still active and cannot be verified yet.
                </p>
              </div>
            ) : (
              <div>
                <p className={`mb-4 sm:mb-6 text-sm sm:text-base ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  Select the winning option for this market:
                </p>
                
                <div className="space-y-2 sm:space-y-3 mb-4 sm:mb-6">
                  {options.map((option: string, index: number) => (
                    <label
                      key={index}
                      className={`flex items-center p-3 sm:p-4 border rounded-lg cursor-pointer transition-colors ${
                        selectedOption === index + 1
                          ? isDarkMode 
                            ? 'border-emerald-500 bg-emerald-900/20' 
                            : 'border-emerald-500 bg-emerald-50'
                          : isDarkMode
                            ? 'border-gray-700 hover:bg-gray-700'
                            : 'border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="option"
                        value={index + 1}
                        checked={selectedOption === index + 1}
                        onChange={() => setSelectedOption(index + 1)}
                        className="mr-2 sm:mr-3 text-emerald-600"
                      />
                      <span className={`font-medium text-sm sm:text-base ${isDarkMode ? 'text-gray-200' : 'text-gray-900'}`}>
                        {option}
                      </span>
                    </label>
                  ))}
                </div>

                <button
                  onClick={handleVerify}
                  disabled={!selectedOption || isVerifying}
                  className={`w-full py-2 sm:py-3 px-4 sm:px-6 rounded-lg font-medium text-sm sm:text-base transition-colors ${
                    !selectedOption || isVerifying
                      ? isDarkMode 
                        ? 'bg-gray-700 text-gray-500 cursor-not-allowed' 
                        : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  }`}
                >
                  {isVerifying ? 'Verifying...' : 'Submit Verification'}
                </button>
              </div>
            )}
          </div>

          {/* Market Details */}
          <div className={`rounded-xl shadow-sm p-4 sm:p-6 mt-4 sm:mt-6 ${
            isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
          } border`}>
            <h3 className={`text-base sm:text-lg font-semibold mb-3 sm:mb-4 ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>
              Market Details
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 text-xs sm:text-sm">
              <div>
                <span className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>End Time:</span>
                <p className={`font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-900'}`}>
                  {new Date(Number(market.endTime) * 1000).toLocaleString()}
                </p>
              </div>
              <div>
                <span className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>State:</span>
                <p className={`font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-900'}`}>
                  {Number(market.state) === 0 ? 'Active' : Number(market.state) === 1 ? 'Ended' : 'Resolved'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}