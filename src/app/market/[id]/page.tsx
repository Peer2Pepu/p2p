'use client';

import { useState, useEffect } from 'react';
import { useReadContract, useAccount, useWriteContract } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Sidebar } from '../../components/Sidebar';
import { useTheme } from '../../context/ThemeContext';
import Image from 'next/image';
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
  Wallet,
  Lock
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
  }
];

const VALIDATION_CORE_ABI = [
  {
    "inputs": [{"name": "verifier", "type": "address"}],
    "name": "isVerifier",
    "outputs": [{"name": "", "type": "bool"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getVerifiers",
    "outputs": [{"name": "", "type": "address[]"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getVerifierCount",
    "outputs": [{"name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {"name": "marketId", "type": "uint256"},
      {"name": "option", "type": "uint256"}
    ],
    "name": "castVote",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {"name": "marketId", "type": "uint256"},
      {"name": "option", "type": "uint256"}
    ],
    "name": "getVoteCount",
    "outputs": [{"name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {"name": "marketId", "type": "uint256"},
      {"name": "option", "type": "uint256"},
      {"name": "verifier", "type": "address"}
    ],
    "name": "hasVerifierVoted",
    "outputs": [{"name": "", "type": "bool"}],
    "stateMutability": "view",
    "type": "function"
  }
];

export default function MarketVerification({ params }: { params: Promise<{ id: string }> }) {
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
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  const MARKET_MANAGER_ADDRESS = process.env.NEXT_PUBLIC_P2P_MARKET_MANAGER_ADDRESS as `0x${string}`;
  const VALIDATION_CORE_ADDRESS = process.env.NEXT_PUBLIC_P2P_VERIFICATION_ADDRESS as `0x${string}`;

  // Fetch market data
  const { data: market, isLoading: marketLoading, error: marketError } = useReadContract({
    address: MARKET_MANAGER_ADDRESS,
    abi: MARKET_MANAGER_ABI,
    functionName: 'getMarket',
    args: marketId !== null ? [BigInt(marketId)] : [BigInt(0)],
  }) as { data: any; isLoading: boolean; error: any };


  // Check if current user is a verifier
  const { data: isUserVerifier } = useReadContract({
    address: VALIDATION_CORE_ADDRESS,
    abi: VALIDATION_CORE_ABI,
    functionName: 'isVerifier',
    args: address ? [address] : [address!],
  }) as { data: boolean | undefined };

  // Fetch vote counts for each option
  const { data: voteCount1 } = useReadContract({
    address: VALIDATION_CORE_ADDRESS,
    abi: VALIDATION_CORE_ABI,
    functionName: 'getVoteCount',
    args: marketId !== null ? [BigInt(marketId), BigInt(1)] : [BigInt(0), BigInt(1)],
  }) as { data: bigint | undefined };

  const { data: voteCount2 } = useReadContract({
    address: VALIDATION_CORE_ADDRESS,
    abi: VALIDATION_CORE_ABI,
    functionName: 'getVoteCount',
    args: marketId !== null ? [BigInt(marketId), BigInt(2)] : [BigInt(0), BigInt(2)],
  }) as { data: bigint | undefined };

  const { data: voteCount3 } = useReadContract({
    address: VALIDATION_CORE_ADDRESS,
    abi: VALIDATION_CORE_ABI,
    functionName: 'getVoteCount',
    args: marketId !== null ? [BigInt(marketId), BigInt(3)] : [BigInt(0), BigInt(3)],
  }) as { data: bigint | undefined };

  const { data: voteCount4 } = useReadContract({
    address: VALIDATION_CORE_ADDRESS,
    abi: VALIDATION_CORE_ABI,
    functionName: 'getVoteCount',
    args: marketId !== null ? [BigInt(marketId), BigInt(4)] : [BigInt(0), BigInt(4)],
  }) as { data: bigint | undefined };

  // Calculate total verification count
  const totalVerifications = (Number(voteCount1 || 0) + Number(voteCount2 || 0) + Number(voteCount3 || 0) + Number(voteCount4 || 0));

  // Check if user has voted for each option
  const { data: userVote1 } = useReadContract({
    address: VALIDATION_CORE_ADDRESS,
    abi: VALIDATION_CORE_ABI,
    functionName: 'hasVerifierVoted',
    args: marketId !== null && address ? [BigInt(marketId), BigInt(1), address] : [BigInt(0), BigInt(1), '0x0000000000000000000000000000000000000000'],
  }) as { data: boolean | undefined };

  const { data: userVote2 } = useReadContract({
    address: VALIDATION_CORE_ADDRESS,
    abi: VALIDATION_CORE_ABI,
    functionName: 'hasVerifierVoted',
    args: marketId !== null && address ? [BigInt(marketId), BigInt(2), address] : [BigInt(0), BigInt(2), '0x0000000000000000000000000000000000000000'],
  }) as { data: boolean | undefined };

  const { data: userVote3 } = useReadContract({
    address: VALIDATION_CORE_ADDRESS,
    abi: VALIDATION_CORE_ABI,
    functionName: 'hasVerifierVoted',
    args: marketId !== null && address ? [BigInt(marketId), BigInt(3), address] : [BigInt(0), BigInt(3), '0x0000000000000000000000000000000000000000'],
  }) as { data: boolean | undefined };

  const { data: userVote4 } = useReadContract({
    address: VALIDATION_CORE_ADDRESS,
    abi: VALIDATION_CORE_ABI,
    functionName: 'hasVerifierVoted',
    args: marketId !== null && address ? [BigInt(marketId), BigInt(4), address] : [BigInt(0), BigInt(4), '0x0000000000000000000000000000000000000000'],
  }) as { data: boolean | undefined };

  // Check if user has voted in this market at all
  const userVotes = [userVote1, userVote2, userVote3, userVote4];
  const hasUserVoted = userVotes.some(voted => voted);

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
    if (!selectedOption || !isConnected || !marketId || !isUserVerifier || hasUserVoted) return;

    try {
      setIsVerifying(true);
      
      writeContract({
        address: VALIDATION_CORE_ADDRESS,
        abi: VALIDATION_CORE_ABI,
        functionName: 'castVote',
        args: [BigInt(marketId!), BigInt(selectedOption)],
        gas: BigInt(500000), // Increased gas limit to prevent out of gas errors
      });

      console.log('Verification transaction submitted');
      
    } catch (error) {
      console.error('Error verifying market:', error);
      setIsVerifying(false);
    }
  };

  // Reset verification state after a delay to allow user to see the submission
  useEffect(() => {
    if (isVerifying) {
      const timer = setTimeout(() => {
        setIsVerifying(false);
      }, 3000); // Reset after 3 seconds
      
      return () => clearTimeout(timer);
    }
  }, [isVerifying]);

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

  const isMarketEnded = Number(market.state) === 1; // Ended
  const isMarketResolved = Number(market.state) === 2; // Resolved
  const options = getMarketOptions();

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
        <div className="max-w-4xl mx-auto px-3 sm:px-4 lg:px-8 py-4 sm:py-6 lg:py-8">
          {/* Market Header */}
          <div className={`rounded-xl shadow-sm p-4 sm:p-6 mb-4 sm:mb-6 border ${
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
                <p className={`text-xs sm:text-sm ${isDarkMode ? 'text-white/60' : 'text-gray-600'}`}>
                  Market ID: #{marketId}
                </p>
              </div>
              <div className="flex items-center gap-2 sm:gap-3">
                <div className={`flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm ${
                  isMarketResolved
                    ? isDarkMode ? 'bg-blue-900/40 text-blue-300' : 'bg-blue-100 text-blue-800'
                    : isMarketEnded 
                      ? isDarkMode ? 'bg-[#39FF14]/20 text-[#39FF14]' : 'bg-[#39FF14]/20 text-green-700 border border-black'
                      : isDarkMode ? 'bg-yellow-900/40 text-yellow-300' : 'bg-yellow-100 text-yellow-800'
                }`}>
                  {isMarketResolved ? <CheckCircle size={16} /> : (isMarketEnded ? <CheckCircle size={16} /> : <Clock size={16} />)}
                  <span className="hidden sm:inline">
                    {isMarketResolved ? 'Resolved' : isMarketEnded ? 'Ended' : 'Active'}
                  </span>
                  <span className="sm:hidden">
                    {isMarketResolved ? 'Res.' : isMarketEnded ? 'End' : 'Live'}
                  </span>
                </div>
                <div className={`flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm ${
                  isDarkMode ? 'bg-gray-900 text-white/70' : 'bg-gray-200 text-gray-700'
                }`}>
                  <Users size={16} />
                  <span className="hidden sm:inline">{totalVerifications} Verifications</span>
                  <span className="sm:hidden">{totalVerifications}</span>
                </div>
                {isConnected && (
                  <div className={`flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm ${
                    isUserVerifier 
                      ? isDarkMode ? 'bg-[#39FF14]/20 text-[#39FF14] border border-[#39FF14]/30' : 'bg-[#39FF14]/20 text-green-700 border border-black'
                      : isDarkMode ? 'bg-red-900/50 text-red-300' : 'bg-red-100 text-red-800'
                  }`}>
                    <Shield size={16} />
                    <span className="hidden sm:inline">{isUserVerifier ? 'Verifier' : 'Not Verifier'}</span>
                    <span className="sm:hidden">{isUserVerifier ? '✓' : '✗'}</span>
                  </div>
                )}
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
                    <div className={`text-sm sm:text-base leading-relaxed whitespace-pre-wrap ${isDarkMode ? 'text-white/70' : 'text-gray-600'}`}>
                      {marketMetadata.vanityInfo.split('\n').map((line: string, idx: number) => {
                        // Check if line is a URL
                        const urlPattern = /(https?:\/\/[^\s]+)/g;
                        const parts = line.split(urlPattern);
                        return (
                          <div key={idx}>
                            {parts.map((part, partIdx) => {
                              if (urlPattern.test(part)) {
                                return (
                                  <a
                                    key={partIdx}
                                    href={part}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={`underline hover:opacity-80 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}
                                  >
                                    {part}
                                  </a>
                                );
                              }
                              return <span key={partIdx}>{part}</span>;
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

          {/* Verification Section */}
          <div className={`rounded-xl shadow-sm p-4 sm:p-6 border ${
            isDarkMode ? 'bg-black border-gray-800' : 'bg-[#F5F3F0] border-gray-300'
          }`}>
            <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
              <Shield className={`${isDarkMode ? 'text-[#39FF14]' : 'text-emerald-600'}`} size={24} />
              <h2 className={`text-lg sm:text-xl font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                Verify Market Outcome
              </h2>
            </div>
            
            {!isConnected ? (
              <div className="text-center py-6 sm:py-8">
                <div className={`w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-3 sm:mb-4 rounded-full flex items-center justify-center ${
                  isDarkMode ? 'bg-gray-900' : 'bg-gray-200'
                }`}>
                  <Target className={`${isDarkMode ? 'text-white' : 'text-gray-600'}`} size={32} />
                </div>
                <p className={`mb-4 text-sm sm:text-base ${isDarkMode ? 'text-white/70' : 'text-gray-600'}`}>
                  Please connect your wallet to verify this market
                </p>
                <div className="scale-90 sm:scale-100">
                  <ConnectButton />
                </div>
              </div>
            ) : !isUserVerifier ? (
              <div className="text-center py-6 sm:py-8">
                <div className={`w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-3 sm:mb-4 rounded-full flex items-center justify-center ${
                  isDarkMode ? 'bg-red-900/50' : 'bg-red-100'
                }`}>
                  <Lock className={`${isDarkMode ? 'text-red-300' : 'text-red-600'}`} size={32} />
                </div>
                <h3 className={`text-lg font-semibold mb-2 ${isDarkMode ? 'text-red-300' : 'text-red-800'}`}>
                  Access Denied
                </h3>
                <p className={`mb-4 text-sm sm:text-base ${isDarkMode ? 'text-red-300' : 'text-red-600'}`}>
                  Only verified verifiers can vote on market outcomes
                </p>
                <p className={`text-xs ${isDarkMode ? 'text-white/60' : 'text-gray-600'}`}>
                  Your address: {address?.slice(0, 6)}...{address?.slice(-4)}
                </p>
              </div>
            ) : isMarketResolved ? (
              <div className="text-center py-6 sm:py-8">
                <div className={`w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-3 sm:mb-4 rounded-full flex items-center justify-center ${
                  isDarkMode ? 'bg-blue-900/50' : 'bg-blue-100'
                }`}>
                  <CheckCircle className={`${isDarkMode ? 'text-blue-300' : 'text-blue-700'}`} size={32} />
                </div>
                <h3 className={`text-lg font-semibold mb-2 ${isDarkMode ? 'text-blue-200' : 'text-blue-800'}`}>
                  Market Resolved
                </h3>
                <p className={`mb-4 text-sm sm:text-base ${isDarkMode ? 'text-white/70' : 'text-gray-600'}`}>
                  This market has been resolved. Verifications are closed.
                </p>
              </div>
            ) : !isMarketEnded ? (
              <div className="text-center py-6 sm:py-8">
                <div className={`w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-3 sm:mb-4 rounded-full flex items-center justify-center ${
                  isDarkMode ? 'bg-gray-900' : 'bg-gray-200'
                }`}>
                  <Clock className={`${isDarkMode ? 'text-white' : 'text-gray-600'}`} size={32} />
                </div>
                <p className={`mb-4 text-sm sm:text-base ${isDarkMode ? 'text-white/70' : 'text-gray-600'}`}>
                  This market is still active and cannot be verified yet.
                </p>
              </div>
            ) : (
              <div>
                <p className={`mb-4 sm:mb-6 text-sm sm:text-base ${isDarkMode ? 'text-white/70' : 'text-gray-600'}`}>
                  Select the winning option for this market:
                </p>
                
                <div className="space-y-2 sm:space-y-3 mb-4 sm:mb-6">
                  {options.map((option: string, index: number) => {
                    const voteCounts = [Number(voteCount1 || 0), Number(voteCount2 || 0), Number(voteCount3 || 0), Number(voteCount4 || 0)];
                    const currentVoteCount = voteCounts[index] || 0;
                    const userVotedForThis = userVotes[index] || false;
                    
                    return (
                      <label
                        key={index}
                        className={`flex items-center justify-between p-3 sm:p-4 border rounded-lg transition-colors ${
                          hasUserVoted 
                            ? 'cursor-not-allowed opacity-60'
                            : 'cursor-pointer'
                        } ${
                          selectedOption === index + 1
                            ? isDarkMode 
                              ? 'border-[#39FF14] bg-[#39FF14]/10' 
                              : 'border-[#39FF14] bg-[#39FF14]/10 border-2 border-black'
                            : isDarkMode
                              ? 'border-gray-800 hover:bg-gray-900'
                              : 'border-gray-400 hover:bg-gray-200'
                        }`}
                      >
                        <div className="flex items-center">
                          <input
                            type="radio"
                            name="option"
                            value={index + 1}
                            checked={selectedOption === index + 1}
                            onChange={() => !hasUserVoted && setSelectedOption(index + 1)}
                            disabled={hasUserVoted}
                            className="mr-2 sm:mr-3"
                          />
                          <span className={`font-medium text-sm sm:text-base ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                            {option}
                          </span>
                          {userVotedForThis && (
                            <span className={`ml-2 text-xs px-2 py-1 rounded-full ${
                              isDarkMode ? 'bg-[#39FF14]/20 text-[#39FF14]' : 'bg-green-100 text-green-800'
                            }`}>
                              ✓ Voted
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-medium ${isDarkMode ? 'text-white/60' : 'text-gray-600'}`}>
                            {currentVoteCount} votes
                          </span>
                        </div>
                      </label>
                    );
                  })}
                </div>

                <button
                  onClick={handleVerify}
                  className={`w-full py-2 sm:py-3 px-4 sm:px-6 rounded-lg font-medium text-sm sm:text-base transition-colors flex items-center justify-center gap-2 ${
                    !selectedOption || isVerifying || hasUserVoted
                      ? isDarkMode 
                        ? 'bg-gray-800 text-gray-500 cursor-not-allowed' 
                        : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : isDarkMode
                        ? 'bg-[#39FF14] hover:bg-[#39FF14]/80 text-black'
                        : 'bg-[#39FF14] hover:bg-[#39FF14]/80 text-black border border-black'
                  }`}
                  disabled={!selectedOption || isVerifying || hasUserVoted}
                >
                  {isVerifying && (
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                  )}
                  {isVerifying ? 'Submitting...' : hasUserVoted ? 'Already Voted' : 'Submit Verification'}
                </button>
              </div>
            )}
          </div>

          {/* Market Details */}
          <div className={`rounded-xl shadow-sm p-4 sm:p-6 mt-4 sm:mt-6 border ${
            isDarkMode ? 'bg-black border-gray-800' : 'bg-[#F5F3F0] border-gray-300'
          }`}>
            <h3 className={`text-base sm:text-lg font-semibold mb-3 sm:mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              Market Details
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 text-xs sm:text-sm">
              <div>
                <span className={isDarkMode ? 'text-white/60' : 'text-gray-600'}>End Time:</span>
                <p className={`font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  {new Date(Number(market.endTime) * 1000).toLocaleString()}
                </p>
              </div>
              <div>
                <span className={isDarkMode ? 'text-white/60' : 'text-gray-600'}>State:</span>
                <p className={`font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
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