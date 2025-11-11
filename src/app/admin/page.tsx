'use client';

import { useState, useEffect, useMemo } from 'react';
import { 
  Users, 
  DollarSign, 
  Timer, 
  AlertCircle, 
  CheckCircle,
  Trash2, 
  X,
  Menu,
  Wallet,
  Sun,
  Moon,
  Tag,
  Hash,
  Loader2,
  Coins,
  Plus
} from 'lucide-react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, useDisconnect } from 'wagmi';
import { formatEther } from 'viem';
import { ethers } from 'ethers';
import { Sidebar } from '../components/Sidebar';
import { useTheme } from '../context/ThemeContext';
import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';
import Image from 'next/image';

// Supabase client
const supabase = createClient(
  `https://${process.env.NEXT_PUBLIC_SUPABASE_PROJECT_ID}.supabase.co`,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

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

// AdminManager Contract ABI
const ADMIN_MANAGER_ABI = [
  {
    "inputs": [{"name": "wallet", "type": "address"}, {"name": "blacklisted", "type": "bool"}],
    "name": "setWalletBlacklist",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getBlacklistedAddresses",
    "outputs": [{"name": "", "type": "address[]"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"name": "wallet", "type": "address"}],
    "name": "isWalletBlacklisted",
    "outputs": [{"name": "", "type": "bool"}],
    "stateMutability": "view",
    "type": "function"
  }
];

// ValidationCore Contract ABI for verifier management
const VALIDATION_CORE_ABI = [
  {
    "inputs": [{"name": "verifier", "type": "address"}],
    "name": "addVerifier",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{"name": "verifier", "type": "address"}],
    "name": "removeVerifier",
    "outputs": [],
    "stateMutability": "nonpayable",
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
    "inputs": [{"name": "verifier", "type": "address"}],
    "name": "isVerifier",
    "outputs": [{"name": "", "type": "bool"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "MAX_VERIFIERS",
    "outputs": [{"name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "REQUIRED_QUORUM",
    "outputs": [{"name": "", "type": "uint256"}],
    "stateMutability": "view",
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
        const adminExceptionAddress = '0x613553A2C83E8b90dc755297c89D06BA673e695f';
        
        setIsOwner(address.toLowerCase() === ownerAddress?.toLowerCase());
        setIsPartner(address.toLowerCase() === partnerAddress?.toLowerCase() || address.toLowerCase() === adminExceptionAddress.toLowerCase());
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
function MarketSearch({ 
  isDarkMode, 
  blacklistAddress, 
  setBlacklistAddress, 
  isBlacklisting, 
  removeAddress, 
  setRemoveAddress, 
  isRemoving, 
  userManagementSuccess, 
  handleBlacklistUser, 
  handleRemoveUser 
}: { 
  isDarkMode: boolean;
  blacklistAddress: string;
  setBlacklistAddress: (value: string) => void;
  isBlacklisting: boolean;
  removeAddress: string;
  setRemoveAddress: (value: string) => void;
  isRemoving: boolean;
  userManagementSuccess: string;
  handleBlacklistUser: () => void;
  handleRemoveUser: () => void;
}) {
  const [searchId, setSearchId] = useState('');
  const [searchedMarketId, setSearchedMarketId] = useState<number | null>(null);
  const [marketData, setMarketData] = useState<any>(null);
  const [marketMetadata, setMarketMetadata] = useState<any>(null);
  const [searchError, setSearchError] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [supportAmount, setSupportAmount] = useState('');
  const [isSupporting, setIsSupporting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteReason, setDeleteReason] = useState('');
  const [deleteSuccess, setDeleteSuccess] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [isPermanentlyDeleting, setIsPermanentlyDeleting] = useState(false);
  const [creatorLabel, setCreatorLabel] = useState<string>('');

  const ADMIN_MANAGER_ADDRESS = process.env.NEXT_PUBLIC_P2P_ADMIN_ADDRESS as `0x${string}`;
  const marketManagerAddress = process.env.NEXT_PUBLIC_P2P_MARKET_MANAGER_ADDRESS as `0x${string}`;
  const { writeContract } = useWriteContract();
  const { address: userAddress } = useAccount();

  // Get token symbol from AdminManager contract
  const { data: tokenSymbol } = useReadContract({
    address: process.env.NEXT_PUBLIC_P2P_ADMIN_ADDRESS as `0x${string}`,
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
    args: marketData?.paymentToken ? [marketData.paymentToken] : undefined,
  });

  // Get support pool for this market
  const { data: supportPool } = useReadContract({
    address: marketManagerAddress,
    abi: [
      {
        "inputs": [{"name": "marketId", "type": "uint256"}, {"name": "token", "type": "address"}],
        "name": "getSupportPool",
        "outputs": [{"name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function"
      }
    ],
    functionName: 'getSupportPool',
    args: searchedMarketId && marketData?.paymentToken ? [BigInt(searchedMarketId), marketData.paymentToken] : undefined,
    query: {
      enabled: !!(searchedMarketId && marketData?.paymentToken)
    }
  }) as { data: bigint | undefined };

  // Get option pools (up to 4 like main page)
  const { data: option1Pool } = useReadContract({
    address: marketManagerAddress,
    abi: [
      {
        "inputs": [{"name": "marketId", "type": "uint256"}, {"name": "option", "type": "uint256"}, {"name": "token", "type": "address"}],
        "name": "getOptionPool",
        "outputs": [{"name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function"
      }
    ],
    functionName: 'getOptionPool',
    args: searchedMarketId && marketData?.paymentToken ? [BigInt(searchedMarketId), BigInt(1), marketData.paymentToken] : undefined,
    query: { enabled: !!(searchedMarketId && marketData?.paymentToken) }
  });

  const { data: option2Pool } = useReadContract({
    address: marketManagerAddress,
    abi: [
      {
        "inputs": [{"name": "marketId", "type": "uint256"}, {"name": "option", "type": "uint256"}, {"name": "token", "type": "address"}],
        "name": "getOptionPool",
        "outputs": [{"name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function"
      }
    ],
    functionName: 'getOptionPool',
    args: searchedMarketId && marketData?.paymentToken ? [BigInt(searchedMarketId), BigInt(2), marketData.paymentToken] : undefined,
    query: { enabled: !!(searchedMarketId && marketData?.paymentToken && marketData?.maxOptions && Number(marketData.maxOptions) >= 2) }
  });

  const { data: option3Pool } = useReadContract({
    address: marketManagerAddress,
    abi: [
      {
        "inputs": [{"name": "marketId", "type": "uint256"}, {"name": "option", "type": "uint256"}, {"name": "token", "type": "address"}],
        "name": "getOptionPool",
        "outputs": [{"name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function"
      }
    ],
    functionName: 'getOptionPool',
    args: searchedMarketId && marketData?.paymentToken ? [BigInt(searchedMarketId), BigInt(3), marketData.paymentToken] : undefined,
    query: { enabled: !!(searchedMarketId && marketData?.paymentToken && marketData?.maxOptions && Number(marketData.maxOptions) >= 3) }
  });

  const { data: option4Pool } = useReadContract({
    address: marketManagerAddress,
    abi: [
      {
        "inputs": [{"name": "marketId", "type": "uint256"}, {"name": "option", "type": "uint256"}, {"name": "token", "type": "address"}],
        "name": "getOptionPool",
        "outputs": [{"name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function"
      }
    ],
    functionName: 'getOptionPool',
    args: searchedMarketId && marketData?.paymentToken ? [BigInt(searchedMarketId), BigInt(4), marketData.paymentToken] : undefined,
    query: { enabled: !!(searchedMarketId && marketData?.paymentToken && marketData?.maxOptions && Number(marketData.maxOptions) >= 4) }
  });

  // Staker and supporter counts
  const { data: stakerCount } = useReadContract({
    address: marketManagerAddress,
    abi: [
      {
        "inputs": [{"name": "marketId", "type": "uint256"}],
        "name": "getStakerCount",
        "outputs": [{"name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function"
      }
    ],
    functionName: 'getStakerCount',
    args: searchedMarketId ? [BigInt(searchedMarketId)] : undefined,
    query: { enabled: !!searchedMarketId }
  });

  const { data: supporterCount } = useReadContract({
    address: marketManagerAddress,
    abi: [
      {
        "inputs": [{"name": "marketId", "type": "uint256"}],
        "name": "getSupporterCount",
        "outputs": [{"name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function"
      }
    ],
    functionName: 'getSupporterCount',
    args: searchedMarketId ? [BigInt(searchedMarketId)] : undefined,
    query: { enabled: !!searchedMarketId }
  });

  // Compute totals like main page
  const getTotalPool = () => {
    const pools = [option1Pool || BigInt(0), option2Pool || BigInt(0), option3Pool || BigInt(0), option4Pool || BigInt(0)];
    const maxOptions = marketData?.maxOptions ? Number(marketData.maxOptions) : 2;
    const relevant = pools.slice(0, maxOptions);
    const totalOptions = relevant.reduce((sum, p) => sum + p, BigInt(0));
    const supportAmt = supportPool || BigInt(0);
    return totalOptions + supportAmt;
  };

  const totalParticipants = (stakerCount ? Number(stakerCount) : 0) + (supporterCount ? Number(supporterCount) : 0) + 1;

  // Helper function to get market options
  const getMarketOptions = () => {
    if (marketMetadata?.options && Array.isArray(marketMetadata.options)) {
      return marketMetadata.options;
    }
    // Fallback for multi-option markets
    if (marketData?.isMultiOption) {
      const maxOpts = marketData?.maxOptions ? Number(marketData.maxOptions) : 4;
      return ['Option 1', 'Option 2', 'Option 3', 'Option 4'].slice(0, maxOpts);
    }
    return ['Yes', 'No'];
  };

  // Helper function to get winning option text
  const getWinningOptionText = () => {
    if (!marketData?.isResolved || !marketData?.winningOption || Number(marketData.winningOption) === 0) {
      return null;
    }
    const options = getMarketOptions();
    const optionIndex = Number(marketData.winningOption) - 1;
    return options[optionIndex] || `Option ${marketData.winningOption}`;
  };

  const handleSearch = async () => {
    if (!searchId || isNaN(Number(searchId))) {
      setSearchError('Enter a valid market ID number');
      return;
    }
    
    if (!marketManagerAddress) {
      setSearchError('Contract address not configured');
      return;
    }
    
    setIsSearching(true);
    setSearchError('');
    setSearchedMarketId(null);
    
    try {
      console.log('Searching market:', searchId);
      console.log('Contract address:', marketManagerAddress);
      
      const provider = new ethers.JsonRpcProvider('https://rpc-pepu-v2-mainnet-0.t.conduit.xyz');
      const contract = new ethers.Contract(marketManagerAddress, MARKET_MANAGER_ABI, provider);
      
      const market = await contract.getMarket(BigInt(searchId));
      console.log('Market data:', market);
      console.log('Market state:', market.state, 'Type:', typeof market.state);
      
      if (!market || !market.creator || market.creator === '0x0000000000000000000000000000000000000000') {
        setSearchError(`Market #${searchId} does not exist on the blockchain`);
        setIsSearching(false);
        return;
      }
      
      setMarketData(market);
      setSearchedMarketId(Number(searchId));

      // Resolve creator label via profile API
      try {
        const res = await fetch(`/api/profile?address=${market.creator}`);
        if (res.ok) {
          const json = await res.json();
          const profile = json?.profile;
          const name = profile?.display_name || profile?.username;
          setCreatorLabel(name || `${market.creator.slice(0, 6)}...${market.creator.slice(-4)}`);
        } else {
          setCreatorLabel(`${market.creator.slice(0, 6)}...${market.creator.slice(-4)}`);
        }
      } catch {
        setCreatorLabel(`${market.creator.slice(0, 6)}...${market.creator.slice(-4)}`);
      }
      
      // Fetch IPFS metadata
      if (market.ipfsHash) {
        try {
          const response = await fetch(`https://gateway.lighthouse.storage/ipfs/${market.ipfsHash}`);
          if (response.ok) {
            const metadata = await response.json();
            setMarketMetadata(metadata);
          }
        } catch (err) {
          console.error('Failed to load IPFS metadata:', err);
        }
      }
      
    } catch (err: any) {
      console.error('Search error:', err);
      setSearchError(`Market #${searchId} error: ${err.message}`);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSupport = async () => {
    if (!supportAmount || !marketData) return;
    
    // Check if support period has ended (support ends at stakeEndTime, not endTime)
    const currentTime = Math.floor(Date.now() / 1000);
    const stakeEndTime = Number(marketData.stakeEndTime);
    
    if (currentTime >= stakeEndTime) {
      alert('Cannot support market after staking period has ended');
      return;
    }
    
    setIsSupporting(true);
    try {
      const amount = ethers.parseEther(supportAmount);
      
      const paymentToken = marketData.paymentToken;
      const isERC20Market = paymentToken !== '0x0000000000000000000000000000000000000000';
      
      if (isERC20Market) {
        // For ERC20 tokens, need to approve first
        console.log('Approving ERC20 token...');
        
        // First approve the token spending
        const approveHash = await writeContract({
          address: paymentToken as `0x${string}`,
          abi: [
            {
              "inputs": [
                {"name": "spender", "type": "address"},
                {"name": "amount", "type": "uint256"}
              ],
              "name": "approve",
              "outputs": [{"name": "", "type": "bool"}],
              "stateMutability": "nonpayable",
              "type": "function"
            }
          ],
          functionName: 'approve',
          args: [marketManagerAddress, amount],
          gas: BigInt(500000) // Gas limit for approval
        });
        
        console.log('Approve transaction hash:', approveHash);
        alert('Approve transaction submitted! Please wait for confirmation...');
        
        // Wait for approve transaction to be confirmed
        await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
        
        // Then support the market
        console.log('Supporting market...');
        const supportHash = await writeContract({
          address: marketManagerAddress,
          abi: MARKET_MANAGER_ABI,
          functionName: 'supportMarket',
          args: [BigInt(searchId), amount],
          gas: BigInt(500000) // Gas limit for support
        });
        
        console.log('Support transaction hash:', supportHash);
      } else {
        // For PEPU (native token), use supportMarket with value
        await writeContract({
          address: marketManagerAddress,
          abi: MARKET_MANAGER_ABI,
          functionName: 'supportMarket',
          args: [BigInt(searchId), amount],
          value: amount,
          gas: BigInt(500000) // Gas limit for PEPU support
        });
      }
      
      alert('Support transaction submitted!');
      setSupportAmount('');
      
    } catch (err) {
      console.error('Support failed:', err);
      alert('Support failed: ' + (err as any).message);
    } finally {
      setIsSupporting(false);
    }
  };

  const handleSoftDelete = async () => {
    if (!deleteReason.trim() || !searchedMarketId) return;
    
    setIsDeleting(true);
    setDeleteSuccess('');
    setSearchError('');
    
    try {
      // Submit blockchain transaction
      writeContract({
        address: marketManagerAddress,
        abi: MARKET_MANAGER_ABI,
        functionName: 'deleteMarket',
        args: [BigInt(searchedMarketId), deleteReason]
      });
      
      // Delete from Supabase immediately
      const { error: supabaseError } = await supabase
        .from('market')
        .delete()
        .eq('market_id', searchedMarketId.toString());
      
      if (supabaseError) {
        console.error('Error deleting from Supabase:', supabaseError);
      }
      
      setDeleteSuccess(`Market #${searchedMarketId} deleted successfully from database`);
      setSearchedMarketId(null);
      setShowDeleteModal(false);
      setDeleteReason('');
      setIsDeleting(false);
      setTimeout(() => setDeleteSuccess(''), 5000);
      
    } catch (err: any) {
      setSearchError(err.message || 'Failed to submit delete transaction');
      setIsDeleting(false);
    }
  };

  const handlePermanentDelete = async () => {
    if (!searchedMarketId) return;
    
    if (!confirm(`Permanently remove market #${searchedMarketId}? This CANNOT be undone!`)) {
      return;
    }
    
    setIsPermanentlyDeleting(true);
    setDeleteSuccess('');
    setSearchError('');
    
    try {
      // Submit blockchain transaction
      writeContract({
        address: marketManagerAddress,
        abi: MARKET_MANAGER_ABI,
        functionName: 'permanentlyRemoveMarket',
        args: [BigInt(searchedMarketId)]
      });
      
      // Delete from Supabase immediately
      const { error: supabaseError } = await supabase
        .from('market')
        .delete()
        .eq('market_id', searchedMarketId.toString());
      
      if (supabaseError) {
        console.error('Error deleting from Supabase:', supabaseError);
      }
      
      setDeleteSuccess(`Market #${searchedMarketId} permanently removed from database`);
      setSearchedMarketId(null);
      setIsPermanentlyDeleting(false);
      setTimeout(() => setDeleteSuccess(''), 5000);
      
    } catch (err: any) {
      setSearchError(err.message || 'Failed to submit permanent delete transaction');
      setIsPermanentlyDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className={`p-6 rounded-xl border ${isDarkMode ? 'bg-black border-gray-800' : 'bg-[#F5F3F0] border-gray-300'}`}>
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
                  ? 'bg-gray-900 border-gray-800 text-white placeholder-gray-500' 
                  : 'bg-[#F5F3F0] border-gray-400 text-gray-900'
              }`}
            />
          </div>
          <button
            onClick={handleSearch}
            disabled={isSearching}
            className={`px-6 py-3 rounded-lg text-sm font-semibold transition-colors ${
              isSearching
                ? (isDarkMode ? 'bg-gray-800 cursor-not-allowed text-white/40' : 'bg-gray-300 cursor-not-allowed text-gray-500')
                : isDarkMode ? 'bg-[#39FF14] hover:bg-[#39FF14]/80 text-black' : 'bg-[#39FF14] hover:bg-[#39FF14]/80 text-black border border-black'
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

        {deleteSuccess && (
          <div className={`p-4 rounded-lg border flex items-start gap-3 ${
            isDarkMode ? 'bg-green-900/20 border-green-800 text-green-300' : 'bg-green-50 border-green-200 text-green-800'
          }`}>
            <CheckCircle size={20} className="flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Success</p>
              <p className="text-sm">{deleteSuccess}</p>
            </div>
          </div>
        )}

        {searchedMarketId && marketData && (
          <div className={`w-full max-w-sm border rounded-xl overflow-hidden transition-all duration-200 hover:shadow-lg flex flex-col ${
            isDarkMode ? 'bg-black border-gray-800 hover:shadow-gray-900/50' : 'bg-[#F5F3F0] border-gray-300 hover:shadow-gray-900/20'
          }`}>
            <div className="p-4 flex flex-col flex-1 min-h-0">
              {/* Header with small image */}
              <div className="flex items-start justify-between gap-3 mb-4 flex-shrink-0">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  {marketMetadata?.imageUrl && (
                    <div className="flex-shrink-0">
                      <img
                        src={marketMetadata.imageUrl}
                        alt=""
                        className={`w-12 h-12 rounded-lg object-cover border ${isDarkMode ? 'border-gray-800' : 'border-gray-300'}`}
                      />
              </div>
                  )}
                  
                  <div className="flex-1 min-w-0">
                    <h3 className={`font-semibold text-base leading-tight ${
                      isDarkMode ? 'text-white' : 'text-gray-900'
                    }`}>
                  {marketMetadata?.title || 'Loading...'}
                </h3>
                    <div className="flex items-center gap-2 mt-2">
                      <span className={`text-xs px-2 py-1 rounded ${
                        marketData.isMultiOption ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
                      }`}>
                        {marketData.isMultiOption ? 'Multi' : 'Yes/No'}
                      </span>
                      <span className={`text-xs px-2 py-1 rounded ${
                        Number(marketData.state) === 0 
                      ? 'bg-green-100 text-green-800' 
                          : Number(marketData.state) === 1 
                      ? 'bg-yellow-100 text-yellow-800' 
                          : Number(marketData.state) === 2
                          ? 'bg-blue-100 text-blue-800'
                          : Number(marketData.state) === 3
                          ? 'bg-orange-100 text-orange-800'
                          : Number(marketData.state) === 4
                          ? 'bg-red-100 text-red-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {Number(marketData.state) === 0 ? 'Active' : 
                         Number(marketData.state) === 1 ? 'Ended' : 
                         Number(marketData.state) === 2 ? 'Resolved' :
                         Number(marketData.state) === 3 ? 'Cancelled' :
                         Number(marketData.state) === 4 ? 'Deleted' :
                         'Unknown'}
                  </span>
                </div>
              </div>
            </div>

                <div className="flex-shrink-0">
                  <div className={`w-8 h-8 rounded flex items-center justify-center ${
                    isDarkMode ? 'bg-gray-900' : 'bg-gray-200'
                  }`}>
                    <span className={`font-bold text-xs ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>#{searchedMarketId}</span>
                  </div>
                </div>
              </div>

              {/* Market Details */}
              <div className="space-y-2 mb-4 flex-1">
                <div className="flex justify-between text-sm">
                <span className={isDarkMode ? 'text-white/60' : 'text-gray-500'}>Creator:</span>
                <span className={`font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  {creatorLabel || (marketData.creator?.slice(0, 6) + '...' + marketData.creator?.slice(-4))}
                </span>
              </div>
                <div className="flex justify-between text-sm">
                <span className={isDarkMode ? 'text-white/60' : 'text-gray-500'}>Participants:</span>
                <span className={`font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  {totalParticipants}
                </span>
              </div>
                <div className="flex justify-between text-sm">
                <span className={isDarkMode ? 'text-white/60' : 'text-gray-500'}>Total Pool:</span>
                <span className={`font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  {formatEther(getTotalPool())} {tokenSymbol || 'Token'}
                </span>
              </div>
                <div className="flex justify-between text-sm">
                <span className={isDarkMode ? 'text-white/60' : 'text-gray-500'}>Min Stake:</span>
                <span className={`font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  {formatEther(marketData.minStake)} {tokenSymbol || 'Token'}
                </span>
              </div>
                <div className="flex justify-between text-sm">
                <span className={isDarkMode ? 'text-white/60' : 'text-gray-500'}>Ends:</span>
                <span className={`font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  {new Date(Number(marketData.endTime) * 1000).toLocaleDateString()}
                </span>
              </div>
                {supportPool !== undefined && (
                  <div className="flex justify-between text-sm">
                    <span className={isDarkMode ? 'text-white/60' : 'text-gray-500'}>Total Support:</span>
                <span className={`font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                      {formatEther(supportPool)} {tokenSymbol || 'Token'}
                </span>
              </div>
                )}
                {Number(marketData.state) === 2 && marketData.isResolved && getWinningOptionText() && (
                  <div className="flex justify-between text-sm">
                    <span className={isDarkMode ? 'text-white/60' : 'text-gray-500'}>Winning Outcome:</span>
                    <span className={`font-medium px-2 py-1 rounded ${isDarkMode ? 'bg-[#39FF14]/20 text-[#39FF14]' : 'bg-[#39FF14]/20 text-green-700 border border-black'}`}>
                      {getWinningOptionText()}
                </span>
              </div>
                )}
            </div>

              {/* Support Field - Only show for active markets and before stake end time */}
              {Number(marketData.state) === 0 && (() => {
                const currentTime = Math.floor(Date.now() / 1000);
                const stakeEndTime = Number(marketData.stakeEndTime);
                return currentTime < stakeEndTime;
              })() && (
                <div className="space-y-3 mb-4">
                  <div className="border-t pt-3">
                    <h4 className={`text-sm font-semibold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                      Add Support
                    </h4>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        value={supportAmount}
                        onChange={(e) => setSupportAmount(e.target.value)}
                        placeholder={`Amount in ${tokenSymbol || 'Token'}`}
                        className={`flex-1 px-3 py-2 border rounded text-sm ${
                          isDarkMode 
                            ? 'bg-gray-900 border-gray-800 text-white placeholder-gray-500' 
                            : 'bg-[#F5F3F0] border-gray-400 text-gray-900'
                        }`}
                      />
                      <button
                        onClick={handleSupport}
                        disabled={isSupporting || !supportAmount || Number(supportAmount) <= 0}
                        className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                          isSupporting || !supportAmount || Number(supportAmount) <= 0
                            ? (isDarkMode ? 'bg-gray-800 cursor-not-allowed text-white/40' : 'bg-gray-300 cursor-not-allowed text-gray-500')
                            : isDarkMode ? 'bg-[#39FF14] hover:bg-[#39FF14]/80 text-black' : 'bg-[#39FF14] hover:bg-[#39FF14]/80 text-black border border-black'
                        }`}
                      >
                        {isSupporting ? 'Supporting...' : 'Support'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Admin Actions */}
              <div className="flex gap-2 mt-auto">
                {/* Delete button - only show for non-deleted markets */}
                {Number(marketData.state) !== 4 && (
                <button
                    onClick={() => setShowDeleteModal(true)}
                    disabled={isDeleting || isPermanentlyDeleting}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                      isDeleting || isPermanentlyDeleting
                      ? (isDarkMode ? 'bg-gray-800 cursor-not-allowed text-white/40' : 'bg-gray-300 cursor-not-allowed text-gray-500')
                        : isDarkMode ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-red-600 hover:bg-red-700 text-white'
                  }`}
                >
                    <Trash2 size={12} />
                    {isDeleting ? 'Deleting...' : 'Delete'}
                </button>
                )}
                
                {/* Remove button - always show */}
              <button
                onClick={handlePermanentDelete}
                  disabled={isDeleting || isPermanentlyDeleting}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                    isDeleting || isPermanentlyDeleting
                      ? (isDarkMode ? 'bg-gray-800 cursor-not-allowed text-white/40' : 'bg-gray-300 cursor-not-allowed text-gray-500')
                      : 'bg-orange-600 hover:bg-orange-700 text-white'
                  }`}
              >
                <X size={12} />
                  {isPermanentlyDeleting ? 'Removing...' : 'Remove'}
              </button>
              </div>
            </div>
          </div>
        )}

        {/* Market Participants */}
        {searchedMarketId && marketData && (
          <MarketParticipants marketId={searchedMarketId} isDarkMode={isDarkMode} />
        )}

        {/* Delete Modal */}
        {showDeleteModal && searchedMarketId && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className={`rounded-lg max-w-sm w-full shadow-xl ${
              isDarkMode ? 'bg-black border border-gray-800' : 'bg-[#F5F3F0] border border-gray-300'
            }`}>
              <div className="p-4">
                <h3 className={`text-lg font-semibold mb-3 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  Delete Market #{searchedMarketId}
                </h3>
                <p className={`text-xs mb-3 ${isDarkMode ? 'text-white/70' : 'text-gray-600'}`}>
                  Soft delete - users can still claim refunds
                </p>
                <div className="mb-4">
                  <label className={`block text-xs font-medium mb-1 ${isDarkMode ? 'text-white' : 'text-gray-700'}`}>
                    Reason
                  </label>
                  <textarea
                    value={deleteReason}
                    onChange={(e) => setDeleteReason(e.target.value)}
                    placeholder="Enter reason..."
                    rows={2}
                    className={`w-full px-2 py-1.5 border rounded text-xs ${
                      isDarkMode 
                        ? 'bg-gray-900 border-gray-800 text-white placeholder-gray-500' 
                        : 'bg-[#F5F3F0] border-gray-400 text-gray-900'
                    }`}
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowDeleteModal(false)}
                    className={`flex-1 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                      isDarkMode 
                        ? 'bg-gray-800 hover:bg-gray-700 text-white' 
                        : 'bg-gray-300 hover:bg-gray-400 text-gray-900'
                    }`}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSoftDelete}
                    disabled={!deleteReason.trim() || isDeleting || isPermanentlyDeleting}
                    className={`flex-1 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                      !deleteReason.trim() || isDeleting || isPermanentlyDeleting
                        ? (isDarkMode ? 'bg-gray-800 cursor-not-allowed text-white/40' : 'bg-gray-300 cursor-not-allowed text-gray-500')
                        : isDarkMode ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-red-600 hover:bg-red-700 text-white'
                    }`}
                  >
                    {isDeleting ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Verifier Management Component
function VerifierManagement({ isDarkMode }: { isDarkMode: boolean }) {
  const [addVerifierAddress, setAddVerifierAddress] = useState('');
  const [removeVerifierAddress, setRemoveVerifierAddress] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [verifierSuccess, setVerifierSuccess] = useState('');
  const [verifiers, setVerifiers] = useState<string[]>([]);
  const [isLoadingVerifiers, setIsLoadingVerifiers] = useState(true);

  const validationCoreAddress = process.env.NEXT_PUBLIC_P2P_VERIFICATION_ADDRESS as `0x${string}`;
  const { writeContract } = useWriteContract();

  // Fetch verifiers
  const { data: verifiersData, refetch: refetchVerifiers } = useReadContract({
    address: validationCoreAddress,
    abi: VALIDATION_CORE_ABI,
    functionName: 'getVerifiers',
  }) as { data: string[] | undefined; refetch: () => void };

  // Fetch verifier count
  const { data: verifierCount } = useReadContract({
    address: validationCoreAddress,
    abi: VALIDATION_CORE_ABI,
    functionName: 'getVerifierCount',
  }) as { data: bigint | undefined };

  // Fetch max verifiers
  const { data: maxVerifiers } = useReadContract({
    address: validationCoreAddress,
    abi: VALIDATION_CORE_ABI,
    functionName: 'MAX_VERIFIERS',
  }) as { data: bigint | undefined };

  // Fetch required quorum
  const { data: requiredQuorum } = useReadContract({
    address: validationCoreAddress,
    abi: VALIDATION_CORE_ABI,
    functionName: 'REQUIRED_QUORUM',
  }) as { data: bigint | undefined };

  // Update verifiers list when data changes
  useEffect(() => {
    if (verifiersData) {
      setVerifiers(verifiersData);
      setIsLoadingVerifiers(false);
    }
  }, [verifiersData]);

  const handleAddVerifier = async () => {
    if (!addVerifierAddress.trim()) return;
    
    setIsAdding(true);
    try {
      await writeContract({
        address: validationCoreAddress,
        abi: VALIDATION_CORE_ABI,
        functionName: 'addVerifier',
        args: [addVerifierAddress as `0x${string}`]
      });
      
      setVerifierSuccess(`Verifier ${addVerifierAddress.slice(0, 6)}...${addVerifierAddress.slice(-4)} added successfully`);
      setAddVerifierAddress('');
      refetchVerifiers();
      setTimeout(() => setVerifierSuccess(''), 5000);
      
    } catch (err: any) {
      console.error('Add verifier failed:', err);
      setVerifierSuccess(`Error: ${err.message}`);
      setTimeout(() => setVerifierSuccess(''), 5000);
    } finally {
      setIsAdding(false);
    }
  };

  const handleRemoveVerifier = async () => {
    if (!removeVerifierAddress.trim()) return;
    
    setIsRemoving(true);
    try {
      await writeContract({
        address: validationCoreAddress,
        abi: VALIDATION_CORE_ABI,
        functionName: 'removeVerifier',
        args: [removeVerifierAddress as `0x${string}`]
      });
      
      setVerifierSuccess(`Verifier ${removeVerifierAddress.slice(0, 6)}...${removeVerifierAddress.slice(-4)} removed successfully`);
      setRemoveVerifierAddress('');
      refetchVerifiers();
      setTimeout(() => setVerifierSuccess(''), 5000);
      
    } catch (err: any) {
      console.error('Remove verifier failed:', err);
      setVerifierSuccess(`Error: ${err.message}`);
      setTimeout(() => setVerifierSuccess(''), 5000);
    } finally {
      setIsRemoving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Verifier Stats */}
        <div className={`p-4 sm:p-6 rounded-xl border ${isDarkMode ? 'bg-black border-gray-800' : 'bg-[#F5F3F0] border-gray-300'}`}>
        <h2 className={`text-lg sm:text-2xl font-bold mb-3 sm:mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
          Verifier Management
        </h2>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-4 sm:mb-6">
          <div className={`p-3 sm:p-4 rounded-lg border ${isDarkMode ? 'bg-gray-900 border-gray-800' : 'bg-gray-200 border-gray-300'}`}>
            <div className="flex items-center gap-2 mb-2">
              <Users size={20} className={isDarkMode ? 'text-[#39FF14]' : 'text-blue-500'} />
              <span className={`text-xs sm:text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                Active Verifiers
              </span>
            </div>
            <div className={`text-xl sm:text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              {verifierCount ? Number(verifierCount) : 0}
            </div>
          </div>
          
          <div className={`p-3 sm:p-4 rounded-lg border ${isDarkMode ? 'bg-gray-900 border-gray-800' : 'bg-gray-200 border-gray-300'}`}>
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle size={20} className="text-orange-500" />
              <span className={`text-xs sm:text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                Max Verifiers
              </span>
            </div>
            <div className={`text-xl sm:text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              {maxVerifiers ? Number(maxVerifiers) : 0}
            </div>
          </div>
          
          <div className={`p-3 sm:p-4 rounded-lg border ${isDarkMode ? 'bg-gray-900 border-gray-800' : 'bg-gray-200 border-gray-300'}`}>
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle size={20} className={isDarkMode ? 'text-[#39FF14]' : 'text-green-500'} />
              <span className={`text-xs sm:text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                Required Quorum
              </span>
            </div>
            <div className={`text-xl sm:text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              {requiredQuorum ? Number(requiredQuorum) : 0}
            </div>
          </div>
        </div>

        {/* Add/Remove Verifiers */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* Add Verifier */}
          <div className={`p-4 rounded-lg border ${isDarkMode ? 'bg-gray-900 border-gray-800' : 'bg-gray-200 border-gray-300'}`}>
            <h3 className={`text-lg font-semibold mb-3 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              Add Verifier
            </h3>
            <div className="space-y-3">
              <input
                type="text"
                value={addVerifierAddress}
                onChange={(e) => setAddVerifierAddress(e.target.value)}
                placeholder="Enter wallet address to add as verifier"
                className={`w-full px-3 py-2 border rounded-lg text-sm ${
                  isDarkMode 
                    ? 'bg-gray-900 border-gray-800 text-white placeholder-gray-500' 
                    : 'bg-[#F5F3F0] border-gray-400 text-gray-900'
                }`}
              />
              <button
                onClick={handleAddVerifier}
                disabled={!addVerifierAddress.trim() || isAdding || (!!maxVerifiers && !!verifierCount && Number(verifierCount) >= Number(maxVerifiers))}
                className={`w-full px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                  !addVerifierAddress.trim() || isAdding || (!!maxVerifiers && !!verifierCount && Number(verifierCount) >= Number(maxVerifiers))
                    ? (isDarkMode ? 'bg-gray-800 cursor-not-allowed text-white/40' : 'bg-gray-300 cursor-not-allowed text-gray-500')
                    : isDarkMode ? 'bg-[#39FF14] hover:bg-[#39FF14]/80 text-black' : 'bg-[#39FF14] hover:bg-[#39FF14]/80 text-black border border-black'
                }`}
              >
                {isAdding ? 'Adding...' : 
                 (!!maxVerifiers && !!verifierCount && Number(verifierCount) >= Number(maxVerifiers)) ? 'Max Verifiers Reached' : 
                 'Add Verifier'}
              </button>
            </div>
          </div>

          {/* Remove Verifier */}
          <div className={`p-4 rounded-lg border ${isDarkMode ? 'bg-gray-900 border-gray-800' : 'bg-gray-200 border-gray-300'}`}>
            <h3 className={`text-lg font-semibold mb-3 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              Remove Verifier
            </h3>
            <div className="space-y-3">
              <input
                type="text"
                value={removeVerifierAddress}
                onChange={(e) => setRemoveVerifierAddress(e.target.value)}
                placeholder="Enter wallet address to remove as verifier"
                className={`w-full px-3 py-2 border rounded-lg text-sm ${
                  isDarkMode 
                    ? 'bg-gray-900 border-gray-800 text-white placeholder-gray-500' 
                    : 'bg-[#F5F3F0] border-gray-400 text-gray-900'
                }`}
              />
              <button
                onClick={handleRemoveVerifier}
                disabled={!removeVerifierAddress.trim() || isRemoving}
                className={`w-full px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                  !removeVerifierAddress.trim() || isRemoving
                    ? (isDarkMode ? 'bg-gray-800 cursor-not-allowed text-white/40' : 'bg-gray-300 cursor-not-allowed text-gray-500')
                    : 'bg-red-600 hover:bg-red-700 text-white'
                }`}
              >
                {isRemoving ? 'Removing...' : 'Remove Verifier'}
              </button>
            </div>
          </div>
        </div>

        {/* Current Verifiers List */}
        <div className={`p-4 rounded-lg border ${isDarkMode ? 'bg-gray-900 border-gray-800' : 'bg-gray-200 border-gray-300'}`}>
          <h3 className={`text-lg font-semibold mb-3 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            Current Verifiers ({verifiers.length})
          </h3>
          
          {!validationCoreAddress ? (
            <div className="text-center py-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
              <p className={`text-sm mt-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Loading ValidationCore address...</p>
            </div>
          ) : isLoadingVerifiers ? (
            <div className="text-center py-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
              <p className={`text-sm mt-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Loading verifiers...</p>
            </div>
          ) : verifiers.length === 0 ? (
            <div className={`text-center py-8 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              <Users size={48} className="mx-auto mb-2 opacity-50" />
              <p>No verifiers added yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {verifiers.map((verifier) => (
                <div key={verifier} className={`flex items-center justify-between p-3 rounded-lg border ${
                  isDarkMode ? 'bg-gray-900 border-gray-800' : 'bg-[#F5F3F0] border-gray-300'
                }`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      isDarkMode ? 'bg-[#39FF14]' : 'bg-[#39FF14]/20'
                    }`}>
                      <Users size={16} className={isDarkMode ? 'text-black' : 'text-green-700'} />
                    </div>
                    <div className="flex-1">
                      <button
                        onClick={() => navigator.clipboard.writeText(verifier)}
                        className={`font-mono text-sm hover:underline cursor-pointer transition-colors ${
                          isDarkMode ? 'text-white hover:text-[#39FF14]' : 'text-gray-900 hover:text-emerald-600'
                        }`}
                        title="Click to copy full address"
                      >
                        {verifier.slice(0, 6)}...{verifier.slice(-4)}
                      </button>
                      <p className={`text-xs mt-1 ${isDarkMode ? 'text-white/60' : 'text-gray-600'}`}>
                        Click to copy full address
                      </p>
                    </div>
                  </div>
                  <div className={`px-2 py-1 rounded text-xs font-medium ${
                    isDarkMode ? 'bg-[#39FF14]/20 text-[#39FF14] border border-[#39FF14]/30' : 'bg-[#39FF14]/20 text-green-700 border border-black'
                  }`}>
                    Active
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Success/Error Message */}
        {verifierSuccess && (
          <div className={`p-4 rounded-lg border flex items-start gap-3 ${
            verifierSuccess.includes('Error:') 
              ? isDarkMode ? 'bg-red-900/20 border-red-800 text-red-300' : 'bg-red-50 border-red-200 text-red-800'
              : isDarkMode ? 'bg-green-900/20 border-green-800 text-green-300' : 'bg-green-50 border-green-200 text-green-800'
          }`}>
            {verifierSuccess.includes('Error:') ? (
              <AlertCircle size={20} className="flex-shrink-0 mt-0.5" />
            ) : (
              <CheckCircle size={20} className="flex-shrink-0 mt-0.5" />
            )}
            <div>
              <p className="font-semibold">{verifierSuccess.includes('Error:') ? 'Error' : 'Success'}</p>
              <p className="text-sm">{verifierSuccess}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Token Management Section
function TokenManagementSection({ isDarkMode }: { isDarkMode: boolean }) {
  const ADMIN_MANAGER_ADDRESS = process.env.NEXT_PUBLIC_P2P_ADMIN_ADDRESS as `0x${string}`;
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const [tokenAddress, setTokenAddress] = useState('');
  const [tokenSymbol, setTokenSymbol] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const { writeContract, data: hash, isPending, error: writeError } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash });

  const { data: supportedTokensData } = useReadContract({
    address: ADMIN_MANAGER_ADDRESS,
    abi: [
      {
        inputs: [],
        name: 'getSupportedTokens',
        outputs: [
          { name: 'tokens', type: 'address[]' },
          { name: 'symbols', type: 'string[]' }
        ],
        stateMutability: 'view',
        type: 'function',
      }
    ],
    functionName: 'getSupportedTokens',
  });
  const tokens = useMemo(() => (
    supportedTokensData && supportedTokensData.length === 2
      ? supportedTokensData[0].map((address: string, idx: number) => ({
          address: address as `0x${string}`,
          symbol: supportedTokensData[1][idx],
          isNative: address === '0x0000000000000000000000000000000000000000'
        }))
      : []
  ), [supportedTokensData]);

  const isValidAddress = (addr: string) => /^0x[a-fA-F0-9]{40}$/.test(addr);
  const isValidSymbol = (symbol: string) => symbol.length >= 1 && symbol.length <= 10 && /^[A-Z0-9]+$/.test(symbol);
  const addToken = async () => {
    if (!isConnected || !address) { setError('Please connect your wallet'); return; }
    if (!tokenAddress.trim()) { setError('Please enter a token address'); return; }
    if (!isValidAddress(tokenAddress)) { setError('Please enter a valid token address (0x...)'); return; }
    if (!tokenSymbol.trim()) { setError('Please enter a token symbol'); return; }
    if (!isValidSymbol(tokenSymbol)) { setError('Token symbol must be 1-10 uppercase letters/numbers only'); return; }
    setIsAdding(true); setError(''); setSuccess('');
    try {
      await writeContract({
        address: ADMIN_MANAGER_ADDRESS,
        abi: [{ inputs: [{ name: 'token', type: 'address' }, { name: 'symbol', type: 'string' }], name: 'addSupportedToken', outputs: [], stateMutability: 'nonpayable', type: 'function' }],
        functionName: 'addSupportedToken',
        args: [tokenAddress as `0x${string}`, tokenSymbol.toUpperCase()],
      });
    } catch (err: any) {
      setError(err.message || 'Failed to add token');
      setIsAdding(false); setSuccess('');
    }
  };
  useEffect(() => { if (isConfirmed) { setSuccess(`Token ${tokenSymbol.toUpperCase()} added successfully!`); setIsAdding(false); setError(''); setTokenAddress(''); setTokenSymbol(''); } }, [isConfirmed, tokenSymbol]);
  useEffect(() => { if (writeError) { setError(`Transaction failed: ${writeError.message}`); setIsAdding(false); setSuccess(''); } }, [writeError]);
  useEffect(() => { if (success) { const t = setTimeout(() => setSuccess(''), 5000); return () => clearTimeout(t); } }, [success]);

    return (
    <div className="w-full">
      <div className="grid gap-6 lg:grid-cols-2">
        <div className={`rounded-xl border ${isDarkMode ? 'bg-black border-gray-800' : 'bg-[#F5F3F0] border-gray-300'}`}>
          <div className="p-6">
            <h3 className={`font-semibold text-lg mb-3 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Supported Tokens</h3>
            {tokens.length > 0 ? (
              <div className="overflow-x-auto rounded">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm">
                  <thead>
                    <tr>
                      <th className="px-3 py-2 text-left whitespace-nowrap">Symbol</th>
                      <th className="px-3 py-2 text-left whitespace-nowrap">Address</th>
                      <th className="px-3 py-2 text-left whitespace-nowrap">Type</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tokens.map((t) => (
                      <tr key={t.address} className={`${isDarkMode ? 'odd:bg-gray-900 even:bg-black' : 'odd:bg-gray-200 even:bg-[#F5F3F0]'} border-b ${isDarkMode ? 'border-gray-800' : 'border-gray-300'}`}>
                        <td className="px-3 py-2 font-medium whitespace-nowrap">{t.symbol}</td>
                        <td className="px-3 py-2 font-mono text-xs break-all">{t.address}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{t.isNative ? 'Native' : 'ERC20'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className={isDarkMode ? 'text-white/60' : 'text-gray-500'}>No supported tokens found.</div>
            )}
          </div>
        </div>
        <div className={`rounded-xl border ${isDarkMode ? 'bg-black border-gray-800' : 'bg-[#F5F3F0] border-gray-300'}`}>
          <div className="p-6">
            <h3 className={`font-semibold text-lg mb-3 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Add New Token</h3>
            {error && (
              <div className={`mb-4 p-3 rounded-lg border ${isDarkMode ? 'bg-red-900/40 border-red-700' : 'bg-red-50 border-red-200'}`}><div className={`flex items-center gap-2 ${isDarkMode ? 'text-red-300' : 'text-red-800'}`}><AlertCircle size={20}/><b>Error</b></div><div className={`ml-7 text-sm mt-1 ${isDarkMode ? 'text-red-300' : 'text-red-800'}`}>{error}</div></div>
            )}
            {success && (
              <div className={`mb-4 p-3 rounded-lg border ${isDarkMode ? 'bg-green-900/40 border-green-700' : 'bg-green-50 border-green-200'}`}><div className={`flex items-center gap-2 ${isDarkMode ? 'text-green-300' : 'text-green-800'}`}><CheckCircle size={20}/><b>Success</b></div><div className={`ml-7 text-sm mt-1 ${isDarkMode ? 'text-green-300' : 'text-green-800'}`}>{success}</div></div>
            )}
            <div className="space-y-4">
              <div>
                <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}><div className="flex items-center gap-2"><Hash className="w-4 h-4"/>Token Address</div></label>
                <input type="text" value={tokenAddress} onChange={(e) => setTokenAddress(e.target.value)} placeholder="0x..." className={`w-full px-3 py-2.5 border rounded-lg focus:border-[#39FF14] focus:outline-none text-sm ${isDarkMode ? 'bg-gray-900 border-gray-800 text-white placeholder-gray-500' : 'bg-[#F5F3F0] border-gray-400 text-gray-900 placeholder-gray-500'}`} />
                <p className={`text-xs mt-1 ${isDarkMode ? 'text-white/60' : 'text-gray-500'}`}>Enter the contract address of the ERC20 token</p>
              </div>
              <div>
                <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}><div className="flex items-center gap-2"><Tag className="w-4 h-4"/>Token Symbol</div></label>
                <input type="text" value={tokenSymbol} onChange={(e) => setTokenSymbol(e.target.value.toUpperCase())} placeholder="USDC" className={`w-full px-3 py-2.5 border rounded-lg focus:border-[#39FF14] focus:outline-none text-sm ${isDarkMode ? 'bg-gray-900 border-gray-800 text-white placeholder-gray-500' : 'bg-[#F5F3F0] border-gray-400 text-gray-900 placeholder-gray-500'}`} />
                <p className={`text-xs mt-1 ${isDarkMode ? 'text-white/60' : 'text-gray-500'}`}>Enter the token symbol (1-10 uppercase letters/numbers)</p>
              </div>
            </div>
            <div className="pt-4">
              <button onClick={addToken} disabled={!isConnected || isAdding || isPending || isConfirming} className={`w-full px-6 py-3 font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 ${!isConnected || isAdding || isPending || isConfirming ? (isDarkMode ? 'bg-gray-800 cursor-not-allowed text-white/40' : 'bg-gray-300 cursor-not-allowed text-gray-500') : isDarkMode ? 'bg-[#39FF14] hover:bg-[#39FF14]/80 text-black' : 'bg-[#39FF14] hover:bg-[#39FF14]/80 text-black border border-black'}`}>{(isAdding || isPending || isConfirming) && <Loader2 size={20} className="animate-spin" />}{isAdding ? 'Adding Token...' : isPending ? 'Confirming Transaction...' : isConfirming ? 'Processing...' : 'Add Token'}</button>
              {!isConnected && <p className={`text-sm mt-2 text-center ${isDarkMode ? 'text-white/60' : 'text-gray-500'}`}>Please connect your wallet to add a token</p>}
            </div>
            <div className={`mt-6 p-4 rounded-lg border ${isDarkMode ? 'bg-blue-900/20 border-blue-800' : 'bg-blue-50 border-blue-200'}`}>
              <div className={`flex items-start gap-3 ${isDarkMode ? 'text-blue-200' : 'text-blue-800'}`}><Coins className="w-5 h-5 mt-0.5 flex-shrink-0" /><div className="text-sm"><p className="font-medium mb-1">Important Notes:</p><ul className="space-y-1 text-xs"><li>• Only contract owner can add new tokens</li><li>• Token must be a valid ERC20 contract</li><li>• Symbol will be automatically converted to uppercase</li><li>• Once added, tokens can be used for market creation</li></ul></div></div>
            </div>
          </div>
        </div>
      </div>
      </div>
    );
  }

// Blacklist Management Component
function BlacklistManagement({ 
  isDarkMode, 
  blacklistAddress, 
  setBlacklistAddress, 
  isBlacklisting, 
  setIsBlacklisting,
  removeAddress, 
  setRemoveAddress, 
  isRemoving, 
  setIsRemoving,
  userManagementSuccess,
  setUserManagementSuccess
}: { 
  isDarkMode: boolean;
  blacklistAddress: string;
  setBlacklistAddress: (value: string) => void;
  isBlacklisting: boolean;
  setIsBlacklisting: (value: boolean) => void;
  removeAddress: string;
  setRemoveAddress: (value: string) => void;
  isRemoving: boolean;
  setIsRemoving: (value: boolean) => void;
  userManagementSuccess: string;
  setUserManagementSuccess: (value: string) => void;
}) {
  const ADMIN_MANAGER_ADDRESS = process.env.NEXT_PUBLIC_P2P_ADMIN_ADDRESS as `0x${string}`;
  const { writeContract } = useWriteContract();

  // Fetch blacklisted addresses
  const { data: blacklistedAddresses, refetch: refetchBlacklist } = useReadContract({
    address: ADMIN_MANAGER_ADDRESS,
    abi: ADMIN_MANAGER_ABI,
    functionName: 'getBlacklistedAddresses',
  }) as { data: `0x${string}`[] | undefined; refetch: () => void };

  const handleBlacklist = async () => {
    if (!blacklistAddress.trim()) {
      alert('Please enter an address');
      return;
    }

    if (!ethers.isAddress(blacklistAddress)) {
      alert('Invalid address format');
      return;
    }
    
    setIsBlacklisting(true);
    setUserManagementSuccess('');
    
    try {
      await writeContract({
        address: ADMIN_MANAGER_ADDRESS,
        abi: ADMIN_MANAGER_ABI,
        functionName: 'setWalletBlacklist',
        args: [blacklistAddress as `0x${string}`, true],
      });
      
      setUserManagementSuccess(`Blacklisting ${blacklistAddress}...`);
      setBlacklistAddress('');
      
      // Refetch after a delay
      setTimeout(() => {
        refetchBlacklist();
        setUserManagementSuccess(`Address ${blacklistAddress} blacklisted successfully`);
      }, 3000);
      
      setTimeout(() => setUserManagementSuccess(''), 8000);
    } catch (err: any) {
      console.error('Blacklist error:', err);
      alert('Failed to blacklist: ' + (err.message || 'Unknown error'));
      setUserManagementSuccess('');
    } finally {
      setIsBlacklisting(false);
    }
  };

  const handleRemoveFromBlacklist = async () => {
    if (!removeAddress.trim()) {
      alert('Please enter an address');
      return;
    }

    if (!ethers.isAddress(removeAddress)) {
      alert('Invalid address format');
      return;
    }
    
    setIsRemoving(true);
    setUserManagementSuccess('');
    
    try {
      await writeContract({
        address: ADMIN_MANAGER_ADDRESS,
        abi: ADMIN_MANAGER_ABI,
        functionName: 'setWalletBlacklist',
        args: [removeAddress as `0x${string}`, false],
      });
      
      setUserManagementSuccess(`Removing ${removeAddress} from blacklist...`);
      setRemoveAddress('');
      
      // Refetch after a delay
      setTimeout(() => {
        refetchBlacklist();
        setUserManagementSuccess(`Address ${removeAddress} removed from blacklist successfully`);
      }, 3000);
      
      setTimeout(() => setUserManagementSuccess(''), 8000);
    } catch (err: any) {
      console.error('Remove blacklist error:', err);
      alert('Failed to remove from blacklist: ' + (err.message || 'Unknown error'));
      setUserManagementSuccess('');
    } finally {
      setIsRemoving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className={`p-6 rounded-xl border ${isDarkMode ? 'bg-black border-gray-800' : 'bg-[#F5F3F0] border-gray-300'}`}>
        <h2 className={`text-2xl font-bold mb-6 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Blacklist Management</h2>
        
        {userManagementSuccess && (
          <div className={`p-4 rounded-lg border flex items-start gap-3 mb-6 ${
            isDarkMode ? 'bg-green-900/20 border-green-800 text-green-300' : 'bg-green-50 border-green-200 text-green-800'
          }`}>
            <CheckCircle size={20} className="flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Success</p>
              <p className="text-sm">{userManagementSuccess}</p>
            </div>
          </div>
        )}

        {/* Add to Blacklist */}
        <div className={`p-4 rounded-lg border mb-6 ${isDarkMode ? 'bg-gray-900 border-gray-800' : 'bg-gray-200 border-gray-300'}`}>
          <h3 className={`text-lg font-semibold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Add to Blacklist</h3>
          <div className="flex gap-3">
            <input
              type="text"
              value={blacklistAddress}
              onChange={(e) => setBlacklistAddress(e.target.value)}
              placeholder="Enter wallet address (0x...)"
              className={`flex-1 px-4 py-2 border rounded-lg text-sm ${
                isDarkMode 
                  ? 'bg-gray-900 border-gray-800 text-white placeholder-gray-500' 
                  : 'bg-[#F5F3F0] border-gray-400 text-gray-900'
              }`}
      />
            <button
              onClick={handleBlacklist}
              disabled={isBlacklisting || !blacklistAddress.trim()}
              className={`px-6 py-2 rounded-lg text-sm font-semibold transition-colors ${
                isBlacklisting || !blacklistAddress.trim()
                  ? (isDarkMode ? 'bg-gray-800 cursor-not-allowed text-white/40' : 'bg-gray-300 cursor-not-allowed text-gray-500')
                  : 'bg-red-600 hover:bg-red-700 text-white'
              }`}
            >
              {isBlacklisting ? 'Blacklisting...' : 'Blacklist'}
            </button>
          </div>
        </div>

        {/* Remove from Blacklist */}
        <div className={`p-4 rounded-lg border mb-6 ${isDarkMode ? 'bg-gray-900 border-gray-800' : 'bg-gray-200 border-gray-300'}`}>
          <h3 className={`text-lg font-semibold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Remove from Blacklist</h3>
          <div className="flex gap-3">
            <input
              type="text"
              value={removeAddress}
              onChange={(e) => setRemoveAddress(e.target.value)}
              placeholder="Enter wallet address (0x...)"
              className={`flex-1 px-4 py-2 border rounded-lg text-sm ${
                isDarkMode 
                  ? 'bg-gray-900 border-gray-800 text-white placeholder-gray-500' 
                  : 'bg-[#F5F3F0] border-gray-400 text-gray-900'
              }`}
            />
                <button
              onClick={handleRemoveFromBlacklist}
              disabled={isRemoving || !removeAddress.trim()}
              className={`px-6 py-2 rounded-lg text-sm font-semibold transition-colors ${
                isRemoving || !removeAddress.trim()
                  ? (isDarkMode ? 'bg-gray-800 cursor-not-allowed text-white/40' : 'bg-gray-300 cursor-not-allowed text-gray-500')
                  : 'bg-green-600 hover:bg-green-700 text-white'
              }`}
                >
              {isRemoving ? 'Removing...' : 'Remove'}
                </button>
                </div>
              </div>

        {/* Blacklisted Addresses List */}
        <div className={`p-4 rounded-lg border ${isDarkMode ? 'bg-gray-900 border-gray-800' : 'bg-gray-200 border-gray-300'}`}>
          <h3 className={`text-lg font-semibold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            Blacklisted Addresses ({blacklistedAddresses?.length || 0})
          </h3>
          {blacklistedAddresses && blacklistedAddresses.length > 0 ? (
            <div className="space-y-2">
              {blacklistedAddresses.map((address) => (
                <div
                  key={address}
                  className={`flex items-center justify-between p-3 rounded border ${
                    isDarkMode ? 'bg-gray-900 border-gray-800' : 'bg-[#F5F3F0] border-gray-300'
                  }`}
                >
                  <span className={`font-mono text-sm ${isDarkMode ? 'text-white' : 'text-gray-700'}`}>
                    {address}
                    </span>
                  <button
                    onClick={() => {
                      setRemoveAddress(address);
                      handleRemoveFromBlacklist();
                    }}
                    disabled={isRemoving}
                    className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                      isRemoving
                        ? (isDarkMode ? 'bg-gray-800 cursor-not-allowed text-white/40' : 'bg-gray-300 cursor-not-allowed text-gray-500')
                        : isDarkMode ? 'bg-[#39FF14] hover:bg-[#39FF14]/80 text-black' : 'bg-[#39FF14] hover:bg-[#39FF14]/80 text-black border border-black'
                    }`}
                  >
                    Remove
                  </button>
                </div>
              ))}
                  </div>
                ) : (
            <p className={`text-sm ${isDarkMode ? 'text-white/70' : 'text-gray-600'}`}>
              No blacklisted addresses
            </p>
          )}
                    </div>
                  </div>
    </div>
  );
}

// Main Admin Page Component
export default function AdminPage() {
  const { isDarkMode, toggleTheme } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState<'market' | 'blacklist' | 'verifiers' | 'tokens'>('market');
  const [blacklistAddress, setBlacklistAddress] = useState('');
  const [isBlacklisting, setIsBlacklisting] = useState(false);
  const [removeAddress, setRemoveAddress] = useState('');
  const [isRemoving, setIsRemoving] = useState(false);
  const [userManagementSuccess, setUserManagementSuccess] = useState('');
  const { hasAccess, isLoading, isConnected } = useAdminAccess();
  const { address } = useAccount();

  if (isLoading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isDarkMode ? 'bg-black' : 'bg-[#F5F3F0]'}`}>
        <div className={`animate-spin rounded-full h-12 w-12 border-b-2 ${isDarkMode ? 'border-[#39FF14]' : 'border-emerald-600'}`}></div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${isDarkMode ? 'bg-black' : 'bg-[#F5F3F0]'}`}>
      <Sidebar 
        isOpen={sidebarOpen} 
        onClose={() => setSidebarOpen(false)}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        isDarkMode={isDarkMode}
      />
      <div className={`transition-all duration-300 ${sidebarCollapsed ? 'lg:ml-16' : 'lg:ml-64'}`}>
        <div className={`sticky top-0 z-40 border-b ${isDarkMode ? 'bg-black border-[#39FF14]/20' : 'bg-[#F5F3F0] border-gray-200'}`}>
          <div className="px-4 sm:px-6 py-1.5 lg:py-2 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSidebarOpen(true)}
                className={`lg:hidden p-2 rounded-lg transition-colors ${
                  isDarkMode ? 'hover:bg-[#39FF14]/10 text-white' : 'hover:bg-gray-200'
                }`}
              >
                <Menu size={20} className={isDarkMode ? 'text-white' : 'text-gray-900'} />
              </button>
              <Link href="/" className="lg:hidden transition-opacity hover:opacity-80 cursor-pointer">
                <Image
                  src="/mobile.png"
                  alt="P2P"
                  width={60}
                  height={30}
                  className="object-contain"
                  priority
                />
              </Link>
              <h1 className={`text-xl sm:text-2xl font-bold hidden lg:block ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Admin Panel</h1>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={toggleTheme}
                className={`p-1.5 lg:p-2 rounded-lg transition-colors ${
                  isDarkMode ? 'hover:bg-[#39FF14]/10 text-white' : 'hover:bg-gray-200'
                }`}
              >
                {isDarkMode ? <Sun size={20} className="text-white" /> : <Moon size={20} className="text-gray-600" />}
              </button>
              <ConnectButton.Custom>
                {({ account, chain, openConnectModal, mounted }) => {
                  const ready = mounted && account && chain;
                  return ready ? (
                    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs sm:text-sm font-medium ${
                      isDarkMode 
                        ? 'bg-[#39FF14]/10 text-white border border-[#39FF14]/30' 
                        : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    }`}>
                      <Wallet size={14} />
                      <span className="font-mono">{account?.address?.slice(0, 6)}...{account?.address?.slice(-4)}</span>
                  </div>
                ) : (
                <button
                      onClick={openConnectModal}
                      className={`px-4 py-2 rounded-lg text-sm font-semibold ${
                        isDarkMode 
                          ? 'bg-[#39FF14] hover:bg-[#39FF14]/80 text-black' 
                          : 'bg-[#39FF14] hover:bg-[#39FF14]/80 text-black border border-black'
                      }`}
                >
                      Connect
                </button>
                  );
                }}
              </ConnectButton.Custom>
              </div>
            </div>
          </div>
        <div className="p-4 sm:p-6">
          <div className="max-w-6xl mx-auto">
          {!isConnected ? (
            <div className={`p-4 sm:p-8 rounded-xl border ${isDarkMode ? 'bg-black border-gray-800' : 'bg-[#F5F3F0] border-gray-300'}`}>
                <h2 className={`text-lg sm:text-2xl font-bold mb-3 sm:mb-4 text-center ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Connect Wallet Required</h2>
                <p className={`text-center mb-4 sm:mb-6 text-sm sm:text-base ${isDarkMode ? 'text-white/70' : 'text-gray-600'}`}>Please connect your wallet to access the admin panel.</p>
                <div className="flex justify-center"><div className="scale-90 sm:scale-100"><ConnectButton /></div></div>
            </div>
          ) : !hasAccess ? (
            <div className={`p-4 sm:p-8 rounded-xl border ${isDarkMode ? 'bg-black border-gray-800' : 'bg-[#F5F3F0] border-gray-300'}`}>
                <h2 className={`text-lg sm:text-2xl font-bold mb-3 sm:mb-4 text-center ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Access Denied</h2>
                <p className={`text-center mb-3 sm:mb-4 text-sm sm:text-base ${isDarkMode ? 'text-white/70' : 'text-gray-600'}`}>You don't have permission to access the admin panel.</p>
              <div className={`text-center text-xs sm:text-sm ${isDarkMode ? 'text-white/60' : 'text-gray-500'}`}>
                <p>Owner: {process.env.NEXT_PUBLIC_OWNER_ADDRESS?.slice(0, 6)}...{process.env.NEXT_PUBLIC_OWNER_ADDRESS?.slice(-4)}</p>
                <p>Partner: {process.env.NEXT_PUBLIC_PARTNER_ADDRESS?.slice(0, 6)}...{process.env.NEXT_PUBLIC_PARTNER_ADDRESS?.slice(-4)}</p>
                <p>Your Address: {address?.slice(0, 6)}...{address?.slice(-4)}</p>
              </div>
            </div>
          ) : (
            <>
              <div className={`flex gap-1 p-1 rounded-lg mb-4 sm:mb-6 ${isDarkMode ? 'bg-gray-900' : 'bg-gray-200'}`}>
                {[
                  { id: 'market', label: 'Market Management' },
                    { id: 'tokens', label: 'Token Management' },
                  { id: 'blacklist', label: 'Blacklist Management' },
                  { id: 'verifiers', label: 'Verifier Management' }
                ].map((tab) => (
                    <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`px-2 sm:px-4 py-2 rounded-md text-xs sm:text-sm font-medium transition-colors flex-1 sm:flex-none ${activeTab === tab.id ? (isDarkMode ? 'bg-[#39FF14] text-black' : 'bg-[#39FF14] text-black border border-black shadow-sm') : (isDarkMode ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900')}`}> <span className="hidden sm:inline">{tab.label}</span><span className="sm:hidden">{tab.id === 'market' ? 'Market' : tab.id === 'blacklist' ? 'Users' : tab.id === 'verifiers' ? 'Verifiers' : 'Tokens'}</span> </button>
                ))}
              </div>
              <div className="space-y-6">
                {activeTab === 'market' && (
                  <MarketSearch 
                    isDarkMode={isDarkMode}
                    blacklistAddress={blacklistAddress}
                    setBlacklistAddress={setBlacklistAddress}
                    isBlacklisting={isBlacklisting}
                    removeAddress={removeAddress}
                    setRemoveAddress={setRemoveAddress}
                    isRemoving={isRemoving}
                    userManagementSuccess={userManagementSuccess}
                      handleBlacklistUser={() => setIsBlacklisting(true)}
                      handleRemoveUser={() => setIsRemoving(true)}
                  />
                )}
                  {activeTab === 'tokens' && (<TokenManagementSection isDarkMode={isDarkMode} />)}
                {activeTab === 'blacklist' && (
                  <BlacklistManagement 
                    isDarkMode={isDarkMode}
                    blacklistAddress={blacklistAddress}
                    setBlacklistAddress={setBlacklistAddress}
                    isBlacklisting={isBlacklisting}
                    setIsBlacklisting={setIsBlacklisting}
                    removeAddress={removeAddress}
                    setRemoveAddress={setRemoveAddress}
                    isRemoving={isRemoving}
                    setIsRemoving={setIsRemoving}
                    userManagementSuccess={userManagementSuccess}
                    setUserManagementSuccess={setUserManagementSuccess}
                  />
                )}
                  {activeTab === 'verifiers' && (<VerifierManagement isDarkMode={isDarkMode} />)}
                        </div>
              </>
            )}
                      </div>
                        </div>
                      </div>
                    </div>
  );
}

function MarketParticipants({ marketId, isDarkMode }: { marketId: number; isDarkMode: boolean }) {
  const [open, setOpen] = useState(false);
  const [participants, setParticipants] = useState<{stakers: `0x${string}`[], supporters: `0x${string}`[], creator?: `0x${string}`, paymentToken?: `0x${string}`, tokenSymbol?: string}>({stakers: [], supporters: []});
  const [loading, setLoading] = useState(false);
  const [marketMetadata, setMarketMetadata] = useState<any>(null);
  const [loadingMetadata, setLoadingMetadata] = useState(false);

  // Get stakers directly - more reliable than getMarketInfo arrays
  const { data: directStakers } = useReadContract({
    address: process.env.NEXT_PUBLIC_P2P_MARKET_MANAGER_ADDRESS as `0x${string}`,
    abi: [
      {
        inputs: [{ name: 'marketId', type: 'uint256' }],
        name: 'getMarketStakers',
        outputs: [{ name: '', type: 'address[]' }],
        stateMutability: 'view',
        type: 'function',
      }
    ],
    functionName: 'getMarketStakers',
    args: [BigInt(marketId)],
    query: { enabled: open }
  });

  // Get supporters - check if there's a similar function, otherwise use getMarketInfo
  const { data: supporterCount } = useReadContract({
    address: process.env.NEXT_PUBLIC_P2P_MARKET_MANAGER_ADDRESS as `0x${string}`,
    abi: [
      {
        inputs: [{ name: 'marketId', type: 'uint256' }],
        name: 'getSupporterCount',
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'view',
        type: 'function',
      }
    ],
    functionName: 'getSupporterCount',
    args: [BigInt(marketId)],
    query: { enabled: open }
  });

  const { data } = useReadContract({
    address: process.env.NEXT_PUBLIC_P2P_MARKET_MANAGER_ADDRESS as `0x${string}`,
    abi: [
      {
        inputs: [{ name: 'marketId', type: 'uint256' }],
        name: 'getMarketInfo',
        outputs: [
          {
            components: [
              { name: 'creator', type: 'address' },
              { name: 'ipfsHash', type: 'string' },
              { name: 'isMultiOption', type: 'bool' },
              { name: 'maxOptions', type: 'uint256' },
              { name: 'paymentToken', type: 'address' },
              { name: 'minStake', type: 'uint256' },
              { name: 'creatorDeposit', type: 'uint256' },
              { name: 'creatorOutcome', type: 'uint256' },
              { name: 'startTime', type: 'uint256' },
              { name: 'stakeEndTime', type: 'uint256' },
              { name: 'endTime', type: 'uint256' },
              { name: 'resolutionEndTime', type: 'uint256' },
              { name: 'state', type: 'uint8' },
              { name: 'winningOption', type: 'uint256' },
              { name: 'isResolved', type: 'bool' }
            ],
            name: 'market',
            type: 'tuple'
          },
          { name: 'totalPool', type: 'uint256' },
          { name: 'supportPool', type: 'uint256' },
          { name: 'stakerCount', type: 'uint256' },
          { name: 'supporterCount', type: 'uint256' },
          { name: 'stakers', type: 'address[]' },
          { name: 'supporters', type: 'address[]' },
          { name: 'tokenSymbol', type: 'string' },
        ],
        stateMutability: 'view',
        type: 'function',
      }
    ],
    functionName: 'getMarketInfo',
    args: [BigInt(marketId)],
    query: { enabled: open }
  });

  useEffect(() => {
    setParticipants({stakers: [], supporters: []});
    setOpen(false);
    setMarketMetadata(null);
  }, [marketId]);

  // Fetch market metadata for options
  useEffect(() => {
    if (open && data && !marketMetadata && !loadingMetadata) {
      const marketData = data[0] as any;
      if (marketData?.ipfsHash) {
        setLoadingMetadata(true);
        const fetchMetadata = async () => {
          try {
            const response = await fetch(`https://gateway.lighthouse.storage/ipfs/${marketData.ipfsHash}`);
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
    }
  }, [open, data, marketMetadata, loadingMetadata]);

  // Helper to get market options
  const getMarketOptions = () => {
    if (marketMetadata?.options && Array.isArray(marketMetadata.options)) {
      return marketMetadata.options;
    }
    // Get from market data if available
    const marketData = data?.[0] as any;
    if (marketData?.isMultiOption) {
      const maxOpts = marketData?.maxOptions ? Number(marketData.maxOptions) : 4;
      return ['Option 1', 'Option 2', 'Option 3', 'Option 4'].slice(0, maxOpts);
    }
    return ['Yes', 'No'];
  };
  useEffect(() => {
    if (data && directStakers !== undefined) {
      const marketData = data[0] as any;
      const paymentToken = (marketData?.paymentToken || '0x0000000000000000000000000000000000000000') as `0x${string}`;
      const creator = marketData?.creator ? (marketData.creator.toLowerCase() as `0x${string}`) : undefined;
      
      // Use direct stakers call - more reliable
      const allStakers = Array.isArray(directStakers) 
        ? directStakers
            .filter((addr): addr is string => typeof addr === 'string' && addr.length === 42)
            .map((addr: string) => addr.toLowerCase() as `0x${string}`)
        : [];
      
      // Get supporters from getMarketInfo (no direct function available)
      let supportersArray: any[] = [];
      if (Array.isArray(data[6])) {
        supportersArray = data[6];
      }
      
      const allSupporters = supportersArray
        .filter((addr): addr is string => typeof addr === 'string' && addr.length === 42)
        .map((addr: string) => addr.toLowerCase() as `0x${string}`);
      
      setParticipants({
        stakers: allStakers,
        supporters: allSupporters,
        creator: creator,
        paymentToken: paymentToken.toLowerCase() as `0x${string}`,
        tokenSymbol: data[7] || 'Token'
      });
      setLoading(false);
    } else if (open && !data && directStakers === undefined) {
      setLoading(true);
    }
  }, [data, directStakers, open, supporterCount]);

  return (
    <div className="w-full mt-4">
      <button onClick={() => setOpen(v => !v)} className={`w-full flex items-center justify-between rounded-md px-3 py-2 border font-medium transition-colors ${open ? (isDarkMode ? 'bg-[#39FF14]/20 border-[#39FF14]/30 text-[#39FF14]' : 'bg-[#39FF14]/20 border-black text-green-800') : (isDarkMode ? 'bg-gray-900 border-gray-800 text-white/70' : 'bg-gray-200 border-gray-300 text-gray-700')}`}>
        <span>{open ? 'Hide Participants' : 'Show Participants'}</span>
        <svg className={`w-4 h-4 ml-2 transform transition-transform duration-150 ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
      </button>
      {open && (
        <div className={`mt-3 p-3 rounded border ${isDarkMode ? 'bg-gray-900 border-gray-800' : 'bg-[#F5F3F0] border-gray-300'}`}>
          {loading && <div className={`text-sm ${isDarkMode ? 'text-white/70' : 'text-gray-600'}`}>Loading...</div>}
          {!loading && participants.stakers.length === 0 && participants.supporters.length === 0 && !participants.creator && <div className={`text-sm ${isDarkMode ? 'text-white/70' : 'text-gray-600'}`}>No participants found.</div>}
          {!loading && (participants.stakers.length > 0 || participants.supporters.length > 0 || participants.creator) && (
            <div className="overflow-x-auto">
              <table className={`min-w-full text-xs border rounded ${isDarkMode ? 'border-gray-800' : 'border-gray-300'}`}>
                <thead>
                  <tr className={isDarkMode ? 'bg-gray-900' : 'bg-gray-200'}>
                    <th className={`px-2 py-1 text-left ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Address</th>
                    <th className={`px-2 py-1 text-left ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Role</th>
                    <th className={`px-2 py-1 text-left ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Option</th>
                    <th className={`px-2 py-1 text-left ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Amount ({participants.tokenSymbol || 'Token'})</th>
                  </tr>
                </thead>
                <tbody>
                  {participants.creator && (
                    <ParticipantRow
                      key={`creator-${participants.creator}`}
                      marketId={marketId}
                      userAddress={participants.creator}
                      paymentToken={participants.paymentToken || '0x0000000000000000000000000000000000000000' as `0x${string}`}
                      isDarkMode={isDarkMode}
                      isSupporter={false}
                      isCreator={true}
                      marketData={data?.[0]}
                      marketOptions={getMarketOptions()}
                    />
                  )}
                  {participants.stakers.map((addr) => (
                    <ParticipantRow
                      key={`staker-${addr}`}
                      marketId={marketId}
                      userAddress={addr}
                      paymentToken={participants.paymentToken || '0x0000000000000000000000000000000000000000' as `0x${string}`}
                      isDarkMode={isDarkMode}
                      isSupporter={false}
                      isCreator={false}
                      marketOptions={getMarketOptions()}
                    />
                  ))}
                  {participants.supporters.map((addr) => (
                    <ParticipantRow
                      key={`supporter-${addr}`}
                      marketId={marketId}
                      userAddress={addr}
                      paymentToken={participants.paymentToken || '0x0000000000000000000000000000000000000000' as `0x${string}`}
                      isDarkMode={isDarkMode}
                      isSupporter={true}
                      isCreator={false}
                      marketOptions={getMarketOptions()}
                    />
                  ))}
                </tbody>
              </table>
                  </div>
                )}
              </div>
          )}
    </div>
  );
}

// Responsible for showing address/option/amount for a single address
function ParticipantRow({ marketId, userAddress, paymentToken, isDarkMode, isSupporter = false, isCreator = false, marketData, marketOptions = ['Yes', 'No'] }: { marketId: number, userAddress: `0x${string}`, paymentToken: `0x${string}`, isDarkMode: boolean, isSupporter?: boolean, isCreator?: boolean, marketData?: any, marketOptions?: string[] }) {
  const MARKET_MANAGER_ADDRESS = process.env.NEXT_PUBLIC_P2P_MARKET_MANAGER_ADDRESS as `0x${string}`;
  const TREASURY_ADDRESS = process.env.NEXT_PUBLIC_P2P_TREASURY_ADDRESS as `0x${string}`;
  
  const { data: option, isLoading: loadingOption } = useReadContract({
    address: MARKET_MANAGER_ADDRESS,
    abi: [
      {
        inputs: [ { name: 'marketId', type: 'uint256' }, { name: 'user', type: 'address' } ],
        name: 'userStakeOptions',
        outputs: [ { name: '', type: 'uint256' } ],
        stateMutability: 'view',
        type: 'function',
      },
    ],
    functionName: 'userStakeOptions',
    args: [BigInt(marketId), userAddress],
    query: { enabled: !isSupporter && !!userAddress && !!marketId }
  });

  const { data: stakeAmount, isLoading: loadingStake } = useReadContract({
    address: TREASURY_ADDRESS,
    abi: [
      {
        inputs: [ { name: 'marketId', type: 'uint256' }, { name: 'user', type: 'address' }, { name: 'token', type: 'address' } ],
        name: 'getUserStake',
        outputs: [ { name: '', type: 'uint256' } ],
        stateMutability: 'view',
        type: 'function',
      },
    ],
    functionName: 'getUserStake',
    args: [BigInt(marketId), userAddress, paymentToken],
    query: { enabled: !isSupporter && !!userAddress && !!marketId && !!paymentToken }
  });

  const { data: supportAmount, isLoading: loadingSupport } = useReadContract({
    address: TREASURY_ADDRESS,
    abi: [
      {
        inputs: [ { name: 'marketId', type: 'uint256' }, { name: 'user', type: 'address' }, { name: 'token', type: 'address' } ],
        name: 'getUserSupport',
        outputs: [ { name: '', type: 'uint256' } ],
        stateMutability: 'view',
        type: 'function',
      },
    ],
    functionName: 'getUserSupport',
    args: [BigInt(marketId), userAddress, paymentToken],
    query: { enabled: isSupporter && !!userAddress && !!marketId && !!paymentToken }
  });

  const amount = isSupporter ? supportAmount : stakeAmount;
  const loadingAmount = isSupporter ? loadingSupport : loadingStake;


  return (
    <tr className={isDarkMode ? 'border-b border-gray-800' : 'border-b border-gray-300'}>
      <td className={`font-mono px-2 py-1 flex items-center gap-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
        {userAddress.slice(0, 6)}...{userAddress.slice(-4)}
        <button 
          onClick={() => navigator.clipboard.writeText(userAddress)} 
          className={`ml-1 px-1 rounded text-xs ${isDarkMode ? 'bg-[#39FF14] hover:bg-[#39FF14]/80 text-black' : 'bg-[#39FF14] hover:bg-[#39FF14]/80 text-black border border-black'}`}
        >
          Copy
        </button>
      </td>
      <td className={`px-2 py-1 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
        {isCreator ? (
          <span className={`text-xs px-1.5 py-0.5 rounded ${isDarkMode ? 'bg-purple-900/30 text-purple-300' : 'bg-purple-100 text-purple-700'}`}>Creator</span>
        ) : isSupporter ? (
          <span className={`text-xs px-1.5 py-0.5 rounded ${isDarkMode ? 'bg-blue-900/30 text-blue-300' : 'bg-blue-100 text-blue-700'}`}>Supporter</span>
        ) : (
          <span className={`text-xs px-1.5 py-0.5 rounded ${isDarkMode ? 'bg-[#39FF14]/20 text-[#39FF14]' : 'bg-[#39FF14]/20 text-green-700 border border-black'}`}>Staker</span>
        )}
      </td>
      <td className={`px-2 py-1 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
        {isCreator ? (
          marketData?.creatorOutcome ? (() => {
            const optionIndex = Number(marketData.creatorOutcome) - 1;
            return marketOptions[optionIndex] || `Option ${marketData.creatorOutcome}`;
          })() : '-'
        ) : isSupporter ? (
          <span className={isDarkMode ? 'text-white/60' : 'text-gray-400'}>-</span>
        ) : loadingOption ? (
          <span className={`text-xs ${isDarkMode ? 'text-white/60' : 'text-gray-400'}`}>Loading...</span>
        ) : option !== undefined && option !== null && Number(option) > 0 ? (
          (() => {
            const optionIndex = Number(option) - 1;
            return marketOptions[optionIndex] || `Option ${option}`;
          })()
        ) : (
          '-'
        )}
      </td>
      <td className={`px-2 py-1 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
        {isCreator ? (
          marketData?.creatorDeposit ? formatEther(marketData.creatorDeposit) : '0'
        ) : loadingAmount ? (
          <span className={`text-xs ${isDarkMode ? 'text-white/60' : 'text-gray-400'}`}>Loading...</span>
        ) : amount !== undefined && amount !== null && amount > BigInt(0) ? (
          formatEther(amount)
        ) : (
          '0'
        )}
      </td>
    </tr>
  );
}