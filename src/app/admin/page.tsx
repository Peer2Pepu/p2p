'use client';

import { useState, useEffect } from 'react';
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
  Moon
} from 'lucide-react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { formatEther } from 'viem';
import { ethers } from 'ethers';
import { Sidebar } from '../components/Sidebar';
import { useTheme } from '../context/ThemeContext';
import { createClient } from '@supabase/supabase-js';

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

  const marketManagerAddress = process.env.NEXT_PUBLIC_P2P_MARKET_MANAGER_ADDRESS as `0x${string}`;
  const { writeContract } = useWriteContract();
  const { address: userAddress } = useAccount();

  // Get token symbol from contract
  const { data: tokenSymbol } = useReadContract({
    address: marketManagerAddress,
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
    
    // Check if market has ended
    const currentTime = Math.floor(Date.now() / 1000);
    const endTime = Number(marketData.endTime);
    
    if (currentTime > endTime) {
      alert('Cannot support market after it has ended');
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
          args: [marketManagerAddress, amount]
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
          args: [BigInt(searchId), amount]
        });
        
        console.log('Support transaction hash:', supportHash);
      } else {
        // For ETH, use supportMarket with value
        await writeContract({
          address: marketManagerAddress,
          abi: MARKET_MANAGER_ABI,
          functionName: 'supportMarket',
          args: [BigInt(searchId), amount],
          value: amount
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
            isDarkMode 
              ? 'bg-[#1a1d2e] border-gray-700 hover:shadow-gray-900/50' 
              : 'bg-white border-gray-200 hover:shadow-gray-900/20'
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
                        className="w-12 h-12 rounded-lg object-cover border border-gray-700"
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
                    isDarkMode ? 'bg-gray-700' : 'bg-gray-200'
                  }`}>
                    <span className={`font-bold text-xs ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>#{searchedMarketId}</span>
                  </div>
                </div>
              </div>

              {/* Market Details */}
              <div className="space-y-2 mb-4 flex-1">
                <div className="flex justify-between text-sm">
                <span className="text-gray-500">Creator:</span>
                <span className={`font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  {marketData.creator?.slice(0, 6)}...{marketData.creator?.slice(-4)}
                </span>
              </div>
                <div className="flex justify-between text-sm">
                <span className="text-gray-500">Min Stake:</span>
                <span className={`font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  {formatEther(marketData.minStake)} {tokenSymbol || 'Token'}
                </span>
              </div>
                <div className="flex justify-between text-sm">
                <span className="text-gray-500">Ends:</span>
                <span className={`font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  {new Date(Number(marketData.endTime) * 1000).toLocaleDateString()}
                </span>
              </div>
                {supportPool !== undefined && (
                  <div className="flex justify-between text-sm">
                <span className="text-gray-500">Total Support:</span>
                <span className={`font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                      {formatEther(supportPool)} {tokenSymbol || 'Token'}
                </span>
              </div>
                )}
            </div>

              {/* Admin Actions */}
              <div className="flex gap-2 mt-auto">
                {/* Delete button - only show for non-deleted markets */}
                {Number(marketData.state) !== 4 && (
                <button
                    onClick={() => setShowDeleteModal(true)}
                    disabled={isDeleting || isPermanentlyDeleting}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                      isDeleting || isPermanentlyDeleting
                      ? 'bg-gray-600 cursor-not-allowed text-gray-400'
                        : 'bg-red-600 hover:bg-red-700 text-white'
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
                      ? 'bg-gray-600 cursor-not-allowed text-gray-400'
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

        {/* Delete Modal */}
        {showDeleteModal && searchedMarketId && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className={`rounded-lg max-w-sm w-full shadow-xl ${
              isDarkMode ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200'
            }`}>
              <div className="p-4">
                <h3 className={`text-lg font-semibold mb-3 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  Delete Market #{searchedMarketId}
                </h3>
                <p className={`text-xs mb-3 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  Soft delete - users can still claim refunds
                </p>
                <div className="mb-4">
                  <label className={`block text-xs font-medium mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    Reason
                  </label>
                  <textarea
                    value={deleteReason}
                    onChange={(e) => setDeleteReason(e.target.value)}
                    placeholder="Enter reason..."
                    rows={2}
                    className={`w-full px-2 py-1.5 border rounded text-xs ${
                      isDarkMode 
                        ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                        : 'bg-white border-gray-300 text-gray-900'
                    }`}
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowDeleteModal(false)}
                    className={`flex-1 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                      isDarkMode 
                        ? 'bg-gray-600 hover:bg-gray-500 text-white' 
                        : 'bg-gray-200 hover:bg-gray-300 text-gray-900'
                    }`}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSoftDelete}
                    disabled={!deleteReason.trim() || isDeleting || isPermanentlyDeleting}
                    className={`flex-1 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                      !deleteReason.trim() || isDeleting || isPermanentlyDeleting
                        ? 'bg-gray-400 cursor-not-allowed text-gray-200'
                        : 'bg-red-600 hover:bg-red-700 text-white'
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
      <div className={`p-4 sm:p-6 rounded-xl border ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
        <h2 className={`text-lg sm:text-2xl font-bold mb-3 sm:mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
          Verifier Management
        </h2>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-4 sm:mb-6">
          <div className={`p-3 sm:p-4 rounded-lg border ${isDarkMode ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'}`}>
            <div className="flex items-center gap-2 mb-2">
              <Users size={20} className="text-blue-500" />
              <span className={`text-xs sm:text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                Active Verifiers
              </span>
            </div>
            <div className={`text-xl sm:text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              {verifierCount ? Number(verifierCount) : 0}
            </div>
          </div>
          
          <div className={`p-3 sm:p-4 rounded-lg border ${isDarkMode ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'}`}>
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
          
          <div className={`p-3 sm:p-4 rounded-lg border ${isDarkMode ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'}`}>
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle size={20} className="text-green-500" />
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
          <div className={`p-4 rounded-lg border ${isDarkMode ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'}`}>
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
                    ? 'bg-gray-800 border-gray-600 text-white placeholder-gray-400' 
                    : 'bg-white border-gray-300 text-gray-900'
                }`}
              />
              <button
                onClick={handleAddVerifier}
                disabled={!addVerifierAddress.trim() || isAdding || (!!maxVerifiers && !!verifierCount && Number(verifierCount) >= Number(maxVerifiers))}
                className={`w-full px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                  !addVerifierAddress.trim() || isAdding || (!!maxVerifiers && !!verifierCount && Number(verifierCount) >= Number(maxVerifiers))
                    ? 'bg-gray-600 cursor-not-allowed text-gray-400'
                    : 'bg-green-600 hover:bg-green-700 text-white'
                }`}
              >
                {isAdding ? 'Adding...' : 
                 (!!maxVerifiers && !!verifierCount && Number(verifierCount) >= Number(maxVerifiers)) ? 'Max Verifiers Reached' : 
                 'Add Verifier'}
              </button>
            </div>
          </div>

          {/* Remove Verifier */}
          <div className={`p-4 rounded-lg border ${isDarkMode ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'}`}>
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
                    ? 'bg-gray-800 border-gray-600 text-white placeholder-gray-400' 
                    : 'bg-white border-gray-300 text-gray-900'
                }`}
              />
              <button
                onClick={handleRemoveVerifier}
                disabled={!removeVerifierAddress.trim() || isRemoving}
                className={`w-full px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                  !removeVerifierAddress.trim() || isRemoving
                    ? 'bg-gray-600 cursor-not-allowed text-gray-400'
                    : 'bg-red-600 hover:bg-red-700 text-white'
                }`}
              >
                {isRemoving ? 'Removing...' : 'Remove Verifier'}
              </button>
            </div>
          </div>
        </div>

        {/* Current Verifiers List */}
        <div className={`p-4 rounded-lg border ${isDarkMode ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'}`}>
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
                  isDarkMode ? 'bg-gray-800 border-gray-600' : 'bg-white border-gray-200'
                }`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      isDarkMode ? 'bg-emerald-600' : 'bg-emerald-100'
                    }`}>
                      <Users size={16} className={isDarkMode ? 'text-white' : 'text-emerald-800'} />
                    </div>
                    <div className="flex-1">
                      <button
                        onClick={() => navigator.clipboard.writeText(verifier)}
                        className={`font-mono text-sm hover:underline cursor-pointer transition-colors ${
                          isDarkMode ? 'text-white hover:text-emerald-400' : 'text-gray-900 hover:text-emerald-600'
                        }`}
                        title="Click to copy full address"
                      >
                        {verifier.slice(0, 6)}...{verifier.slice(-4)}
                      </button>
                      <p className={`text-xs mt-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                        Click to copy full address
                      </p>
                    </div>
                  </div>
                  <div className={`px-2 py-1 rounded text-xs font-medium ${
                    isDarkMode ? 'bg-green-900 text-green-300' : 'bg-green-100 text-green-800'
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

// Main Admin Page Component
export default function AdminPage() {
  const { isDarkMode, toggleTheme } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState<'market' | 'blacklist' | 'verifiers'>('market');

  // User Management State
  const [blacklistAddress, setBlacklistAddress] = useState('');
  const [isBlacklisting, setIsBlacklisting] = useState(false);
  const [removeAddress, setRemoveAddress] = useState('');
  const [isRemoving, setIsRemoving] = useState(false);
  const [userManagementSuccess, setUserManagementSuccess] = useState('');

  const { hasAccess, isLoading, isConnected } = useAdminAccess();
  const { address } = useAccount();
  const { writeContract } = useWriteContract();
  const marketManagerAddress = process.env.NEXT_PUBLIC_P2P_MARKET_MANAGER_ADDRESS as `0x${string}`;

  if (isLoading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isDarkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  const onSidebarClose = () => setSidebarOpen(false);
  const onToggleCollapse = () => setSidebarCollapsed(!sidebarCollapsed);

  const handleBlacklistUser = async () => {
    if (!blacklistAddress.trim()) return;
    
    setIsBlacklisting(true);
    try {
      await writeContract({
        address: marketManagerAddress,
        abi: [
          {
            "inputs": [{"name": "user", "type": "address"}],
            "name": "blacklistUser",
            "outputs": [],
            "stateMutability": "nonpayable",
            "type": "function"
          }
        ],
        functionName: 'blacklistUser',
        args: [blacklistAddress as `0x${string}`]
      });
      
      setUserManagementSuccess(`User ${blacklistAddress.slice(0, 6)}...${blacklistAddress.slice(-4)} blacklisted successfully`);
      setBlacklistAddress('');
      setTimeout(() => setUserManagementSuccess(''), 5000);
      
    } catch (err: any) {
      console.error('Blacklist failed:', err);
    } finally {
      setIsBlacklisting(false);
    }
  };

  const handleRemoveUser = async () => {
    if (!removeAddress.trim()) return;
    
    setIsRemoving(true);
    try {
      await writeContract({
        address: marketManagerAddress,
        abi: [
          {
            "inputs": [{"name": "user", "type": "address"}],
            "name": "removeUser",
            "outputs": [],
            "stateMutability": "nonpayable",
            "type": "function"
          }
        ],
        functionName: 'removeUser',
        args: [removeAddress as `0x${string}`]
      });
      
      setUserManagementSuccess(`User ${removeAddress.slice(0, 6)}...${removeAddress.slice(-4)} removed successfully`);
      setRemoveAddress('');
      setTimeout(() => setUserManagementSuccess(''), 5000);
      
    } catch (err: any) {
      console.error('Remove failed:', err);
    } finally {
      setIsRemoving(false);
    }
  };

  return (
    <div className={`min-h-screen ${isDarkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
      <Sidebar 
        isOpen={sidebarOpen} 
        onClose={onSidebarClose} 
        collapsed={sidebarCollapsed}
        onToggleCollapse={onToggleCollapse}
        isDarkMode={isDarkMode}
      />
      
      <div className={`transition-all duration-300 ${sidebarCollapsed ? 'lg:ml-16' : 'lg:ml-64'}`}>
        {/* Header */}
        <div className={`sticky top-0 z-40 border-b ${isDarkMode ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'}`}>
          <div className="px-4 sm:px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 sm:gap-4">
                <button
                  onClick={() => setSidebarOpen(true)}
                  className={`lg:hidden p-2 rounded-lg ${isDarkMode ? 'bg-gray-800 text-white hover:bg-gray-700' : 'bg-white text-gray-900 hover:bg-gray-50'} shadow-sm transition-colors`}
                >
                  <Menu size={20} />
                </button>
                <div className="min-w-0 flex-1">
                  <h1 className={`text-lg sm:text-2xl font-bold truncate ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    Admin Panel
                  </h1>
                  <p className={`text-xs sm:text-sm hidden sm:block ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    Manage markets, users, and platform settings
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 sm:gap-4">
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

        {/* Main Content */}
        <div className="p-4 sm:p-6">
          {!isConnected ? (
            <div className={`p-4 sm:p-8 rounded-xl border ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
              <h2 className={`text-lg sm:text-2xl font-bold mb-3 sm:mb-4 text-center ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                Connect Wallet Required
              </h2>
              <p className={`text-center mb-4 sm:mb-6 text-sm sm:text-base ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                Please connect your wallet to access the admin panel.
              </p>
              <div className="flex justify-center">
                <div className="scale-90 sm:scale-100">
                  <ConnectButton />
                </div>
              </div>
            </div>
          ) : !hasAccess ? (
            <div className={`p-4 sm:p-8 rounded-xl border ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
              <h2 className={`text-lg sm:text-2xl font-bold mb-3 sm:mb-4 text-center ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                Access Denied
              </h2>
              <p className={`text-center mb-3 sm:mb-4 text-sm sm:text-base ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                You don't have permission to access the admin panel.
              </p>
              <div className={`text-center text-xs sm:text-sm ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                <p>Owner: {process.env.NEXT_PUBLIC_OWNER_ADDRESS?.slice(0, 6)}...{process.env.NEXT_PUBLIC_OWNER_ADDRESS?.slice(-4)}</p>
                <p>Partner: {process.env.NEXT_PUBLIC_PARTNER_ADDRESS?.slice(0, 6)}...{process.env.NEXT_PUBLIC_PARTNER_ADDRESS?.slice(-4)}</p>
                <p>Your Address: {address?.slice(0, 6)}...{address?.slice(-4)}</p>
              </div>
            </div>
          ) : (
            <>
              {/* Tab Navigation */}
              <div className={`flex gap-1 p-1 rounded-lg mb-4 sm:mb-6 ${isDarkMode ? 'bg-gray-800' : 'bg-gray-200'}`}>
                {[
                  { id: 'market', label: 'Market Management' },
                  { id: 'blacklist', label: 'Blacklist Management' },
                  { id: 'verifiers', label: 'Verifier Management' }
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`px-2 sm:px-4 py-2 rounded-md text-xs sm:text-sm font-medium transition-colors flex-1 sm:flex-none ${
                      activeTab === tab.id
                        ? isDarkMode
                          ? 'bg-blue-600 text-white'
                          : 'bg-white text-blue-600 shadow-sm'
                        : isDarkMode
                          ? 'text-gray-400 hover:text-white'
                          : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <span className="hidden sm:inline">{tab.label}</span>
                    <span className="sm:hidden">
                      {tab.id === 'market' ? 'Market' : 
                       tab.id === 'blacklist' ? 'Users' : 'Verifiers'}
                    </span>
                  </button>
                ))}
              </div>

              {/* Tab Content */}
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
                    handleBlacklistUser={handleBlacklistUser}
                    handleRemoveUser={handleRemoveUser}
                  />
                )}
                {activeTab === 'blacklist' && (
                  <div className={`p-6 rounded-xl border ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                    <h2 className={`text-2xl font-bold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                      User Management
                    </h2>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Blacklist User */}
                      <div className={`p-4 rounded-lg border ${isDarkMode ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'}`}>
                        <h3 className={`text-lg font-semibold mb-3 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                          Blacklist User
                        </h3>
                        <div className="space-y-3">
                          <input
                            type="text"
                            value={blacklistAddress}
                            onChange={(e) => setBlacklistAddress(e.target.value)}
                            placeholder="Enter wallet address to blacklist"
                            className={`w-full px-3 py-2 border rounded-lg text-sm ${
                              isDarkMode 
                                ? 'bg-gray-800 border-gray-600 text-white placeholder-gray-400' 
                                : 'bg-white border-gray-300 text-gray-900'
                            }`}
                          />
                          <button
                            onClick={handleBlacklistUser}
                            disabled={!blacklistAddress.trim() || isBlacklisting}
                            className={`w-full px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                              !blacklistAddress.trim() || isBlacklisting
                                ? 'bg-gray-600 cursor-not-allowed text-gray-400'
                                : 'bg-red-600 hover:bg-red-700 text-white'
                            }`}
                          >
                            {isBlacklisting ? 'Blacklisting...' : 'Blacklist User'}
                          </button>
                        </div>
                      </div>

                      {/* Remove User */}
                      <div className={`p-4 rounded-lg border ${isDarkMode ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'}`}>
                        <h3 className={`text-lg font-semibold mb-3 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                          Remove User
                        </h3>
                        <div className="space-y-3">
                          <input
                            type="text"
                            value={removeAddress}
                            onChange={(e) => setRemoveAddress(e.target.value)}
                            placeholder="Enter wallet address to remove"
                            className={`w-full px-3 py-2 border rounded-lg text-sm ${
                              isDarkMode 
                                ? 'bg-gray-800 border-gray-600 text-white placeholder-gray-400' 
                                : 'bg-white border-gray-300 text-gray-900'
                            }`}
                          />
                          <button
                            onClick={handleRemoveUser}
                            disabled={!removeAddress.trim() || isRemoving}
                            className={`w-full px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                              !removeAddress.trim() || isRemoving
                                ? 'bg-gray-600 cursor-not-allowed text-gray-400'
                                : 'bg-orange-600 hover:bg-orange-700 text-white'
                            }`}
                          >
                            {isRemoving ? 'Removing...' : 'Remove User'}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Success Message */}
                    {userManagementSuccess && (
                      <div className={`p-4 rounded-lg border flex items-start gap-3 mt-6 ${
                        isDarkMode ? 'bg-green-900/20 border-green-800 text-green-300' : 'bg-green-50 border-green-200 text-green-800'
                      }`}>
                        <CheckCircle size={20} className="flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="font-semibold">Success</p>
                          <p className="text-sm">{userManagementSuccess}</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {activeTab === 'verifiers' && (
                  <VerifierManagement isDarkMode={isDarkMode} />
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
