"use client";

import React, { useState, useRef, useEffect } from 'react';
import { 
  Calendar, 
  Clock, 
  X, 
  Coins, 
  CheckCircle, 
  Plus,
  Menu,
  Sun,
  Moon,
  Wallet,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { Sidebar } from '../components/Sidebar';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, useBalance, useChainId, useDisconnect, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { pepuMainnet } from '../chains';
import { useTheme } from '../context/ThemeContext';
import { parseEther, formatEther } from 'viem';

export default function CreateMarketPage() {
  const { isDarkMode, toggleTheme } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showDisconnectModal, setShowDisconnectModal] = useState(false);
  const connectButtonRef = useRef<HTMLDivElement>(null);
  
  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [minimumStake, setMinimumStake] = useState('');
  const [endDate, setEndDate] = useState('');
  const [endTime, setEndTime] = useState('');
  const [minDateTime, setMinDateTime] = useState('');
  const [maxDateTime, setMaxDateTime] = useState('');
  const [outcomeType, setOutcomeType] = useState<'yesno' | 'multiple'>('yesno');
  const [multipleOptions, setMultipleOptions] = useState(['', '']);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [creatorDeposit, setCreatorDeposit] = useState('');
  const [creatorOutcome, setCreatorOutcome] = useState('');
  const [selectedToken, setSelectedToken] = useState('0x0000000000000000000000000000000000000000'); // Default to PEPU
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Contract addresses from environment
  const P2P_MARKETMANAGER_ADDRESS = process.env.NEXT_PUBLIC_P2P_MARKETMANAGER_ADDRESS as `0x${string}`;

  // Get supported tokens from contract
  const { data: supportedTokensData } = useReadContract({
    address: P2P_MARKETMANAGER_ADDRESS,
    abi: [
      {
        "inputs": [],
        "name": "getSupportedTokens",
        "outputs": [
          {"name": "tokens", "type": "address[]"},
          {"name": "symbols", "type": "string[]"}
        ],
        "stateMutability": "view",
        "type": "function"
      }
    ],
    functionName: 'getSupportedTokens',
  });

  // Process supported tokens from contract
  const tokens = supportedTokensData ? supportedTokensData[0].map((address, index) => ({
    address: address as `0x${string}`,
    symbol: supportedTokensData[1][index],
    name: address === '0x0000000000000000000000000000000000000000' ? 'PEPU (Native)' : `${supportedTokensData[1][index]} Token`,
    isNative: address === '0x0000000000000000000000000000000000000000'
  })) : [];

  // Find P2P token from supported tokens (non-native token)
  const p2pToken = tokens.find(token => !token.isNative);
  const P2P_TOKEN_ADDRESS = p2pToken?.address;

  // Helper function to format numbers with commas
  const formatNumber = (value: string | number) => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num)) return '0';
    
    // For very large numbers, show in a more readable format
    if (num >= 1000000) {
      return (num / 1000000).toFixed(2) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(2) + 'K';
    } else {
      return num.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 6
      });
    }
  };

  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { disconnect } = useDisconnect();
  const { data: balance } = useBalance({
    address,
    chainId: pepuMainnet.id,
  });

  // P2P Token balance check
  const { data: p2pBalance } = useBalance({
    address,
    token: P2P_TOKEN_ADDRESS,
    chainId: pepuMainnet.id,
  });

  // State to store other token balances
  const [tokenBalances, setTokenBalances] = useState<Array<{address: string, balance: any}>>([]);

  // Get balances for other supported tokens (excluding native PEPU and P2P token)
  const otherTokens = tokens.filter(token => 
    token.address !== '0x0000000000000000000000000000000000000000' && 
    token.address !== P2P_TOKEN_ADDRESS
  );

  // Fetch balances for other tokens dynamically using wagmi's useBalance hook
  useEffect(() => {
    if (!address || otherTokens.length === 0) {
      setTokenBalances([]);
      return;
    }

    const fetchTokenBalances = async () => {
      const balances: Array<{address: string, balance: any}> = [];
      
      for (const token of otherTokens) {
        try {
          // Use wagmi's useBalance hook through a custom hook approach
          const response = await fetch('/api/contract-read', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contractAddress: token.address,
              abi: [
                {
                  "inputs": [{"name": "account", "type": "address"}],
                  "name": "balanceOf",
                  "outputs": [{"name": "", "type": "uint256"}],
                  "stateMutability": "view",
                  "type": "function"
                }
              ],
              functionName: 'balanceOf',
              args: [address]
            })
          });
          
          const data = await response.json();
          if (data.success) {
            const balanceValue = BigInt(data.data);
            const formatted = (Number(data.data) / 1e18).toFixed(6);
            
            balances.push({
              address: token.address,
              balance: {
                value: balanceValue,
                decimals: 18,
                symbol: token.symbol,
                formatted: formatted
              }
            });
          }
        } catch (error) {
          console.warn(`Failed to fetch balance for ${token.symbol}:`, error);
        }
      }
      
      setTokenBalances(balances);
    };

    fetchTokenBalances();
  }, [address, otherTokens]);

  // Contract hooks
  const { writeContract, data: hash, isPending, error: writeError } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash,
  });


  // Separate hooks for approval
  const { writeContract: writeApprovalContract, data: approvalHash, isPending: isApprovalPending, error: approvalError } = useWriteContract();
  const { isLoading: isApprovalConfirming, isSuccess: isApprovalConfirmed } = useWaitForTransactionReceipt({
    hash: approvalHash,
  });

  // Determine which token to check allowance for
  const tokenToCheck = outcomeType === 'multiple' ? P2P_TOKEN_ADDRESS : selectedToken as `0x${string}`;
  
  // Check token allowance
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: tokenToCheck as `0x${string}`,
    abi: [
      {
        "inputs": [
          {"name": "owner", "type": "address"},
          {"name": "spender", "type": "address"}
        ],
        "name": "allowance",
        "outputs": [{"name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function"
      }
    ],
    functionName: 'allowance',
    args: address && P2P_MARKETMANAGER_ADDRESS && tokenToCheck ? [address, P2P_MARKETMANAGER_ADDRESS] : undefined,
  });

  const categories = [
    "Crypto", "Sports", "Politics", "Technology", 
    "Finance", "Entertainment", "Science", "Gaming"
  ];

  // Check if user has minimum P2P token balance (100K tokens)
  const hasMinimumP2PBalance = p2pBalance && p2pBalance.value >= parseEther("100000");

  // Refetch allowance when approval is confirmed
  useEffect(() => {
    if (isApprovalConfirmed) {
      refetchAllowance();
      setSuccess('P2P tokens approved successfully! You can now create the market.');
    }
  }, [isApprovalConfirmed, refetchAllowance]);

  // Check if user has sufficient allowance for P2P tokens
  const requiredAmount = creatorDeposit ? parseEther(creatorDeposit) : BigInt(0);
  const hasSufficientAllowance = allowance !== undefined && creatorDeposit ? allowance >= requiredAmount : false;
  
  // Debug logging
  useEffect(() => {
    console.log('Debug - Allowance check:', {
      allowance: allowance?.toString(),
      creatorDeposit,
      requiredAmount: requiredAmount.toString(),
      hasSufficientAllowance,
      outcomeType,
      paymentToken: outcomeType === 'multiple' ? P2P_TOKEN_ADDRESS : selectedToken,
      shouldShowApprovalButton: outcomeType === 'multiple' && !hasSufficientAllowance
    });
  }, [allowance, creatorDeposit, requiredAmount, hasSufficientAllowance, outcomeType, selectedToken]);

  // Set min and max datetime constraints
  useEffect(() => {
    const now = new Date();
    const minDate = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours from now
    const maxDate = new Date(now.getTime() + 2 * 365 * 24 * 60 * 60 * 1000); // 2 years from now
    
    const formatDateTime = (date: Date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      return {
        date: `${year}-${month}-${day}`,
        time: `${hours}:${minutes}`
      };
    };

    const min = formatDateTime(minDate);
    const max = formatDateTime(maxDate);
    
    setMinDateTime(`${min.date}T${min.time}`);
    setMaxDateTime(`${max.date}T${max.time}`);
  }, []);

  // Get user's token balances
  const getUserTokenBalance = (tokenAddress: string) => {
    if (tokenAddress === '0x0000000000000000000000000000000000000000') {
      return balance;
    } else if (tokenAddress === P2P_TOKEN_ADDRESS) {
      return p2pBalance;
    } else {
      // Find balance for other supported tokens
      const tokenBalanceData = tokenBalances.find(tb => tb.address === tokenAddress);
      return tokenBalanceData?.balance || null;
    }
  };

  const onMenuClick = () => setSidebarOpen(!sidebarOpen);
  const onSidebarClose = () => setSidebarOpen(false);
  const onToggleCollapse = () => setSidebarCollapsed(!sidebarCollapsed);

  const handleCategoryToggle = (category: string) => {
    if (selectedCategories.includes(category)) {
      setSelectedCategories(selectedCategories.filter(c => c !== category));
    } else {
      setSelectedCategories([...selectedCategories, category]);
    }
  };


  const handleMultipleOptionChange = (index: number, value: string) => {
    const newOptions = [...multipleOptions];
    newOptions[index] = value;
    setMultipleOptions(newOptions);
  };

  const addMultipleOption = () => {
    if (multipleOptions.length < 4) {
      setMultipleOptions([...multipleOptions, '']);
    }
  };

  const removeMultipleOption = (index: number) => {
    if (multipleOptions.length > 2) {
      const newOptions = multipleOptions.filter((_, i) => i !== index);
      setMultipleOptions(newOptions);
    }
  };

  // Approve tokens function
  const approveTokens = async () => {
    if (!isConnected || !address || !creatorDeposit) {
      setError('Please connect your wallet and enter creator deposit');
      return;
    }

    if (!P2P_MARKETMANAGER_ADDRESS) {
      setError('Contract addresses not found');
      return;
    }

    // Determine which token to approve
    const tokenToApprove = outcomeType === 'multiple' ? P2P_TOKEN_ADDRESS : selectedToken;
    
    if (!tokenToApprove) {
      setError('Token address not found');
      return;
    }

    try {
      const tokenSymbol = tokens.find(t => t.address === tokenToApprove)?.symbol || 'Token';
      setSuccess(`Approving ${tokenSymbol} tokens...`);
      setError('');
      
      const approvalAmount = parseEther(creatorDeposit);
      console.log('Approving amount:', approvalAmount.toString());
      
      await writeApprovalContract({
        address: tokenToApprove as `0x${string}`,
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
        args: [P2P_MARKETMANAGER_ADDRESS!, approvalAmount],
        gas: BigInt(100000)
      });
    } catch (err: any) {
      setError(err.message || 'Failed to approve tokens');
      setSuccess('');
    }
  };

  // Create market function
  const createMarket = async () => {
    console.log('Create market button clicked!');
    console.log('isConnected:', isConnected);
    console.log('address:', address);
    console.log('hasMinimumP2PBalance:', hasMinimumP2PBalance);
    console.log('P2P_TOKEN_ADDRESS:', P2P_TOKEN_ADDRESS);
    
    if (!isConnected || !address) {
      setError('Please connect your wallet');
      return;
    }

    if (!hasMinimumP2PBalance) {
      setError('You need at least 100,000 P2P tokens to create a market');
      return;
    }

    // Check if approval is needed BEFORE doing anything else
    const isMultiOption = outcomeType === 'multiple';
    const paymentToken = isMultiOption ? P2P_TOKEN_ADDRESS : selectedToken;
    
    // Approval needed for any ERC20 token (not native PEPU)
    if (paymentToken !== '0x0000000000000000000000000000000000000000' && !hasSufficientAllowance) {
      const tokenSymbol = tokens.find(t => t.address === paymentToken)?.symbol || 'Token';
      setError(`Please approve ${tokenSymbol} tokens first by clicking the "Approve Tokens" button`);
      return;
    }

    console.log('Form validation:', {
      title, description, minimumStake, endDate, endTime, creatorDeposit, creatorOutcome
    });
    
    if (!title || !description || !minimumStake || !endDate || !endTime || !creatorDeposit || !creatorOutcome) {
      setError('Please fill in all required fields');
      return;
    }

    if (parseFloat(creatorDeposit) < parseFloat(minimumStake)) {
      setError('Creator deposit must be at least the minimum stake amount');
      return;
    }

    // Validate end date/time
    const endDateTime = new Date(`${endDate}T${endTime}`);
    const now = new Date();
    const minDateTime = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours from now
    const maxDateTime = new Date(now.getTime() + 2 * 365 * 24 * 60 * 60 * 1000); // 2 years from now

    if (endDateTime <= now) {
      setError('End date/time must be in the future');
      return;
    }

    if (endDateTime < minDateTime) {
      setError('End date/time must be at least 24 hours from now');
      return;
    }

    if (endDateTime > maxDateTime) {
      setError('End date/time cannot be more than 2 years from now');
      return;
    }

    if (outcomeType === 'multiple' && multipleOptions.some(opt => !opt.trim())) {
      setError('Please fill in all multiple options');
      return;
    }

    setIsCreating(true);
    setError('');
    setSuccess('');

    try {
      // Step 1: Upload market data to IPFS
      setSuccess('Uploading market data to IPFS...');
      const ipfsResponse = await fetch('/api/upload-ipfs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title,
          description,
          categories: selectedCategories,
          outcomeType,
          multipleOptions: outcomeType === 'multiple' ? multipleOptions : ['Yes', 'No']
        }),
      });

      if (!ipfsResponse.ok) {
        const errorData = await ipfsResponse.json();
        throw new Error(errorData.error || 'Failed to upload to IPFS');
      }

      const { ipfsHash, gatewayUrl } = await ipfsResponse.json();
      setSuccess(`Market data uploaded! IPFS Link: ${gatewayUrl} Creating market...`);

      // Step 2: Calculate duration in hours (minimum 24 hours)
      const endDateTime = new Date(`${endDate}T${endTime}`);
      const now = new Date();
      const durationMs = endDateTime.getTime() - now.getTime();
      const durationHours = Math.max(24, Math.ceil(durationMs / (1000 * 60 * 60)));

      // Step 3: Determine payment token and max options
      const maxOptions = isMultiOption ? multipleOptions.length : 2;

      // Ensure paymentToken is defined
      if (!paymentToken) {
        throw new Error('Payment token not found');
      }

      const args: [string, boolean, bigint, `0x${string}`, bigint, bigint, bigint, bigint] = [
        ipfsHash,
        isMultiOption,
        BigInt(maxOptions),
        paymentToken as `0x${string}`,
        parseEther(minimumStake),
        parseEther(creatorDeposit),
        BigInt(parseInt(creatorOutcome)),
        BigInt(durationHours)
      ];

      // Step 4: Create market on blockchain
      // Calculate total value to send: market creation fee + creator deposit (for native PEPU)
      const marketCreationFee = parseEther("1"); // Always 1 PEPU
      const totalValue = paymentToken === '0x0000000000000000000000000000000000000000' 
        ? marketCreationFee + parseEther(creatorDeposit) 
        : marketCreationFee;

      await writeContract({
        address: P2P_MARKETMANAGER_ADDRESS,
        abi: [
          {
            "inputs": [
              {"name": "ipfsHash", "type": "string"},
              {"name": "isMultiOption", "type": "bool"},
              {"name": "maxOptions", "type": "uint256"},
              {"name": "paymentToken", "type": "address"},
              {"name": "minStake", "type": "uint256"},
              {"name": "creatorDeposit", "type": "uint256"},
              {"name": "creatorOutcome", "type": "uint256"},
              {"name": "durationHours", "type": "uint256"}
            ],
            "name": "createMarket",
            "outputs": [{"name": "", "type": "uint256"}],
            "stateMutability": "payable",
            "type": "function"
          }
        ],
        functionName: 'createMarket',
        args: args,
        value: totalValue, // Market creation fee + creator deposit (for native PEPU)
        gas: BigInt(1000000) // Gas limit for market creation
      });

    } catch (err: any) {
      setError(err.message || 'Failed to create market');
      setIsCreating(false);
      setSuccess('');
    }
  };

  // Handle approval success
  useEffect(() => {
    if (isApprovalConfirmed) {
      const tokenSymbol = tokens.find(t => t.address === tokenToCheck)?.symbol || 'Token';
      setSuccess(`${tokenSymbol} tokens approved successfully! You can now create the market.`);
      setError('');
    }
  }, [isApprovalConfirmed, tokenToCheck, tokens]);

  // Handle approval error
  useEffect(() => {
    if (approvalError) {
      setError(`Approval failed: ${approvalError.message}`);
      setSuccess('');
    }
  }, [approvalError]);

  // Handle transaction success
  useEffect(() => {
    if (isConfirmed) {
      setSuccess('Market created successfully! Check the transaction on the block explorer.');
      setIsCreating(false);
      setError('');
      // Reset form
      setTitle('');
      setDescription('');
      setMinimumStake('');
      setEndDate('');
      setEndTime('');
      setCreatorDeposit('');
      setCreatorOutcome('');
      setSelectedToken('0x0000000000000000000000000000000000000000');
      setMultipleOptions(['', '']);
    }
  }, [isConfirmed]);

  // Handle transaction error
  useEffect(() => {
    if (writeError) {
      setError(`Transaction failed: ${writeError.message}`);
      setIsCreating(false);
      setSuccess('');
    }
  }, [writeError]);

  return (
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
                    <h1 className="text-sm lg:text-xl font-semibold">Create Market</h1>
                    <p className="text-xs text-gray-500 dark:text-gray-400 lg:hidden">New prediction market</p>
                  </div>
                </div>

                {/* Right: Theme + Wallet */}
                <div className="flex items-center gap-2 lg:gap-3">
                  <button
                    onClick={toggleTheme}
                    className={`p-2 rounded-lg transition-colors ${
                      isDarkMode ? 'hover:bg-gray-800' : 'hover:bg-gray-100'
                    }`}
                  >
                    {isDarkMode ? <Sun size={16} className="lg:w-5 lg:h-5" /> : <Moon size={16} className="lg:w-5 lg:h-5" />}
                  </button>
                
                {/* Desktop Wallet Button */}
                  <div className="hidden sm:block">
                  {isConnected ? (
                    <div className="flex items-center gap-2">
                      <Wallet size={16} className="text-emerald-500" />
                      <button
                        className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors flex items-center gap-2 ${
                          isDarkMode 
                            ? 'bg-gray-700 hover:bg-gray-600 text-gray-200' 
                            : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                        }`}
                        onClick={() => setShowDisconnectModal(true)}
                      >
                        <span>{address?.slice(0, 6)}...{address?.slice(-4)}</span>
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Wallet size={16} className="text-emerald-500" />
                      <ConnectButton />
                    </div>
                  )}
                </div>

                {/* Mobile Wallet Button */}
                <div className="sm:hidden">
                  {isConnected ? (
                    <div className="flex items-center gap-2">
                      <Wallet size={16} className="text-emerald-500" />
                      <button
                        className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors flex items-center gap-2 ${
                          isDarkMode 
                            ? 'bg-gray-700 hover:bg-gray-600 text-gray-200' 
                            : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                        }`}
                        onClick={() => setShowDisconnectModal(true)}
                      >
                        <span>{address?.slice(0, 6)}...{address?.slice(-4)}</span>
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Wallet size={16} className={isDarkMode ? 'text-gray-400' : 'text-gray-500'} />
                      <div className="relative">
                        <button
                          className="px-3 py-2 rounded-lg text-xs font-medium transition-colors bg-emerald-600 hover:bg-emerald-700 text-white"
                          onClick={() => {
                            // Trigger the hidden ConnectButton
                            const hiddenButton = connectButtonRef.current?.querySelector('button');
                            if (hiddenButton) {
                              (hiddenButton as HTMLElement).click();
                            }
                          }}
                        >
                          Connect
                        </button>
                        {/* Hidden ConnectButton for functionality */}
                        <div ref={connectButtonRef} className="absolute opacity-0 pointer-events-none">
                          <ConnectButton />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                </div>
              </div>
            </div>
          </header>

        {/* Disconnect Modal */}
        {showDisconnectModal && (
          <div 
            className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setShowDisconnectModal(false);
              }
            }}
          >
            <div className={`p-6 rounded-lg max-w-sm w-full shadow-2xl transform transition-all duration-200 ${
              isDarkMode ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200'
            }`}>
              <h3 className={`text-lg font-semibold mb-4 ${
                isDarkMode ? 'text-gray-200' : 'text-gray-800'
              }`}>
                Disconnect Wallet
              </h3>
              <p className={`text-sm mb-6 ${
                isDarkMode ? 'text-gray-400' : 'text-gray-600'
              }`}>
                Are you sure you want to disconnect your wallet?
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDisconnectModal(false)}
                  className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isDarkMode 
                      ? 'bg-gray-700 hover:bg-gray-600 text-gray-200' 
                      : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                  }`}
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    disconnect();
                    setShowDisconnectModal(false);
                  }}
                  className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  Disconnect
                </button>
              </div>
            </div>
          </div>
        )}

          {/* Page Content */}
          <div className="p-4 lg:p-6">
            <div className="max-w-4xl mx-auto">
              {/* P2P Balance Check */}
              {isConnected && (
                <div className={`mb-6 p-4 rounded-lg border ${
                  hasMinimumP2PBalance 
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
                    : 'bg-red-50 border-red-200 text-red-800'
                } ${isDarkMode ? 'dark:bg-emerald-900/20 dark:border-emerald-800 dark:text-emerald-300' : ''}`}>
                  <div className="flex items-center gap-2">
                    <Coins size={20} />
                    <span className="font-medium">
                      P2P Token Balance: {p2pBalance ? formatNumber(formatEther(p2pBalance.value)) : '0'} P2P
                    </span>
                    {hasMinimumP2PBalance ? (
                      <CheckCircle size={20} className="text-emerald-600" />
                    ) : (
                      <AlertCircle size={20} className="text-red-600" />
                    )}
                  </div>
                  <p className="text-sm mt-1">
                    {hasMinimumP2PBalance 
                      ? 'You can create markets!' 
                      : 'You need at least 1,000,000 P2P tokens to create markets'
                    }
                  </p>
                </div>
              )}

              {/* Error/Success Messages */}
              {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-800 rounded-lg">
                  <div className="flex items-center gap-2">
                    <AlertCircle size={20} />
                    <span className="font-medium">Error</span>
                  </div>
                  <p className="text-sm mt-1">{error}</p>
                </div>
              )}

              {success && (
                <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg">
                  <div className="flex items-center gap-2">
                    <CheckCircle size={20} />
                    <span className="font-medium">Success</span>
                  </div>
                  <p className="text-sm mt-1">{success}</p>
                </div>
              )}

              {/* Form */}
            <div className={`rounded-xl border shadow-sm ${
              isDarkMode 
                ? 'bg-gray-800 border-gray-700' 
                : 'bg-white border-gray-200'
            }`}>
                <div className="p-4 lg:p-6 space-y-5 lg:space-y-6">
                  {/* Basic Info */}
                  <div className="space-y-4">
                  <h2 className={`text-base lg:text-lg font-semibold ${
                    isDarkMode ? 'text-emerald-400' : 'text-emerald-600'
                  }`}>Basic Information</h2>
                    
                    <div className="grid grid-cols-1 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-2">Market Title</label>
                        <input
                          type="text"
                          value={title}
                          onChange={(e) => setTitle(e.target.value)}
                          placeholder="e.g., Will Bitcoin reach $100k by end of 2025?"
                        className={`w-full px-3 py-2.5 border rounded-lg focus:border-emerald-500 focus:outline-none text-sm ${
                          isDarkMode 
                            ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                            : 'bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-500'
                        }`}
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-2">Payment Token</label>
                        <select
                          value={selectedToken}
                          onChange={(e) => setSelectedToken(e.target.value)}
                          disabled={outcomeType === 'multiple'} // Multi-option markets must use P2P token
                        className={`w-full px-3 py-2.5 border rounded-lg focus:border-emerald-500 focus:outline-none text-sm ${
                          isDarkMode 
                            ? 'bg-gray-700 border-gray-600 text-white' 
                            : 'bg-gray-50 border-gray-300 text-gray-900'
                        }`}
                        >
                          {tokens.map((token) => (
                            <option key={token.address} value={token.address}>
                              {token.name} {outcomeType === 'multiple' && token.address !== P2P_TOKEN_ADDRESS ? '(Not available for multi-option)' : ''}
                            </option>
                          ))}
                        </select>
                        {outcomeType === 'multiple' && (
                          <p className="text-xs text-gray-500 mt-1">Multi-option markets must use P2P token</p>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-2">
                          Minimum Stake ({tokens.find(t => t.address === selectedToken)?.symbol || 'PEPU'})
                        </label>
                        <input
                          type="number"
                          value={minimumStake}
                          onChange={(e) => setMinimumStake(e.target.value)}
                          placeholder="0.01"
                          min="0"
                          step="0.01"
                        className={`w-full px-3 py-2.5 border rounded-lg focus:border-emerald-500 focus:outline-none text-sm ${
                          isDarkMode 
                            ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                            : 'bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-500'
                        }`}
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Balance: {getUserTokenBalance(selectedToken) ? formatNumber(formatEther(getUserTokenBalance(selectedToken)!.value)) : '0'} {tokens.find(t => t.address === selectedToken)?.symbol || 'PEPU'}
                        </p>
                      </div>

                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">Description</label>
                      <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Provide detailed description of the market..."
                        rows={3}
                      className={`w-full px-3 py-2.5 border rounded-lg focus:border-emerald-500 focus:outline-none resize-none text-sm ${
                        isDarkMode 
                          ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                          : 'bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-500'
                      }`}
                      />
                    </div>
                  </div>

                  {/* Duration */}
                  <div className="space-y-4">
                  <h2 className={`text-base lg:text-lg font-semibold ${
                    isDarkMode ? 'text-emerald-400' : 'text-emerald-600'
                  }`}>Market Duration</h2>
                    
                    <div className="grid grid-cols-1 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-2">End Date</label>
                        <p className="text-xs text-gray-500 mb-2">Minimum 24 hours from now, maximum 2 years</p>
                        <div className="relative">
                          <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                          <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            min={minDateTime.split('T')[0]}
                            max={maxDateTime.split('T')[0]}
                          className={`w-full pl-10 pr-3 py-2.5 border rounded-lg focus:border-emerald-500 focus:outline-none text-sm ${
                            isDarkMode 
                              ? 'bg-gray-700 border-gray-600 text-white' 
                              : 'bg-gray-50 border-gray-300 text-gray-900'
                          }`}
                          />
                        </div>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium mb-2">End Time</label>
                        <div className="relative">
                          <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                          <input
                            type="time"
                            value={endTime}
                            onChange={(e) => setEndTime(e.target.value)}
                          className={`w-full pl-10 pr-3 py-2.5 border rounded-lg focus:border-emerald-500 focus:outline-none text-sm ${
                            isDarkMode 
                              ? 'bg-gray-700 border-gray-600 text-white' 
                              : 'bg-gray-50 border-gray-300 text-gray-900'
                          }`}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Categories & Tokens Row */}
                  <div className="grid grid-cols-1 gap-6">
                    {/* Categories */}
                    <div className="space-y-3">
                    <h2 className={`text-base lg:text-lg font-semibold ${
                      isDarkMode ? 'text-emerald-400' : 'text-emerald-600'
                    }`}>Categories</h2>
                      
                      <div className="flex flex-wrap gap-2">
                        {categories.map((category) => (
                          <button
                            key={category}
                            onClick={() => handleCategoryToggle(category)}
                            className={`
                              px-3 py-1.5 rounded-full text-xs font-medium transition-colors flex items-center gap-1.5
                              ${selectedCategories.includes(category)
                                ? 'bg-emerald-600 text-white'
                              : isDarkMode
                                ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                              }
                            `}
                          >
                            {selectedCategories.includes(category) && <X size={14} />}
                            {category}
                          </button>
                        ))}
                      </div>
                    </div>

                  </div>

                  {/* Outcome Type */}
                  <div className="space-y-4">
                  <h2 className={`text-base lg:text-lg font-semibold ${
                    isDarkMode ? 'text-emerald-400' : 'text-emerald-600'
                  }`}>Outcome Type</h2>
                    
                    <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                      <button
                        onClick={() => setOutcomeType('yesno')}
                        className={`
                          flex-1 px-4 py-3 rounded-lg border-2 transition-colors flex items-center justify-center gap-2 text-sm font-medium
                          ${outcomeType === 'yesno'
                          ? isDarkMode
                            ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400'
                            : 'border-emerald-500 bg-emerald-50 text-emerald-600'
                          : isDarkMode
                            ? 'border-gray-600 bg-gray-700 text-gray-300 hover:border-gray-500'
                            : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                          }
                        `}
                      >
                        Yes/No
                      </button>
                      
                      <button
                        onClick={() => setOutcomeType('multiple')}
                        className={`
                          flex-1 px-4 py-3 rounded-lg border-2 transition-colors flex items-center justify-center gap-2 text-sm font-medium
                          ${outcomeType === 'multiple'
                          ? isDarkMode
                            ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400'
                            : 'border-emerald-500 bg-emerald-50 text-emerald-600'
                          : isDarkMode
                            ? 'border-gray-600 bg-gray-700 text-gray-300 hover:border-gray-500'
                            : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                          }
                        `}
                      >
                        Multiple Options
                      </button>
                    </div>
                  </div>

                  {/* Buy Yes Buttons */}
                  <div className="space-y-4">
                    <h2 className={`text-base lg:text-lg font-semibold ${
                      isDarkMode ? 'text-emerald-400' : 'text-emerald-600'
                    }`}>Quick Actions</h2>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <button className={`
                        px-4 py-3 rounded-lg border-2 transition-colors flex items-center justify-center gap-2 text-sm font-medium
                        ${isDarkMode
                          ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                          : 'border-emerald-500 bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                        }
                      `}>
                        <TrendingUp size={18} />
                        Buy Yes
                      </button>
                      
                      <button className={`
                        px-4 py-3 rounded-lg border-2 transition-colors flex items-center justify-center gap-2 text-sm font-medium
                        ${isDarkMode
                          ? 'border-red-500 bg-red-500/10 text-red-400 hover:bg-red-500/20'
                          : 'border-red-500 bg-red-50 text-red-600 hover:bg-red-100'
                        }
                      `}>
                        <TrendingDown size={18} />
                        Buy No
                      </button>
                    </div>
                  </div>

                  {/* Multiple Options */}
                  {outcomeType === 'multiple' && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm lg:text-md font-medium">Options (2-4)</h3>
                        {multipleOptions.length < 4 && (
                          <button
                            onClick={addMultipleOption}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-sm transition-colors flex items-center gap-2 text-white"
                          >
                            <Plus size={16} />
                            Add Option
                          </button>
                        )}
                      </div>
                      
                      <div className="space-y-3">
                        {multipleOptions.map((option, index) => (
                          <div key={index} className="flex gap-2">
                            <input
                              type="text"
                              value={option}
                              onChange={(e) => handleMultipleOptionChange(index, e.target.value)}
                              placeholder={`Option ${index + 1}`}
                            className={`flex-1 px-3 py-2.5 border rounded-lg focus:border-emerald-500 focus:outline-none text-sm ${
                              isDarkMode 
                                ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                                : 'bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-500'
                            }`}
                            />
                            {multipleOptions.length > 2 && (
                              <button
                                onClick={() => removeMultipleOption(index)}
                                className="px-3 py-2.5 bg-red-600 hover:bg-red-700 rounded-lg transition-colors text-white"
                              >
                                <X size={16} />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Creator Deposit & Outcome */}
                  <div className="space-y-4">
                    <h2 className={`text-base lg:text-lg font-semibold ${
                      isDarkMode ? 'text-emerald-400' : 'text-emerald-600'
                    }`}>Creator Requirements</h2>
                    
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Creator Deposit ({tokens.find(t => t.address === selectedToken)?.symbol || 'PEPU'}) - Must be ≥ Minimum Stake
                      </label>
                      <input
                        type="number"
                        value={creatorDeposit}
                        onChange={(e) => setCreatorDeposit(e.target.value)}
                        placeholder={minimumStake || "0.1"}
                        min={minimumStake || "0"}
                        step="0.01"
                      className={`w-full px-3 py-2.5 border rounded-lg focus:border-emerald-500 focus:outline-none text-sm ${
                        isDarkMode 
                          ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                          : 'bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-500'
                      }`}
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Balance: {getUserTokenBalance(selectedToken) ? formatNumber(formatEther(getUserTokenBalance(selectedToken)!.value)) : '0'} {tokens.find(t => t.address === selectedToken)?.symbol || 'PEPU'}
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Creator Outcome Prediction
                      </label>
                      {outcomeType === 'yesno' ? (
                        <select
                          value={creatorOutcome}
                          onChange={(e) => setCreatorOutcome(e.target.value)}
                        className={`w-full px-3 py-2.5 border rounded-lg focus:border-emerald-500 focus:outline-none text-sm ${
                          isDarkMode 
                            ? 'bg-gray-700 border-gray-600 text-white' 
                            : 'bg-gray-50 border-gray-300 text-gray-900'
                        }`}
                        >
                          <option value="">Select your prediction</option>
                          <option value="1">Yes</option>
                          <option value="2">No</option>
                        </select>
                      ) : (
                        <select
                          value={creatorOutcome}
                          onChange={(e) => setCreatorOutcome(e.target.value)}
                        className={`w-full px-3 py-2.5 border rounded-lg focus:border-emerald-500 focus:outline-none text-sm ${
                          isDarkMode 
                            ? 'bg-gray-700 border-gray-600 text-white' 
                            : 'bg-gray-50 border-gray-300 text-gray-900'
                        }`}
                        >
                          <option value="">Select your prediction</option>
                          {multipleOptions.map((option, index) => (
                            <option key={index} value={index + 1}>
                              {option || `Option ${index + 1}`}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  </div>

                  {/* Submit Button */}
                  <div className="pt-4">
                    {/* Debug info */}
                    <div className={`mb-4 p-3 rounded-lg text-sm border ${
                      isDarkMode 
                        ? 'bg-gray-800 border-gray-600 text-gray-200' 
                        : 'bg-gray-100 border-gray-300 text-gray-800'
                    }`}>
                      <p className={`font-semibold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Debug Info:</p>
                      <div className="space-y-1 text-xs">
                        <p>Outcome Type: <span className="font-mono">{outcomeType}</span></p>
                        <p>Has Sufficient Allowance: <span className={`font-semibold ${hasSufficientAllowance ? 'text-green-500' : 'text-red-500'}`}>{hasSufficientAllowance ? 'Yes' : 'No'}</span></p>
                        <p>Creator Deposit: <span className="font-mono">{creatorDeposit || 'Not set'}</span></p>
                        <p>Required Amount: <span className="font-mono">{requiredAmount.toString()}</span></p>
                        <p>Current Allowance: <span className="font-mono">{allowance ? allowance.toString() : 'Loading...'}</span></p>
                        <p>Should Show Approval Button: <span className={`font-semibold ${((outcomeType === 'multiple' && !hasSufficientAllowance) || (outcomeType === 'yesno' && selectedToken !== '0x0000000000000000000000000000000000000000' && !hasSufficientAllowance)) ? 'text-green-500' : 'text-red-500'}`}>{((outcomeType === 'multiple' && !hasSufficientAllowance) || (outcomeType === 'yesno' && selectedToken !== '0x0000000000000000000000000000000000000000' && !hasSufficientAllowance)) ? 'YES' : 'NO'}</span></p>
                      </div>
                    </div>

                    {/* Single button that switches between Approve and Create Market */}
                    <button 
                      onClick={() => {
                        console.log('Button clicked!');
                        console.log('P2P_TOKEN_ADDRESS:', P2P_TOKEN_ADDRESS);
                        console.log('outcomeType:', outcomeType);
                        console.log('selectedToken:', selectedToken);
                        console.log('hasSufficientAllowance:', hasSufficientAllowance);
                        
                        // Multiple outcomes always use P2P token, Linear can use any supported token
                        // Approval needed for any ERC20 token (not native PEPU)
                        const needsApproval = (outcomeType === 'multiple' && !hasSufficientAllowance) || 
                                           (outcomeType === 'yesno' && selectedToken !== '0x0000000000000000000000000000000000000000' && !hasSufficientAllowance);
                        
                        console.log('Needs approval:', needsApproval);
                        
                        if (needsApproval) {
                          approveTokens();
                        } else {
                          createMarket();
                        }
                      }}
                      disabled={
                        !isConnected || 
                        !hasMinimumP2PBalance || 
                        !creatorDeposit ||
                        (((outcomeType === 'multiple' && !hasSufficientAllowance) || 
                          (outcomeType === 'yesno' && selectedToken !== '0x0000000000000000000000000000000000000000' && !hasSufficientAllowance)) 
                          ? (isApprovalPending || isApprovalConfirming) 
                          : (isCreating || isPending || isConfirming))
                      }
                      className={`w-full px-6 py-3 font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 ${
                        !isConnected || 
                        !hasMinimumP2PBalance || 
                        !creatorDeposit ||
                        (((outcomeType === 'multiple' && !hasSufficientAllowance) || 
                          (outcomeType === 'yesno' && selectedToken !== '0x0000000000000000000000000000000000000000' && !hasSufficientAllowance)) 
                          ? (isApprovalPending || isApprovalConfirming) 
                          : (isCreating || isPending || isConfirming))
                          ? 'bg-gray-400 cursor-not-allowed text-gray-200'
                          : ((outcomeType === 'multiple' && !hasSufficientAllowance) || 
                             (outcomeType === 'yesno' && selectedToken !== '0x0000000000000000000000000000000000000000' && !hasSufficientAllowance))
                            ? 'bg-blue-600 hover:bg-blue-700 text-white'
                            : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                      }`}
                    >
                      {(isApprovalPending || isApprovalConfirming || isCreating || isPending || isConfirming) && <Loader2 size={20} className="animate-spin" />}
                      {isApprovalPending ? 'Approving...' : 
                       isApprovalConfirming ? 'Processing Approval...' :
                       isCreating ? 'Creating Market...' : 
                       isPending ? 'Confirming Transaction...' :
                       isConfirming ? 'Processing...' :
                       ((outcomeType === 'multiple' && !hasSufficientAllowance) || 
                        (outcomeType === 'yesno' && selectedToken !== '0x0000000000000000000000000000000000000000' && !hasSufficientAllowance)) ? 'Approve Tokens' :
                       'Create Market'}
                    </button>
                    {!isConnected && (
                      <p className="text-sm text-gray-500 mt-2 text-center">Please connect your wallet to create a market</p>
                    )}
                    {isConnected && !hasMinimumP2PBalance && (
                      <p className="text-sm text-red-500 mt-2 text-center">You need at least 100,000 P2P tokens to create markets</p>
                    )}
                    <p className="text-xs text-gray-500 mt-2 text-center">
                      Market creation fee: 1 PEPU (always paid in PEPU)
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
  );
}