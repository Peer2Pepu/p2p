"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { 
  Target, 
  Clock, 
  Users, 
  Award, 
  CheckCircle, 
  AlertCircle,
  TrendingUp,
  DollarSign,
  Calendar,
  User,
  ChevronDown,
  ChevronUp,
  Vote,
  Trophy,
  Sun,
  Moon,
  Wallet,
  Activity,
  Eye,
  Check,
  Menu
} from 'lucide-react';
import { HeaderWallet } from '@/components/HeaderWallet';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { formatEther } from 'viem';
import { Sidebar } from '../components/Sidebar';
import { useTheme } from '../context/ThemeContext';

// Contract addresses
const MARKET_MANAGER_ADDRESS = process.env.NEXT_PUBLIC_P2P_MARKET_MANAGER_ADDRESS as `0x${string}`;
const VERIFICATION_ADDRESS = process.env.NEXT_PUBLIC_P2P_VERIFICATION_ADDRESS as `0x${string}`;
const ANALYTICS_ADDRESS = process.env.NEXT_PUBLIC_P2P_ANALYTICS_ADDRESS as `0x${string}`;

// Type definitions
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
  endTime: bigint;
  resolutionEndTime: bigint;
  state: number;
  winningOption: bigint;
  isResolved: boolean;
}

// Contract ABIs
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
    "inputs": [{"name": "marketId", "type": "uint256"}],
    "name": "getMarketInfo",
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
          {"name": "endTime", "type": "uint256"},
          {"name": "resolutionEndTime", "type": "uint256"},
          {"name": "state", "type": "uint8"},
          {"name": "winningOption", "type": "uint256"},
          {"name": "isResolved", "type": "bool"}
        ],
        "name": "market",
        "type": "tuple"
      },
      {"name": "totalPool", "type": "uint256"},
      {"name": "supportPool", "type": "uint256"},
      {"name": "bettorCount", "type": "uint256"},
      {"name": "supporterCount", "type": "uint256"},
      {"name": "bettors", "type": "address[]"},
      {"name": "supporters", "type": "address[]"},
      {"name": "tokenSymbol", "type": "string"}
    ],
    "stateMutability": "view",
    "type": "function"
  },
];

const VERIFICATION_ABI = [
  {
    "inputs": [{"name": "verifier", "type": "address"}],
    "name": "isVerifier",
    "outputs": [{"name": "", "type": "bool"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"name": "marketId", "type": "uint256"}, {"name": "option", "type": "uint256"}],
    "name": "getVoteCount",
    "outputs": [{"name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"name": "marketId", "type": "uint256"}, {"name": "option", "type": "uint256"}],
    "name": "castVote",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{"name": "marketId", "type": "uint256"}, {"name": "option", "type": "uint256"}, {"name": "verifier", "type": "address"}],
    "name": "hasVerifierVoted",
    "outputs": [{"name": "", "type": "bool"}],
    "stateMutability": "view",
    "type": "function"
  }
];

const ANALYTICS_ABI = [
  {
    "inputs": [{"name": "state", "type": "uint8"}],
    "name": "getMarketsByState",
    "outputs": [{"name": "", "type": "uint256[]"}],
    "stateMutability": "view",
    "type": "function"
  }
];

// Professional Market Resolution Card Component
function MarketResolutionCard({ marketId, isDarkMode, onVote }: {
  marketId: number;
  isDarkMode: boolean;
  onVote: (marketId: number, option: number) => void;
}) {
  const [selectedOption, setSelectedOption] = useState(0);
  const [marketMetadata, setMarketMetadata] = useState<any>(null);
  const [loadingMetadata, setLoadingMetadata] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  // Fetch market data
  const { data: market } = useReadContract({
    address: MARKET_MANAGER_ADDRESS,
    abi: MARKET_MANAGER_ABI,
    functionName: 'getMarket',
    args: [BigInt(marketId)],
  }) as { data: MarketData | undefined };

  const { data: marketInfo } = useReadContract({
    address: MARKET_MANAGER_ADDRESS,
    abi: MARKET_MANAGER_ABI,
    functionName: 'getMarketInfo',
    args: [BigInt(marketId)],
  });

  // Get token symbol
  const { data: tokenSymbol } = useReadContract({
    address: MARKET_MANAGER_ADDRESS,
    abi: [
      {
        "inputs": [{"name": "token", "type": "address"}],
        "name": "tokenSymbols",
        "outputs": [{"name": "", "type": "string"}],
        "stateMutability": "view",
        "type": "function"
      }
    ],
    functionName: 'tokenSymbols',
    args: [market?.paymentToken || '0x0000000000000000000000000000000000000000'],
  });

  // Only get basic market info for voting - no betting data needed

  // Get vote counts
  const { data: voteCount1 } = useReadContract({
    address: VERIFICATION_ADDRESS,
    abi: VERIFICATION_ABI,
    functionName: 'getVoteCount',
    args: [BigInt(marketId), BigInt(1)],
  });

  const { data: voteCount2 } = useReadContract({
    address: VERIFICATION_ADDRESS,
    abi: VERIFICATION_ABI,
    functionName: 'getVoteCount',
    args: [BigInt(marketId), BigInt(2)],
  });

  const { data: voteCount3 } = useReadContract({
    address: VERIFICATION_ADDRESS,
    abi: VERIFICATION_ABI,
    functionName: 'getVoteCount',
    args: [BigInt(marketId), BigInt(3)],
  });

  const { data: voteCount4 } = useReadContract({
    address: VERIFICATION_ADDRESS,
    abi: VERIFICATION_ABI,
    functionName: 'getVoteCount',
    args: [BigInt(marketId), BigInt(4)],
  });

  // Get user votes
  const { address: userAddress } = useAccount();
  const { data: userVote1 } = useReadContract({
    address: VERIFICATION_ADDRESS,
    abi: VERIFICATION_ABI,
    functionName: 'hasVerifierVoted',
    args: [BigInt(marketId), BigInt(1), userAddress || '0x0000000000000000000000000000000000000000'],
  });

  const { data: userVote2 } = useReadContract({
    address: VERIFICATION_ADDRESS,
    abi: VERIFICATION_ABI,
    functionName: 'hasVerifierVoted',
    args: [BigInt(marketId), BigInt(2), userAddress || '0x0000000000000000000000000000000000000000'],
  });

  const { data: userVote3 } = useReadContract({
    address: VERIFICATION_ADDRESS,
    abi: VERIFICATION_ABI,
    functionName: 'hasVerifierVoted',
    args: [BigInt(marketId), BigInt(3), userAddress || '0x0000000000000000000000000000000000000000'],
  });

  const { data: userVote4 } = useReadContract({
    address: VERIFICATION_ADDRESS,
    abi: VERIFICATION_ABI,
    functionName: 'hasVerifierVoted',
    args: [BigInt(marketId), BigInt(4), userAddress || '0x0000000000000000000000000000000000000000'],
  });

  // Fetch IPFS metadata
  useEffect(() => {
    const marketData = market as any;
    if (market && marketData.ipfsHash && !marketMetadata && !loadingMetadata) {
      setLoadingMetadata(true);
      const fetchMetadata = async () => {
        try {
          const ipfsHash = marketData.ipfsHash;
          const gatewayUrl = `https://gateway.lighthouse.storage/ipfs/${ipfsHash}`;
          
          const response = await fetch(gatewayUrl);
          if (response.ok) {
            const metadata = await response.json();
            setMarketMetadata(metadata);
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

  if (!market || !marketInfo) {
    return (
      <div className={`rounded-lg border p-4 ${isDarkMode ? 'bg-black border-gray-800' : 'bg-[#F5F3F0] border-gray-300'}`}>
        <div className="animate-pulse">
          <div className={`h-4 rounded mb-2 ${isDarkMode ? 'bg-gray-800' : 'bg-gray-300'}`}></div>
          <div className={`h-3 rounded mb-3 ${isDarkMode ? 'bg-gray-800' : 'bg-gray-300'}`}></div>
          <div className="flex justify-between">
            <div className={`h-6 w-20 rounded ${isDarkMode ? 'bg-gray-800' : 'bg-gray-300'}`}></div>
            <div className={`h-6 w-16 rounded ${isDarkMode ? 'bg-gray-800' : 'bg-gray-300'}`}></div>
          </div>
        </div>
      </div>
    );
  }

  const marketData = market;

  const getMarketTitle = () => {
    if (loadingMetadata) return 'Loading...';
    if (marketMetadata?.title) return marketMetadata.title;
    return `Market #${marketId}`;
  };

  const getMarketDescription = () => {
    if (loadingMetadata) return 'Loading...';
    if (marketMetadata?.description) return marketMetadata.description;
    return marketData.isMultiOption ? 'Multiple choice market' : 'Yes/No market';
  };

  const getMarketOptions = () => {
    if (marketMetadata?.options && Array.isArray(marketMetadata.options)) {
      return marketMetadata.options;
    }
    return ['Yes', 'No'];
  };

  const formatTokenAmount = (amount: string) => {
    try {
      const num = parseFloat(amount);
      if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
      if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
      return num.toFixed(2);
    } catch {
      return '0';
    }
  };

  const voteCounts: bigint[] = [
    (voteCount1 as bigint) || BigInt(0),
    (voteCount2 as bigint) || BigInt(0),
    (voteCount3 as bigint) || BigInt(0),
    (voteCount4 as bigint) || BigInt(0)
  ];

  const userVotes = [userVote1, userVote2, userVote3, userVote4];
  const hasVotedInMarket = userVotes.some(voted => voted);
  const totalVotes = voteCounts.reduce((sum, count) => sum + Number(count), 0);
  const requiredQuorum = 3;

  return (
    <div className={`border rounded-lg overflow-hidden transition-all duration-200 hover:shadow-md ${
      isDarkMode ? 'bg-black border-gray-800 hover:shadow-gray-900/20' : 'bg-[#F5F3F0] border-gray-300 hover:shadow-gray-900/10'
    }`}>
      {/* Header */}
      <div className={`p-4 border-b ${isDarkMode ? 'border-gray-800' : 'border-gray-300'}`}>
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0 pr-4">
            <div className="flex items-center gap-2 mb-1">
              <h3 className={`font-semibold text-sm ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                {getMarketTitle()}
              </h3>
              {hasVotedInMarket && <Check size={14} className={`flex-shrink-0 ${isDarkMode ? 'text-[#39FF14]' : 'text-green-500'}`} />}
            </div>
            <p className={`text-xs leading-tight ${isDarkMode ? 'text-white/70' : 'text-gray-600'}`}>
              {getMarketDescription()}
            </p>
          </div>
          
          <div className="flex flex-col items-end text-right flex-shrink-0">
            <div className={`text-sm font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              Verifier Votes
            </div>
            <div className="flex items-center gap-3 text-xs text-gray-500">
              <div className="flex items-center gap-1">
                <Vote size={10} />
                <span>{totalVotes}/{requiredQuorum}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Description and Vanity Info Section */}
      {(marketMetadata?.description || marketMetadata?.vanityInfo) && (
        <div className={`p-4 border-b ${isDarkMode ? 'border-gray-800 bg-gray-900/50' : 'border-gray-300 bg-gray-200'}`}>
          {marketMetadata?.description && (
            <div className="mb-3">
              <h4 className={`text-xs font-semibold mb-1 ${isDarkMode ? 'text-white' : 'text-gray-700'}`}>
                Description
              </h4>
              <p className={`text-xs leading-relaxed ${isDarkMode ? 'text-white/70' : 'text-gray-600'}`}>
                {marketMetadata.description}
              </p>
            </div>
          )}
          {marketMetadata?.vanityInfo && (
            <div>
              <h4 className={`text-xs font-semibold mb-1 ${isDarkMode ? 'text-white' : 'text-gray-700'}`}>
                Resources & Links
              </h4>
              <div className={`text-xs leading-relaxed whitespace-pre-wrap ${isDarkMode ? 'text-white/70' : 'text-gray-600'}`}>
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

      {/* Voting Section */}
      <div className="p-4">
        <div className="grid gap-2">
          {getMarketOptions().map((option: string, index: number) => {
            const voteCount = Number(voteCounts[index] || 0);
            const hasVoted = userVotes[index] || false;
            const isSelected = selectedOption === index + 1;
            const isQuorumReached = voteCount >= requiredQuorum;
            
            return (
              <div
                key={index}
                className={`flex items-center justify-between p-2 rounded border text-sm transition-colors cursor-pointer hover:bg-opacity-50 ${
                  isSelected
                    ? (isDarkMode ? 'border-[#39FF14] bg-[#39FF14]/10' : 'border-[#39FF14] bg-[#39FF14]/10 border-2 border-black')
                    : (isDarkMode ? 'border-gray-800 hover:bg-gray-900' : 'border-gray-400 hover:bg-gray-200')
                }`}
                onClick={() => !hasVotedInMarket && setSelectedOption(index + 1)}
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <input
                    type="radio"
                    name={`option-${marketId}`}
                    value={index + 1}
                    checked={isSelected}
                    onChange={() => !hasVotedInMarket && setSelectedOption(index + 1)}
                    disabled={hasVotedInMarket}
                    className="w-3 h-3 flex-shrink-0"
                  />
                  <span className={`font-medium truncate ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    {option}
                  </span>
                  {hasVoted && <Check size={12} className={`flex-shrink-0 ${isDarkMode ? 'text-[#39FF14]' : 'text-green-500'}`} />}
                </div>
                
                <div className="flex items-center gap-2 text-xs">
                  <span className={`font-medium ${isQuorumReached ? (isDarkMode ? 'text-[#39FF14]' : 'text-green-500') : (isDarkMode ? 'text-white/60' : 'text-gray-600')}`}>
                    {voteCount}
                  </span>
                  {isQuorumReached && <CheckCircle size={12} className={isDarkMode ? 'text-[#39FF14]' : 'text-green-500'} />}
                </div>
              </div>
            );
          })}
        </div>

        {/* Action Button */}
        <div className="mt-3 flex gap-2">
          <button
            onClick={() => onVote(marketId, selectedOption)}
            disabled={selectedOption === 0 || hasVotedInMarket}
            className={`flex-1 py-1.5 px-3 rounded text-sm font-medium transition-colors ${
              selectedOption === 0 || hasVotedInMarket
                ? (isDarkMode ? 'bg-gray-800 text-gray-500 cursor-not-allowed' : 'bg-gray-300 text-gray-500 cursor-not-allowed')
                : isDarkMode 
                  ? 'bg-[#39FF14] hover:bg-[#39FF14]/80 text-black' 
                  : 'bg-[#39FF14] hover:bg-[#39FF14]/80 text-black border border-black'
            }`}
          >
            {hasVotedInMarket ? 'Voted' : 'Vote'}
          </button>
          
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className={`px-2 py-1.5 rounded text-sm transition-colors ${
              isDarkMode ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-600'
            }`}
          >
            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>

        {/* Expanded Details */}
        {isExpanded && (
          <div className={`mt-3 pt-3 border-t text-xs space-y-2 ${isDarkMode ? 'border-gray-800' : 'border-gray-300'}`}>
            <div className="flex justify-between">
              <span className={isDarkMode ? 'text-white/60' : 'text-gray-600'}>Market ID</span>
              <span className={isDarkMode ? 'text-white' : 'text-gray-900'}>#{marketId}</span>
            </div>
            <div className="flex justify-between">
              <span className={isDarkMode ? 'text-white/60' : 'text-gray-600'}>Verifier Votes</span>
              <span className={isDarkMode ? 'text-white' : 'text-gray-900'}>{totalVotes} / {requiredQuorum} required</span>
            </div>
            <div className="flex justify-between">
              <span className={isDarkMode ? 'text-white/60' : 'text-gray-600'}>Creator</span>
              <span className={`font-mono ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                {marketData.creator.slice(0, 6)}...{marketData.creator.slice(-4)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className={isDarkMode ? 'text-white/60' : 'text-gray-600'}>End Time</span>
              <span className={isDarkMode ? 'text-white' : 'text-gray-900'}>
                {new Date(Number(marketData.endTime) * 1000).toLocaleDateString()}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Main Resolve Page Component
export default function ResolvePage() {
  const { isDarkMode, toggleTheme } = useTheme();
  const { address, isConnected } = useAccount();
  const { writeContract } = useWriteContract();
  const { data: hash, isPending, error: txError } = useWaitForTransactionReceipt();

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Sidebar state
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const onSidebarClose = () => setSidebarOpen(false);
  const onToggleCollapse = () => setSidebarCollapsed(!sidebarCollapsed);

  // Check if user is a verifier
  const { data: isVerifier } = useReadContract({
    address: VERIFICATION_ADDRESS,
    abi: VERIFICATION_ABI,
    functionName: 'isVerifier',
    args: [address || '0x0000000000000000000000000000000000000000'],
  });

  // Fetch ended markets (state 1 = Ended, not yet resolved)
  const { data: endedMarketIds } = useReadContract({
    address: ANALYTICS_ADDRESS,
    abi: ANALYTICS_ABI,
    functionName: 'getMarketsByState',
    args: [BigInt(1)], // State 1 = Ended (needs resolution)
  });

  const handleVote = async (marketId: number, option: number) => {
    if (!isConnected || !address) {
      setError('Please connect your wallet');
      return;
    }

    if (!isVerifier) {
      setError('Only verifiers can vote');
      return;
    }

    try {
      await writeContract({
        address: VERIFICATION_ADDRESS,
        abi: VERIFICATION_ABI,
        functionName: 'castVote',
        args: [BigInt(marketId), BigInt(option)],
      });
      setSuccess(`Vote cast successfully for Market #${marketId}`);
    } catch (err: any) {
      if (err.message?.includes('already voted') || err.message?.includes('Already voted')) {
        setError('You have already voted in this market');
      } else {
        setError(err.message || 'Failed to cast vote');
      }
    }
  };

  // Clear messages after 5 seconds
  useEffect(() => {
    if (success || error) {
      const timer = setTimeout(() => {
        setSuccess('');
        setError('');
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [success, error]);

  return (
    <div className={`min-h-screen ${isDarkMode ? 'bg-black' : 'bg-[#F5F3F0]'}`}>
      {/* Sidebar */}
      <Sidebar 
        isOpen={sidebarOpen} 
        onClose={onSidebarClose} 
        collapsed={sidebarCollapsed}
        onToggleCollapse={onToggleCollapse}
        isDarkMode={isDarkMode}
      />

      {/* Main Content */}
      <div className={`transition-all duration-300 lg:${sidebarCollapsed ? 'ml-16' : 'ml-64'}`}>
        {/* Header */}
        <header className={`sticky top-0 z-30 border-b backdrop-blur-sm ${isDarkMode ? 'bg-black border-[#39FF14]/20' : 'bg-[#F5F3F0] border-gray-200'}`}>
          <div className="px-4 lg:px-6 py-1.5 lg:py-2">
            <div className="flex items-center justify-between">
              {/* Left: Menu + Logo + Title */}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setSidebarOpen(true)}
                  className={`lg:hidden p-2 rounded-lg transition-colors ${isDarkMode ? 'hover:bg-[#39FF14]/10 text-white' : 'hover:bg-gray-200'}`}
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
                
                <div className="hidden lg:block">
                  <h1 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    Market Resolution
                  </h1>
                  <p className={`text-sm ${isDarkMode ? 'text-white/70' : 'text-gray-600'}`}>
                    Vote to resolve ended prediction markets
                  </p>
                </div>
              </div>
              
              {/* Right: Stats + Verifier Status + Theme + Wallet */}
              <div className="flex items-center gap-2 lg:gap-4">
                {/* Stats Summary */}
                <div className="hidden md:flex items-center gap-6 text-sm">
                  <div className="text-center">
                    <div className={`font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                      {Array.isArray(endedMarketIds) ? endedMarketIds.length : 0}
                    </div>
                    <div className={isDarkMode ? 'text-white/60' : 'text-gray-600'}>Markets</div>
                  </div>
                </div>

                {/* Verifier Status */}
                <div className={`px-2 lg:px-3 py-1 rounded-full text-xs lg:text-sm font-medium ${
                  isVerifier 
                    ? (isDarkMode ? 'bg-[#39FF14]/20 text-[#39FF14] border border-[#39FF14]/30' : 'bg-[#39FF14]/20 text-green-700 border border-black')
                    : (isDarkMode ? 'bg-red-900/50 text-red-300 border border-red-700' : 'bg-red-50 text-red-700 border border-red-200')
                }`}>
                  <div className="flex items-center gap-1 lg:gap-2">
                    {isVerifier ? <CheckCircle size={12} className="lg:w-3.5 lg:h-3.5" /> : <AlertCircle size={12} className="lg:w-3.5 lg:h-3.5" />}
                    <span className="hidden sm:inline">{isVerifier ? 'Verified Resolver' : 'Not Authorized'}</span>
                    <span className="sm:hidden">{isVerifier ? 'Verified' : 'Unauthorized'}</span>
                  </div>
                </div>
                
                <button
                  onClick={toggleTheme}
                  className={`p-1.5 lg:p-2 rounded-lg transition-colors ${isDarkMode ? 'hover:bg-[#39FF14]/10 text-white' : 'hover:bg-gray-200'}`}
                >
                  {isDarkMode ? <Sun className="w-4 h-4 lg:w-5 lg:h-5 text-white" /> : <Moon className="w-4 h-4 lg:w-5 lg:h-5 text-gray-600" />}
                </button>
                
                {/* Wallet Connection */}
                <HeaderWallet isDarkMode={isDarkMode} />
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="p-4 lg:p-6">
          {/* Alert Messages */}
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

          {/* Authorization Warning */}
          {!isVerifier && isConnected && (
            <div className={`mb-6 p-4 rounded-lg border flex items-start gap-3 ${
              isDarkMode ? 'bg-yellow-900/20 border-yellow-800 text-yellow-300' : 'bg-yellow-50 border-yellow-200 text-yellow-800'
            }`}>
              <AlertCircle size={20} className="flex-shrink-0 mt-0.5" />
              <div>
                <div className="font-medium mb-1">Verification Required</div>
                <p className="text-sm opacity-90">
                  You need to be a verified resolver to vote on market outcomes. Contact an administrator to request verification access.
                </p>
              </div>
            </div>
          )}

          {/* Markets Grid */}
          {!Array.isArray(endedMarketIds) || endedMarketIds.length === 0 ? (
            <div className="text-center py-16">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${
                isDarkMode ? 'bg-gray-900' : 'bg-gray-200'
              }`}>
                <Target className={`w-8 h-8 ${isDarkMode ? 'text-white' : 'text-gray-500'}`} />
              </div>
              <h3 className={`text-lg font-semibold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                No Markets Available
              </h3>
              <p className={`text-sm ${isDarkMode ? 'text-white/70' : 'text-gray-600'}`}>
                All markets are either still active or have already been resolved.
              </p>
            </div>
          ) : (
            <>
              {/* Header Info */}
              <div className="mb-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                      Markets Awaiting Resolution
                    </h2>
                    <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                      {endedMarketIds.length} market{endedMarketIds.length !== 1 ? 's' : ''} ready for community verification
                    </p>
                  </div>
                  
                  <div className={`text-sm px-3 py-1 rounded-full ${
                    isDarkMode ? 'bg-[#39FF14]/20 text-[#39FF14] border border-[#39FF14]/30' : 'bg-[#39FF14]/20 text-green-700 border border-black'
                  }`}>
                    3 votes required for resolution
                  </div>
                </div>
              </div>

              {/* Markets List */}
              <div className="grid gap-3 lg:gap-4 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3">
                {endedMarketIds.map((marketId: bigint) => (
                  <MarketResolutionCard
                    key={Number(marketId)}
                    marketId={Number(marketId)}
                    isDarkMode={isDarkMode}
                    onVote={handleVote}
                  />
                ))}
              </div>

              {/* Footer Info */}
              <div className={`mt-8 p-4 rounded-lg border ${
                isDarkMode ? 'bg-gray-900/50 border-gray-800' : 'bg-gray-200 border-gray-300'
              }`}>
                <div className="flex items-start gap-3">
                  <Activity size={20} className={`flex-shrink-0 mt-0.5 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`} />
                  <div>
                    <h4 className={`font-medium mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                      How Resolution Works
                    </h4>
                    <ul className={`text-sm space-y-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                      <li>• Verified resolvers vote on the winning option for each market</li>
                      <li>• 3 votes are required to reach quorum and automatically resolve the market</li>
                      <li>• You can only vote once per market, so choose carefully</li>
                      <li>• Resolved markets will distribute winnings to correct predictors</li>
                    </ul>
                  </div>
                </div>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}