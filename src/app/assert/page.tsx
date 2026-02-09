"use client";

import React, { useState, useEffect } from 'react';
import { 
  AlertCircle,
  CheckCircle,
  Clock,
  ChevronDown,
  ChevronUp,
  Wallet,
  Sun,
  Moon,
  Menu,
  FileText
} from 'lucide-react';
import { HeaderWallet } from '@/components/HeaderWallet';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, usePublicClient } from 'wagmi';
import { formatEther } from 'viem';
import { Sidebar } from '../components/Sidebar';
import { useTheme } from '../context/ThemeContext';

const MARKET_MANAGER_ADDRESS = process.env.NEXT_PUBLIC_P2P_MARKET_MANAGER_ADDRESS as `0x${string}`;

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
          {"name": "umaAssertionId", "type": "bytes32"},
          {"name": "priceFeed", "type": "address"},
          {"name": "priceThreshold", "type": "uint256"},
          {"name": "marketType", "type": "uint8"},
          {"name": "umaAssertionMade", "type": "bool"}
        ],
        "name": "",
        "type": "tuple"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getNextMarketId",
    "outputs": [{"name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {"name": "marketId", "type": "uint256"},
      {"name": "claim", "type": "bytes"}
    ],
    "name": "requestUMAResolution",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {"name": "marketId", "type": "uint256"},
      {"name": "winningOption", "type": "uint256"}
    ],
    "name": "settleUMAMarket",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "defaultBond",
    "outputs": [{"name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "defaultLiveness",
    "outputs": [{"name": "", "type": "uint64"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "optimisticOracle",
    "outputs": [{"name": "", "type": "address"}],
    "stateMutability": "view",
    "type": "function"
  }
] as const;

interface MarketData {
  creator: `0x${string}`;
  ipfsHash: string;
  isMultiOption: boolean;
  maxOptions: bigint;
  paymentToken: `0x${string}`;
  minStake: bigint;
  creatorDeposit: bigint;
  creatorOutcome: bigint;
  startTime: bigint;
  stakeEndTime: bigint;
  endTime: bigint;
  resolutionEndTime: bigint;
  state: number;
  winningOption: bigint;
  isResolved: boolean;
  umaAssertionId: `0x${string}`;
  priceFeed: `0x${string}`;
  priceThreshold: bigint;
  marketType: number;
  umaAssertionMade: boolean;
}

interface MarketWithMetadata extends MarketData {
  marketId: number;
  metadata?: any;
  loading?: boolean;
}

export default function AssertPage() {
  const { isDarkMode, toggleTheme } = useTheme();
  const { address, isConnected } = useAccount();
  const { writeContract } = useWriteContract();
  const { data: hash, isPending, error: txError } = useWaitForTransactionReceipt();
  const publicClient = usePublicClient();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [expandedMarketId, setExpandedMarketId] = useState<number | null>(null);
  const [selectedOption, setSelectedOption] = useState<number>(0);
  const [winningOption, setWinningOption] = useState<string>('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [markets, setMarkets] = useState<MarketWithMetadata[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch UMA configuration
  const { data: defaultBond } = useReadContract({
    address: MARKET_MANAGER_ADDRESS,
    abi: MARKET_MANAGER_ABI,
    functionName: 'defaultBond',
  });

  const { data: defaultLiveness } = useReadContract({
    address: MARKET_MANAGER_ADDRESS,
    abi: MARKET_MANAGER_ABI,
    functionName: 'defaultLiveness',
  });

  const { data: optimisticOracle, isLoading: isLoadingOracle } = useReadContract({
    address: MARKET_MANAGER_ADDRESS,
    abi: MARKET_MANAGER_ABI,
    functionName: 'optimisticOracle',
  });

  // Fetch all ended UMA markets
  useEffect(() => {
    const fetchMarkets = async () => {
      if (!publicClient) return;
      
      setLoading(true);
      try {
        // Get next market ID
        const nextMarketId = await publicClient.readContract({
          address: MARKET_MANAGER_ADDRESS,
          abi: MARKET_MANAGER_ABI,
          functionName: 'getNextMarketId',
        });

        const totalMarkets = Number(nextMarketId);
        const endedMarkets: MarketWithMetadata[] = [];

        // Fetch all markets and filter for Ended + UMA_MANUAL
        console.log(`🔍 Checking ${totalMarkets - 1} markets for assert page...`);
        for (let i = 1; i < totalMarkets; i++) {
          try {
            const marketData = await publicClient.readContract({
              address: MARKET_MANAGER_ADDRESS,
              abi: MARKET_MANAGER_ABI,
              functionName: 'getMarket',
              args: [BigInt(i)],
            }) as MarketData;

            // Debug logging for market 4 specifically
            if (i === 4) {
              console.log(`📊 Market 4 details:`, {
                state: marketData.state,
                marketType: marketData.marketType,
                endTime: marketData.endTime.toString(),
                currentTime: Date.now() / 1000,
                isEnded: marketData.state === 1,
                isUMA: marketData.marketType === 1,
                willShow: marketData.state === 1 && marketData.marketType === 1
              });
            }

            // Filter: state === 1 (Ended) and marketType === 1 (UMA_MANUAL)
            if (marketData.state === 1 && marketData.marketType === 1) {
              console.log(`✅ Market ${i} passed filter (Ended + UMA_MANUAL)`);
              // Fetch metadata
              let metadata = null;
              try {
                const response = await fetch(`https://gateway.lighthouse.storage/ipfs/${marketData.ipfsHash}`);
                if (response.ok) {
                  metadata = await response.json();
                }
              } catch (e) {
                console.error(`Error fetching metadata for market ${i}:`, e);
              }

              endedMarkets.push({
                ...marketData,
                marketId: i,
                metadata,
              });
            }
          } catch (e) {
            // Market might not exist, skip
            continue;
          }
        }

        console.log(`📊 Found ${endedMarkets.length} ended UMA markets:`, endedMarkets.map(m => m.marketId));
        setMarkets(endedMarkets);
      } catch (error) {
        console.error('Error fetching markets:', error);
        setError('Failed to load markets');
      } finally {
        setLoading(false);
      }
    };

    fetchMarkets();
  }, [publicClient]);

  const handleMakeAssertion = async (marketId: number) => {
    if (!isConnected || !address) {
      setError('Please connect your wallet');
      return;
    }

    const market = markets.find(m => m.marketId === marketId);
    if (!market || !market.metadata) {
      setError('Market data not loaded');
      return;
    }

    if (selectedOption === 0) {
      setError('Please select an option');
      return;
    }

    const options = market.metadata.options || (market.isMultiOption ? [] : ['Yes', 'No']);
    const selectedOptionText = options[selectedOption - 1];
    const claimText = selectedOptionText || `Option ${selectedOption} wins`;
    
    try {
      const claimBytes = new TextEncoder().encode(claimText);
      // Convert Uint8Array to hex string (0x prefix required)
      const claimBytesHex = `0x${Array.from(claimBytes).map(b => b.toString(16).padStart(2, '0')).join('')}` as `0x${string}`;
      await writeContract({
        address: MARKET_MANAGER_ADDRESS,
        abi: MARKET_MANAGER_ABI,
        functionName: 'requestUMAResolution',
        args: [BigInt(marketId), claimBytesHex],
      });
      setSuccess('Assertion submitted! Waiting for confirmation...');
      setError('');
      setSelectedOption(0);
      // Refresh market data
      setTimeout(() => window.location.reload(), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to make assertion');
      setSuccess('');
    }
  };

  const handleSettleMarket = async (marketId: number) => {
    if (!isConnected || !address) {
      setError('Please connect your wallet');
      return;
    }

    if (!winningOption) {
      setError('Please select a winning option');
      return;
    }

    try {
      await writeContract({
        address: MARKET_MANAGER_ADDRESS,
        abi: MARKET_MANAGER_ABI,
        functionName: 'settleUMAMarket',
        args: [BigInt(marketId), BigInt(winningOption)],
      });
      setSuccess('Settlement submitted! Waiting for confirmation...');
      setError('');
      setTimeout(() => window.location.reload(), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to settle market');
      setSuccess('');
    }
  };

  const toggleExpand = (marketId: number) => {
    if (expandedMarketId === marketId) {
      setExpandedMarketId(null);
    } else {
      setExpandedMarketId(marketId);
      setSelectedOption(0);
      setWinningOption('');
    }
  };

  const isUMAConfigured = optimisticOracle && optimisticOracle !== '0x0000000000000000000000000000000000000000' && optimisticOracle !== '0x';

  return (
    <div className={`min-h-screen ${isDarkMode ? 'bg-black' : 'bg-[#F5F3F0]'}`}>
      <Sidebar 
        isOpen={sidebarOpen} 
        onClose={() => setSidebarOpen(false)} 
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        isDarkMode={isDarkMode}
      />

      <div className={`transition-all duration-300 lg:${sidebarCollapsed ? 'ml-16' : 'ml-64'}`}>
        <header className={`sticky top-0 z-30 border-b backdrop-blur-sm ${isDarkMode ? 'bg-black border-[#39FF14]/20' : 'bg-[#F5F3F0] border-gray-200'}`}>
          <div className="px-4 lg:px-6 py-1.5 lg:py-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setSidebarOpen(true)}
                  className={`lg:hidden p-2 rounded-lg transition-colors ${isDarkMode ? 'hover:bg-[#39FF14]/10 text-white' : 'hover:bg-gray-200'}`}
                >
                  <Menu size={20} className={isDarkMode ? 'text-white' : 'text-gray-900'} />
                </button>
                
                <div className="hidden lg:block">
                  <h1 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    Resolve Markets
                  </h1>
                  <p className={`text-sm ${isDarkMode ? 'text-white/70' : 'text-gray-600'}`}>
                    Assert outcomes for ended markets that require manual resolution
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-2 lg:gap-4">
                <button
                  onClick={toggleTheme}
                  className={`p-1.5 lg:p-2 rounded-lg transition-colors ${isDarkMode ? 'hover:bg-[#39FF14]/10 text-white' : 'hover:bg-gray-200'}`}
                >
                  {isDarkMode ? <Sun className="w-4 h-4 lg:w-5 lg:h-5 text-white" /> : <Moon className="w-4 h-4 lg:w-5 lg:h-5 text-gray-600" />}
                </button>
                
                <HeaderWallet isDarkMode={isDarkMode} />
              </div>
            </div>
          </div>
        </header>

        <main className="p-4 lg:p-6">
          {/* Mobile Header */}
          <div className="lg:hidden mb-6">
            <h1 className={`text-2xl font-bold mb-1 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              Resolve Markets
            </h1>
            <p className={`text-sm ${isDarkMode ? 'text-white/70' : 'text-gray-600'}`}>
              Assert outcomes for ended markets that require manual resolution
            </p>
          </div>

          {error && (
            <div className={`mb-6 p-4 rounded-lg border flex items-center gap-3 ${
              isDarkMode ? 'bg-red-900/20 border-red-800 text-red-300' : 'bg-red-50 border-red-200 text-red-800'
            }`}>
              <AlertCircle size={20} className="flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className={`mb-6 p-4 rounded-lg border flex items-center gap-3 ${
              isDarkMode ? 'bg-green-900/20 border-green-800 text-green-300' : 'bg-green-50 border-green-200 text-green-800'
            }`}>
              <CheckCircle size={20} className="flex-shrink-0" />
              <span>{success}</span>
            </div>
          )}

          {!isLoadingOracle && !isUMAConfigured && (
            <div className={`mb-6 p-4 rounded-lg border flex items-start gap-3 ${
              isDarkMode ? 'bg-yellow-900/20 border-yellow-800 text-yellow-300' : 'bg-yellow-50 border-yellow-200 text-yellow-800'
            }`}>
              <AlertCircle size={20} className="flex-shrink-0 mt-0.5" />
              <div>
                <div className="font-medium mb-1">Optimistic Oracle Not Configured</div>
                <p className="text-sm opacity-90">
                  Optimistic Oracle is not configured. Please configure it first.
                </p>
              </div>
            </div>
          )}

          {loading ? (
            <div className={`text-center py-12 ${isDarkMode ? 'text-white/70' : 'text-gray-600'}`}>
              Loading markets...
            </div>
          ) : markets.length === 0 ? (
            <div className={`text-center py-12 ${isDarkMode ? 'text-white/70' : 'text-gray-600'}`}>
              No ended Optimistic Oracle markets found
            </div>
          ) : (
            <div className="space-y-4">
              {markets.map((market) => {
                const isExpanded = expandedMarketId === market.marketId;
                const options = market.metadata?.options || (market.isMultiOption ? [] : ['Yes', 'No']);

                return (
                  <div
                    key={market.marketId}
                    className={`rounded-lg border transition-all ${
                      isDarkMode ? 'bg-black border-gray-800' : 'bg-white border-gray-300'
                    }`}
                  >
                    {/* Market Header - Always Visible */}
                    <button
                      onClick={() => toggleExpand(market.marketId)}
                      className={`w-full p-4 flex items-center justify-between hover:opacity-80 transition-opacity ${
                        isDarkMode ? 'hover:bg-gray-900' : 'hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex-1 text-left">
                        <div className="flex items-center gap-3 mb-2">
                          <span className={`text-sm font-medium px-2 py-1 rounded ${
                            isDarkMode ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-700'
                          }`}>
                            Market #{market.marketId}
                          </span>
                          <span className={`text-xs px-2 py-1 rounded ${
                            market.umaAssertionMade
                              ? isDarkMode ? 'bg-green-900/30 text-green-300' : 'bg-green-100 text-green-700'
                              : isDarkMode ? 'bg-yellow-900/30 text-yellow-300' : 'bg-yellow-100 text-yellow-700'
                          }`}>
                            {market.umaAssertionMade ? 'Assertion Made' : 'No Assertion'}
                          </span>
                        </div>
                        <h3 className={`font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                          {market.metadata?.title || 'Loading...'}
                        </h3>
                        {market.metadata?.description && (
                          <p className={`text-sm mt-1 line-clamp-2 ${isDarkMode ? 'text-white/70' : 'text-gray-600'}`}>
                            {market.metadata.description}
                          </p>
                        )}
                      </div>
                      {isExpanded ? (
                        <ChevronUp className={`w-5 h-5 ${isDarkMode ? 'text-white' : 'text-gray-600'}`} />
                      ) : (
                        <ChevronDown className={`w-5 h-5 ${isDarkMode ? 'text-white' : 'text-gray-600'}`} />
                      )}
                    </button>

                    {/* Expanded Content */}
                    {isExpanded && (
                      <div className={`border-t p-6 ${isDarkMode ? 'border-gray-800' : 'border-gray-200'}`}>
                        {market.metadata && (
                          <div className="mb-6">
                            <h4 className={`text-sm font-semibold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                              Market Options
                            </h4>
                            <div className="space-y-2 mb-4">
                              {options.map((option: string, index: number) => (
                                <div
                                  key={index}
                                  className={`px-3 py-2 rounded ${
                                    isDarkMode ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-900'
                                  }`}
                                >
                                  {index + 1}. {option}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Make Assertion Section - Only if no assertion made */}
                        {!market.umaAssertionMade && (
                          <div className={`mb-6 p-4 rounded border ${
                            isDarkMode ? 'bg-gray-900 border-gray-700' : 'bg-gray-50 border-gray-200'
                          }`}>
                            <h4 className={`text-sm font-semibold mb-3 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                              Make Assertion
                            </h4>
                            <div className="space-y-2 mb-4">
                              {options.map((option: string, index: number) => {
                                const optionNum = index + 1;
                                const isSelected = selectedOption === optionNum;
                                return (
                                  <button
                                    key={index}
                                    onClick={() => setSelectedOption(optionNum)}
                                    className={`w-full text-left px-4 py-3 rounded border transition-colors ${
                                      isSelected
                                        ? isDarkMode 
                                          ? 'border-[#39FF14] bg-[#39FF14]/10 text-[#39FF14]' 
                                          : 'border-[#39FF14] bg-[#39FF14]/10 text-green-700 border-2'
                                        : isDarkMode
                                          ? 'border-gray-700 hover:border-gray-600 text-white'
                                          : 'border-gray-300 hover:border-gray-400 text-gray-900'
                                    }`}
                                  >
                                    <div className="flex items-center gap-2">
                                      <input
                                        type="radio"
                                        checked={isSelected}
                                        onChange={() => setSelectedOption(optionNum)}
                                        className="w-4 h-4"
                                      />
                                      <span className="font-medium">{option}</span>
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                            <button
                              onClick={() => handleMakeAssertion(market.marketId)}
                              disabled={!isConnected || selectedOption === 0 || isPending || !isUMAConfigured}
                              className={`w-full py-2 px-4 rounded font-medium transition-colors ${
                                !isConnected || selectedOption === 0 || isPending || !isUMAConfigured
                                  ? (isDarkMode ? 'bg-gray-800 text-gray-500 cursor-not-allowed' : 'bg-gray-300 text-gray-500 cursor-not-allowed')
                                  : isDarkMode 
                                    ? 'bg-[#39FF14] hover:bg-[#39FF14]/80 text-black' 
                                    : 'bg-[#39FF14] hover:bg-[#39FF14]/80 text-black border border-black'
                              }`}
                            >
                              {isPending ? 'Submitting...' : 'Make Assertion'}
                            </button>
                          </div>
                        )}

                        {/* Settle Market Section - Only if assertion made */}
                        {market.umaAssertionMade && (
                          <div className={`p-4 rounded border ${
                            isDarkMode ? 'bg-gray-900 border-gray-700' : 'bg-gray-50 border-gray-200'
                          }`}>
                            <h4 className={`text-sm font-semibold mb-3 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                              Settle Market
                            </h4>
                            <div className="space-y-2 mb-4">
                              {options.map((option: string, index: number) => {
                                const optionNum = index + 1;
                                const isSelected = winningOption === optionNum.toString();
                                return (
                                  <button
                                    key={index}
                                    onClick={() => setWinningOption(optionNum.toString())}
                                    className={`w-full text-left px-4 py-3 rounded border transition-colors ${
                                      isSelected
                                        ? isDarkMode 
                                          ? 'border-[#39FF14] bg-[#39FF14]/10 text-[#39FF14]' 
                                          : 'border-[#39FF14] bg-[#39FF14]/10 text-green-700 border-2'
                                        : isDarkMode
                                          ? 'border-gray-700 hover:border-gray-600 text-white'
                                          : 'border-gray-300 hover:border-gray-400 text-gray-900'
                                    }`}
                                  >
                                    <div className="flex items-center gap-2">
                                      <input
                                        type="radio"
                                        checked={isSelected}
                                        onChange={() => setWinningOption(optionNum.toString())}
                                        className="w-4 h-4"
                                      />
                                      <span className="font-medium">{option}</span>
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                            <button
                              onClick={() => handleSettleMarket(market.marketId)}
                              disabled={!isConnected || !winningOption || isPending}
                              className={`w-full py-2 px-4 rounded font-medium transition-colors ${
                                !isConnected || !winningOption || isPending
                                  ? (isDarkMode ? 'bg-gray-800 text-gray-500 cursor-not-allowed' : 'bg-gray-300 text-gray-500 cursor-not-allowed')
                                  : isDarkMode 
                                    ? 'bg-[#39FF14] hover:bg-[#39FF14]/80 text-black' 
                                    : 'bg-[#39FF14] hover:bg-[#39FF14]/80 text-black border border-black'
                              }`}
                            >
                              {isPending ? 'Settling...' : 'Settle Market'}
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
