"use client";

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
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
  Loader2,
  Trash2,
  Minus,
  Check
} from 'lucide-react';
import { Sidebar } from '../components/Sidebar';
import { HeaderWallet } from '@/components/HeaderWallet';
import { useAccount, useBalance, useChainId, useDisconnect, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { pepuMainnet } from '../chains';
import { useTheme } from '../context/ThemeContext';
import { parseEther, formatEther } from 'viem';
import { ethers } from 'ethers';
import lighthouse from '@lighthouse-web3/sdk';

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

export default function CreateMarketPage() {
  const { isDarkMode, toggleTheme } = useTheme();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showDisconnectModal, setShowDisconnectModal] = useState(false);
  const connectButtonRef = useRef<HTMLDivElement>(null);
  
  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [vanityInfo, setVanityInfo] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [minimumStake, setMinimumStake] = useState('');
  const [stakingDays, setStakingDays] = useState('');
  const [stakingHours, setStakingHours] = useState('');
  const [stakingMinutes, setStakingMinutes] = useState('');
  const [resolutionDays, setResolutionDays] = useState('');
  const [resolutionHours, setResolutionHours] = useState('');
  const [resolutionMinutes, setResolutionMinutes] = useState('');
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
  const [marketType, setMarketType] = useState<'PRICE_FEED' | 'UMA_MANUAL'>('UMA_MANUAL');
  const [selectedPriceFeed, setSelectedPriceFeed] = useState('');
  const [priceThreshold, setPriceThreshold] = useState('');
  const [priceThresholdDisplay, setPriceThresholdDisplay] = useState(''); // Display value for user input
  const [priceDirection, setPriceDirection] = useState<'over' | 'under'>('over'); // Over = Yes wins if price >= threshold
  const [currentPrice, setCurrentPrice] = useState<string | null>(null);
  const [priceDecimals, setPriceDecimals] = useState<number>(8);
  const [isLoadingPrice, setIsLoadingPrice] = useState(false);
  const [priceError, setPriceError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isUploadingMetadata, setIsUploadingMetadata] = useState(false);
  const [isCreatingContract, setIsCreatingContract] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [createdMarketId, setCreatedMarketId] = useState<number | null>(null);

  // Contract addresses from environment
  const P2P_MARKETMANAGER_ADDRESS = (process.env.NEXT_PUBLIC_P2P_MARKET_MANAGER_ADDRESS || process.env.NEXT_PUBLIC_P2P_MARKETMANAGER_ADDRESS) as `0x${string}`;
  const ADMIN_MANAGER_ADDRESS = process.env.NEXT_PUBLIC_P2P_ADMIN_ADDRESS as `0x${string}`;

  // Get supported tokens from AdminManager contract
  const { data: supportedTokensData } = useReadContract({
    address: ADMIN_MANAGER_ADDRESS,
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
  const tokens = useMemo(() => supportedTokensData ? supportedTokensData[0].map((address, index) => ({
    address: address as `0x${string}`,
    symbol: supportedTokensData[1][index],
    name: address === '0x0000000000000000000000000000000000000000' ? 'PEPU (Native)' : `${supportedTokensData[1][index]} Token`,
    isNative: address === '0x0000000000000000000000000000000000000000'
  })) : [], [supportedTokensData]);

  // Get P2P token address from environment
  const P2P_TOKEN_ADDRESS = process.env.NEXT_PUBLIC_P2P_TOKEN_ADDRESS as `0x${string}`;
  
  // Debug log to check if P2P token address is loaded
  console.log('P2P_TOKEN_ADDRESS from env:', P2P_TOKEN_ADDRESS);
  console.log('P2P_MARKETMANAGER_ADDRESS:', P2P_MARKETMANAGER_ADDRESS);
  console.log('ADMIN_MANAGER_ADDRESS:', ADMIN_MANAGER_ADDRESS);
  console.log('supportedTokensData:', supportedTokensData);
  console.log('tokens array:', tokens);

  // Helper functions to convert time inputs to minutes
  const convertToMinutes = (days: string, hours: string, minutes: string = '0') => {
    const daysNum = days && days.trim() !== '' ? parseInt(days) || 0 : 0;
    const hoursNum = hours && hours.trim() !== '' ? parseInt(hours) || 0 : 0;
    const minutesNum = minutes && minutes.trim() !== '' ? parseInt(minutes) || 0 : 0;
    return (daysNum * 24 * 60) + (hoursNum * 60) + minutesNum;
  };

  const getStakingDurationMinutes = () => convertToMinutes(stakingDays, stakingHours, stakingMinutes);
  const getResolutionDurationMinutes = () => convertToMinutes(resolutionDays, resolutionHours, resolutionMinutes);

  // Fetch current price from price feed when selected
  useEffect(() => {
    const fetchPrice = async () => {
      if (!selectedPriceFeed || marketType !== 'PRICE_FEED') {
        setCurrentPrice(null);
        return;
      }

      setIsLoadingPrice(true);
      try {
        const provider = new ethers.JsonRpcProvider('https://rpc-pepu-v2-mainnet-0.t.conduit.xyz');
        
        // ABI for AggregatorV3Interface
        const PRICE_FEED_ABI = [
          {
            "inputs": [],
            "name": "latestRoundData",
            "outputs": [
              {"name": "roundId", "type": "uint80"},
              {"name": "answer", "type": "int256"},
              {"name": "startedAt", "type": "uint256"},
              {"name": "updatedAt", "type": "uint256"},
              {"name": "answeredInRound", "type": "uint80"}
            ],
            "stateMutability": "view",
            "type": "function"
          },
          {
            "inputs": [],
            "name": "decimals",
            "outputs": [{"name": "", "type": "uint8"}],
            "stateMutability": "view",
            "type": "function"
          }
        ];

        const priceFeedContract = new ethers.Contract(selectedPriceFeed, PRICE_FEED_ABI, provider);
        
        // Get decimals first
        const decimals = await priceFeedContract.decimals();
        const decimalsNum = Number(decimals);
        setPriceDecimals(decimalsNum);
        
        // Try to get price - may fail if stale
        try {
          const roundData = await priceFeedContract.latestRoundData();
          const priceValue = BigInt(roundData.answer.toString());
          
          // Convert to human-readable price
          const divisor = BigInt(10 ** decimalsNum);
          const wholePart = priceValue / divisor;
          const fractionalPart = priceValue % divisor;
          const fractionalStr = fractionalPart.toString().padStart(decimalsNum, '0');
          
          // Build price string
          let priceStr: string;
          
          if (wholePart === BigInt(0)) {
            // For prices < 1: count leading zeros, then show next 3 digits
            // e.g., 0.000196141642653553 -> 0.000196 (3 leading zeros + 3 digits)
            const leadingZeros = fractionalStr.match(/^0*/)?.[0].length || 0;
            const totalDigits = leadingZeros + 3;
            priceStr = `0.${fractionalStr.substring(0, totalDigits)}`;
          } else {
            // For prices >= 1, show 2 decimal places
            priceStr = `${wholePart}.${fractionalStr.substring(0, 2)}`;
          }
          
          setCurrentPrice(priceStr);
          setPriceError(null);
          
          // Auto-fill threshold with current price (scaled)
          setPriceThreshold(priceValue.toString());
          setPriceThresholdDisplay(priceStr);
        } catch (priceError: any) {
          // Price is stale or other error
          if (priceError?.message?.includes('stale') || priceError?.reason?.includes('stale')) {
            setPriceError('Price feed is stale (not updated in last 5 minutes). The relayer bot needs to update it. You can still set a threshold manually.');
            setCurrentPrice(null);
          } else {
            throw priceError; // Re-throw other errors
          }
        }
      } catch (error: any) {
        console.error('Error fetching price:', error);
        setCurrentPrice(null);
        
        // Check if it's a stale price error (already handled above, but catch any others)
        if (error?.message?.includes('stale') || error?.reason?.includes('stale')) {
          setPriceError('Price feed is stale (not updated in last 5 minutes). You can still set a threshold manually.');
        } else {
          setPriceError('Failed to load price. Please check the feed address or try again later.');
        }
      } finally {
        setIsLoadingPrice(false);
      }
    };

    fetchPrice();
  }, [selectedPriceFeed, marketType]);

  // Helper to adjust threshold by percentage
  const adjustThreshold = (percentage: number) => {
    if (!currentPrice || !priceThreshold) return;
    
    try {
      const currentThreshold = BigInt(priceThreshold);
      const adjustment = (currentThreshold * BigInt(Math.round(percentage * 100))) / BigInt(10000);
      const newThreshold = currentThreshold + adjustment;
      setPriceThreshold(newThreshold.toString());
    } catch (error) {
      console.error('Error adjusting threshold:', error);
    }
  };

  // Calculate end dates
  const getStakingEndDate = () => {
    const now = new Date();
    const stakingMinutes = getStakingDurationMinutes();
    const stakingEnd = new Date(now.getTime() + stakingMinutes * 60 * 1000);
    return stakingEnd.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getResolutionEndDate = () => {
    const now = new Date();
    const resolutionMinutes = getResolutionDurationMinutes();
    const resolutionEnd = new Date(now.getTime() + resolutionMinutes * 60 * 1000);
    return resolutionEnd.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Image upload handler (validates & moderates before preview)
  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please select a valid image file');
      return;
    }
    
    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError('Image file size must be less than 10MB');
      return;
    }

    // Run NSFW moderation at upload time (before preview)
    const moderationEnabled = process.env.NEXT_PUBLIC_ENABLE_MODERATION !== 'false';
    if (moderationEnabled) {
      try {
        setError('');
        setSuccess('🔍 Checking image content...');

        const moderationFormData = new FormData();
        moderationFormData.append('file', file);

        const moderationResponse = await fetch('/api/moderate-image', {
          method: 'POST',
          body: moderationFormData,
        });

        const moderationResult = await moderationResponse.json();

        if (!moderationResult.success || moderationResult.blocked) {
          const reason = moderationResult.reason || 'Image contains inappropriate content';
          const score = moderationResult.score ? ` (NSFW score: ${(moderationResult.score * 100).toFixed(1)}%)` : '';
          setSuccess('');
          setImageFile(null);
          setImagePreview(null);
          setError(`${reason}${score}. Please upload a different image.`);
          return;
        }

        if (moderationResult.decision?.action === 'blur') {
          console.warn('⚠️ Image flagged for blur, but allowing upload');
        }

        console.log('✅ Image passed moderation check');
        setSuccess('');
      } catch (moderationError: any) {
        console.error('❌ Image moderation failed:', moderationError);

        // If it's clearly a blocked/NSFW error, show it
        if (moderationError?.message && (moderationError.message.includes('inappropriate') || moderationError.message.includes('NSFW'))) {
          setImageFile(null);
          setImagePreview(null);
          setSuccess('');
          setError(moderationError.message);
          return;
        }

        // If moderation service is down and fail-open is NOT enabled, block the upload
        if (process.env.NEXT_PUBLIC_MODERATION_FAIL_OPEN !== 'true') {
          setImageFile(null);
          setImagePreview(null);
          setSuccess('');
          setError('Image moderation service unavailable. Please try again later.');
          return;
        }

        console.warn('⚠️ Moderation service unavailable, continuing with upload (fail-open mode)');
      }
    }

    // If we reach here, the file is allowed → set and preview
    setImageFile(file);

    const reader = new FileReader();
    reader.onload = (e) => {
      setImagePreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
    setError(''); // Clear any previous errors
  };

  // Remove image handler
  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
  };

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
    query: {
      enabled: !!P2P_TOKEN_ADDRESS && !!address, // Only run if both addresses are available
    }
  });

  // State to store other token balances
  const [tokenBalances, setTokenBalances] = useState<Array<{address: string, balance: any}>>([]);

  // Get balances for other supported tokens (excluding native PEPU and P2P token)
  const otherTokens = useMemo(() => tokens.filter(token => 
    token.address !== '0x0000000000000000000000000000000000000000' && 
    token.address !== P2P_TOKEN_ADDRESS
  ), [tokens]);

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

  // Filter categories based on market type
  const availableCategories = useMemo(() => {
    if (marketType === 'PRICE_FEED') {
      return ["Crypto"];
    }
    return categories;
  }, [marketType]);

  // Auto-select Crypto category when market type is PRICE_FEED
  useEffect(() => {
    if (marketType === 'PRICE_FEED') {
      setSelectedCategories(['Crypto']);
    }
  }, [marketType]);

  // Refetch allowance when approval is confirmed
  useEffect(() => {
    if (isApprovalConfirmed) {
      console.log('✅ Approval confirmed, refetching allowance...');
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
    const minDate = new Date(now.getTime() + 5 * 60 * 1000); // 5 minutes from now
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
    } else if (P2P_TOKEN_ADDRESS && tokenAddress === P2P_TOKEN_ADDRESS) {
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

  useEffect(() => {
    console.log('CreateMarket pathname changed:', pathname);
  }, [pathname]);

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
    if (multipleOptions.length < 10) {
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

  // Validate form before showing confirmation modal
  const validateForm = () => {
    if (!isConnected || !address) {
      setError('Please connect your wallet');
      return false;
    }

    // Check if approval is needed BEFORE doing anything else
    const isMultiOption = outcomeType === 'multiple';
    const paymentToken = isMultiOption ? P2P_TOKEN_ADDRESS : selectedToken;
    
    // Approval needed for any ERC20 token (not native PEPU)
    if (paymentToken !== '0x0000000000000000000000000000000000000000' && !hasSufficientAllowance) {
      const tokenSymbol = tokens.find(t => t.address === paymentToken)?.symbol || 'Token';
      setError(`Please approve ${tokenSymbol} tokens first by clicking the "Approve Tokens" button`);
      return false;
    }
    
    if (!title || !imageFile || !minimumStake || !creatorDeposit || !creatorOutcome) {
      setError('Please fill in all required fields and upload an image');
      return false;
    }

    if (parseFloat(creatorDeposit) < parseFloat(minimumStake)) {
      setError('Creator deposit must be at least the minimum stake amount');
      return false;
    }

    // Validate market type specific requirements
    if (marketType === 'PRICE_FEED') {
      if (!selectedPriceFeed) {
        setError('Please select a price feed for price feed markets');
        return false;
      }
      if (!priceThreshold || parseFloat(priceThreshold) <= 0) {
        setError('Please enter a valid price threshold for price feed markets');
        return false;
      }
    }

    // Validate staking duration
    const stakingMinutes = getStakingDurationMinutes();
    if (stakingMinutes < 5) {
      setError('Staking duration must be at least 5 minutes');
      return false;
    }

    // Validate resolution duration
    const resolutionMinutes = getResolutionDurationMinutes();
    if (resolutionMinutes < stakingMinutes) {
      setError('Resolution duration must be at least as long as staking duration');
      return false;
    }

    if (outcomeType === 'multiple' && multipleOptions.some(opt => !opt.trim())) {
      setError('Please fill in all multiple options');
      return false;
    }

    return true;
  };

  // Show confirmation modal
  const handleCreateClick = () => {
    if (!validateForm()) {
      return;
    }
    setError('');
    setShowConfirmModal(true);
  };

  // Create market function (called from modal)
  const createMarket = async () => {

    setIsCreating(true);
    // Image is already uploaded/validated at selection time; we just track states here
    setIsUploadingImage(true);
    setError('');
    setSuccess('');

    try {
      console.log('🚀 Starting market creation process...');
      console.log('📋 Market data:', { title, outcomeType, minimumStake, creatorDeposit });
      
      // Step 1: Upload image to IPFS (image already validated at upload)
      setIsUploadingImage(true);
      if (!imageFile) {
        throw new Error('Image file is required');
      }
      console.log('📤 Uploading image file:', imageFile.name, 'Size:', imageFile.size);
      
      const apiKey = '91729f56.8c58e79bdc194453b56d2b826d2daefb';
      
      // Upload image file to IPFS using Lighthouse
      console.log('📤 Uploading file to Lighthouse:', imageFile.name, 'Size:', imageFile.size);
      
      let imageUrl: string;
      
      try {
        console.log('📤 Uploading file using Lighthouse SDK...');
        
        // Upload file using Lighthouse SDK (Browser method)
        // Convert File to FileList for lighthouse.upload
        const fileList = new DataTransfer();
        fileList.items.add(imageFile);
        const uploadResult = await lighthouse.upload(fileList.files, apiKey);
        
        console.log('📤 Upload result:', uploadResult);
        
        if (!uploadResult.data || !uploadResult.data.Hash) {
          console.error('❌ No hash in result:', uploadResult);
          throw new Error('Failed to upload image to IPFS - no hash returned');
        }
        
        const imageIpfsHash = uploadResult.data.Hash;
        imageUrl = `https://gateway.lighthouse.storage/ipfs/${imageIpfsHash}`;
        
        console.log('✅ Image uploaded to IPFS:', imageUrl);
        console.log('🔗 Image IPFS Hash:', imageIpfsHash);
        
      } catch (uploadError: any) {
        console.error('❌ Lighthouse upload failed:', uploadError);
        throw new Error(`Image upload failed: ${uploadError.message}`);
      }
      
      setIsUploadingImage(false);
      setIsUploadingMetadata(true);

      // Step 3: Create market data with image link
      // For price feed markets, set options based on direction
      let marketOptions: string[];
      if (marketType === 'PRICE_FEED') {
        if (priceDirection === 'over') {
          marketOptions = ['Yes (price ≥ threshold)', 'No (price < threshold)'];
        } else {
          marketOptions = ['Yes (price < threshold)', 'No (price ≥ threshold)'];
        }
      } else {
        marketOptions = outcomeType === 'multiple' ? multipleOptions : ['Yes', 'No'];
      }

      const marketData = {
        title,
        description: description || '',
        vanityInfo: vanityInfo || '',
        imageUrl,
        categories: selectedCategories || [],
        outcomeType: marketType === 'PRICE_FEED' ? 'yesno' : outcomeType,
        options: marketOptions,
        priceDirection: marketType === 'PRICE_FEED' ? priceDirection : undefined,
        createdAt: new Date().toISOString(),
        version: '1.0'
      };

      console.log('📝 Creating market metadata:', marketData);
      console.log('🖼️ Image URL in metadata:', marketData.imageUrl);

      // Upload market metadata to IPFS
      console.log('📤 Uploading metadata to IPFS...');
      const metadataUploadResponse = await lighthouse.uploadText(
        JSON.stringify(marketData),
        apiKey
      );

      console.log('📤 Metadata upload response:', metadataUploadResponse);
      console.log('📋 IPFS Hash for metadata:', metadataUploadResponse.data?.Hash);

      if (!metadataUploadResponse.data || !metadataUploadResponse.data.Hash) {
        throw new Error('Failed to upload market metadata to IPFS - no hash returned');
      }

      const ipfsHash = metadataUploadResponse.data.Hash;
      const gatewayUrl = `https://gateway.lighthouse.storage/ipfs/${ipfsHash}`;
      
      setIsUploadingMetadata(false);
      setIsCreatingContract(true);

      console.log('✅ Metadata uploaded successfully. IPFS Hash:', ipfsHash);
      console.log('🔗 Gateway URL:', gatewayUrl);

      // Step 3: Use the duration values from form
      const stakeDurationMinutes = getStakingDurationMinutes();
      const resolutionDurationMinutes = getResolutionDurationMinutes();
      
      console.log('⏰ Durations:', { stakeDurationMinutes, resolutionDurationMinutes });

      // Step 4: Determine payment token and max options
      const isMultiOption = outcomeType === 'multiple';
      const maxOptions = isMultiOption ? multipleOptions.length : 2;

      // Ensure paymentToken is defined
      const paymentToken = isMultiOption ? P2P_TOKEN_ADDRESS : selectedToken;
      if (!paymentToken) {
        throw new Error('Payment token not found');
      }

      console.log('💰 Payment details:', { paymentToken, minimumStake, creatorDeposit, creatorOutcome });

      // Validate market type specific requirements
      if (marketType === 'PRICE_FEED') {
        if (!selectedPriceFeed || !priceThreshold) {
          throw new Error('Price feed and threshold are required for price feed markets');
        }
      }

      const marketTypeValue = marketType === 'PRICE_FEED' ? 0 : 1; // 0 = PRICE_FEED, 1 = UMA_MANUAL
      const priceFeedAddress = marketType === 'PRICE_FEED' ? selectedPriceFeed : '0x0000000000000000000000000000000000000000';
      const priceThresholdValue = marketType === 'PRICE_FEED' ? BigInt(priceThreshold) : BigInt(0);

      const args: [string, boolean, bigint, `0x${string}`, bigint, bigint, bigint, bigint, bigint, number, `0x${string}`, bigint] = [
        ipfsHash,
        isMultiOption,
        BigInt(maxOptions),
        paymentToken as `0x${string}`,
        parseEther(minimumStake),
        parseEther(creatorDeposit),
        BigInt(parseInt(creatorOutcome)),
        BigInt(stakeDurationMinutes),
        BigInt(resolutionDurationMinutes),
        marketTypeValue, // uint8 is a number, not bigint
        priceFeedAddress as `0x${string}`,
        priceThresholdValue
      ];

      console.log('📋 Contract args:', args);

      // Step 5: Create market on blockchain
      // Calculate total value to send: market creation fee + creator deposit (for native PEPU)
      const marketCreationFee = parseEther("1"); // Always 1 PEPU
      const totalValue = paymentToken === '0x0000000000000000000000000000000000000000' 
        ? marketCreationFee + parseEther(creatorDeposit) 
        : marketCreationFee;

      console.log('💸 Transaction value:', totalValue.toString());

      console.log('🚀 Creating market contract...');
      const txResult = await writeContract({
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
              {"name": "stakeDurationMinutes", "type": "uint256"},
              {"name": "resolutionDurationMinutes", "type": "uint256"},
              {"name": "marketType", "type": "uint8"},
              {"name": "priceFeed", "type": "address"},
              {"name": "priceThreshold", "type": "uint256"}
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

      console.log('✅ Market creation transaction submitted:', txResult);

    } catch (err: any) {
      console.error('❌ Market creation failed:', err);
      
      // Show user-friendly error messages
      const errorMessage = err.message || err.toString() || '';
      if (errorMessage.includes('User rejected') || errorMessage.includes('User denied') || errorMessage.includes('rejected the request')) {
        setError('User rejected transaction');
      } else if (errorMessage.includes('insufficient funds')) {
        setError('Insufficient funds for transaction');
      } else if (errorMessage.includes('gas')) {
        setError('Transaction failed - please try again');
      } else {
        setError('Failed to create market - please try again');
      }
      
      setIsCreating(false);
      setIsUploadingImage(false);
      setIsUploadingMetadata(false);
      setIsCreatingContract(false);
      setSuccess('');
      setShowConfirmModal(false);
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
      // Show user-friendly error messages for approval
      const errorMessage = approvalError.message || '';
      if (errorMessage.includes('User rejected') || errorMessage.includes('User denied') || errorMessage.includes('rejected the request')) {
        setError('User rejected transaction');
      } else if (errorMessage.includes('insufficient funds')) {
        setError('Insufficient funds for approval');
      } else {
        setError('Approval failed - please try again');
      }
      setSuccess('');
    }
  }, [approvalError]);

  // Handle transaction success
  useEffect(() => {
    if (isConfirmed && hash) {
      // Try to get market ID from transaction receipt
      // For now, we'll just show success - market ID will be available via events
      setSuccess('🎉 Market created successfully!');
      setIsCreating(false);
      setIsUploadingImage(false);
      setIsUploadingMetadata(false);
      setIsCreatingContract(false);
      setError('');
      
      // Don't reset form yet - let user see success and navigate
    }
  }, [isConfirmed, hash]);

  // Handle transaction error
  useEffect(() => {
    if (writeError) {
      // Check if user rejected the transaction
      const errorMessage = writeError.message || '';
      if (errorMessage.includes('User rejected') || errorMessage.includes('User denied') || errorMessage.includes('rejected the request')) {
        setError('User rejected transaction');
      } else {
      setError(`Transaction failed: ${writeError.message}`);
      }
      setIsCreating(false);
      setIsUploadingImage(false);
      setIsUploadingMetadata(false);
      setIsCreatingContract(false);
      setSuccess('');
      setShowConfirmModal(false);
    }
  }, [writeError]);

  return (
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
            isDarkMode ? 'bg-black border-gray-300/20' : 'bg-[#F5F3F0] border-gray-200'
          }`}>
            <div className="px-4 lg:px-6 py-1.5 lg:py-2">
              <div className="flex items-center justify-between">
                {/* Left: Menu + Logo + Title */}
                <div className="flex items-center gap-3">
                  <button
                    onClick={onMenuClick}
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
                      width={90}
                      height={45}
                      className="object-contain"
                      priority
                    />
                  </Link>
                  
                  <div className="hidden lg:block">
                    <h1 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                      Create Market
                    </h1>
                    <p className={`text-sm ${isDarkMode ? 'text-white/70' : 'text-gray-600'}`}>
                      Create a new prediction market
                    </p>
                  </div>
                </div>

                {/* Right: Theme + Wallet */}
                <div className="flex items-center gap-2 lg:gap-4">
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
              isDarkMode ? 'bg-black border border-gray-300/30' : 'bg-[#F5F3F0] border border-gray-200'
            }`}>
              <h3 className={`text-lg font-semibold mb-4 ${
                isDarkMode ? 'text-white' : 'text-gray-800'
              }`}>
                Disconnect Wallet
              </h3>
              <p className={`text-sm mb-6 ${
                isDarkMode ? 'text-white/70' : 'text-gray-600'
              }`}>
                Are you sure you want to disconnect your wallet?
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDisconnectModal(false)}
                  className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isDarkMode 
                      ? 'bg-[#39FF14]/10 hover:bg-[#39FF14]/20 text-white border border-gray-300/30' 
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
              {/* P2P Balance Display */}
              {isConnected && p2pBalance && (
                <div className={`mb-6 p-4 rounded-lg border ${
                  isDarkMode 
                    ? 'bg-gray-800/50 border-gray-300 text-gray-300' 
                    : 'bg-gray-50 border-gray-200 text-gray-700'
                }`}>
                  <div className="flex items-center gap-2">
                    <Coins size={20} />
                    <span className="font-medium">
                      P2P Token Balance: {formatNumber(formatEther(p2pBalance.value))} P2P
                    </span>
                  </div>
                </div>
              )}


              {/* Form */}
            <div className={`rounded-xl border shadow-sm ${
              isDarkMode 
                ? 'bg-black border-gray-800' 
                : 'bg-[#F5F3F0] border-gray-300'
            }`}>
                <div className="p-4 lg:p-6 space-y-5 lg:space-y-6">
                  {/* Basic Info */}
                  <div className="space-y-4">
                  <h2 className={`text-base lg:text-lg font-semibold ${
                    isDarkMode ? 'text-[#39FF14]' : 'text-[#39FF14]'
                  }`}>Basic Information</h2>
                    
                    <div className="grid grid-cols-1 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-2">Market Title</label>
                        <input
                          type="text"
                          value={title}
                          onChange={(e) => setTitle(e.target.value)}
                          placeholder="e.g., Will Bitcoin reach $200k by end of 2025?"
                        className={`w-full px-3 py-2.5 border rounded-lg focus:border-[#39FF14] focus:outline-none text-sm ${
                          isDarkMode 
                            ? 'bg-black border-gray-700 text-white placeholder-gray-500' 
                            : 'bg-[#F5F3F0] border-gray-300 text-gray-900 placeholder-gray-500'
                        }`}
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-2">Description</label>
                        <textarea
                          value={description}
                          onChange={(e) => setDescription(e.target.value)}
                          placeholder="Provide a detailed description of the market..."
                          rows={4}
                        className={`w-full px-3 py-2.5 border rounded-lg focus:border-[#39FF14] focus:outline-none text-sm resize-y ${
                          isDarkMode 
                            ? 'bg-black border-gray-700 text-white placeholder-gray-500' 
                            : 'bg-[#F5F3F0] border-gray-300 text-gray-900 placeholder-gray-500'
                        }`}
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-2">Vanity Info (Links & Resources)</label>
                        <textarea
                          value={vanityInfo}
                          onChange={(e) => setVanityInfo(e.target.value)}
                          placeholder="Add links or information to help verifiers determine the correct result (e.g., official sources, news articles, data URLs)"
                          rows={3}
                        className={`w-full px-3 py-2.5 border rounded-lg focus:border-[#39FF14] focus:outline-none text-sm resize-y ${
                          isDarkMode 
                            ? 'bg-black border-gray-700 text-white placeholder-gray-500' 
                            : 'bg-[#F5F3F0] border-gray-300 text-gray-900 placeholder-gray-500'
                        }`}
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          This information will be visible to verifiers to help them make accurate decisions
                        </p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-2">Market Type</label>
                        <select
                          value={marketType}
                          onChange={(e) => {
                            const newType = e.target.value as 'PRICE_FEED' | 'UMA_MANUAL';
                            setMarketType(newType);
                            // Force binary (yesno) for price feed markets
                            if (newType === 'PRICE_FEED') {
                              setOutcomeType('yesno');
                            }
                          }}
                          className={`w-full px-3 py-2.5 border rounded-lg focus:border-[#39FF14] focus:outline-none text-sm appearance-none ${
                            isDarkMode 
                              ? 'bg-black border-gray-700 text-white' 
                              : 'bg-[#F5F3F0] border-gray-300 text-gray-900'
                          }`}
                        >
                          <option value="UMA_MANUAL">Optimistic Oracle (Sports, Politics, etc.)</option>
                          <option value="PRICE_FEED">Price Feed (Auto-resolve from price)</option>
                        </select>
                        <p className="text-xs text-gray-500 mt-1">
                          {marketType === 'PRICE_FEED' 
                            ? 'Market will auto-resolve based on price feed threshold (Yes/No only)' 
                            : 'Market requires Optimistic Oracle assertion for resolution'}
                        </p>
                      </div>

                      {marketType === 'PRICE_FEED' && (
                        <>
                          <div>
                            <label className="block text-sm font-medium mb-2">Price Feed</label>
                            <select
                              value={selectedPriceFeed}
                              onChange={(e) => setSelectedPriceFeed(e.target.value)}
                              className={`w-full px-3 py-2.5 border rounded-lg focus:border-[#39FF14] focus:outline-none text-sm appearance-none ${
                                isDarkMode 
                                  ? 'bg-black border-gray-700 text-white' 
                                  : 'bg-[#F5F3F0] border-gray-300 text-gray-900'
                              }`}
                            >
                              <option value="">Select price feed...</option>
                              <option value="0x20D9BBEAE75d9E17176520aD473234BE293e4C5d">ETH/USD</option>
                              <option value="0xA74CCEe7759c7bb2cE3f0b1599428fed08FaB8Ce">BTC/USD</option>
                              <option value="0x786BE298CFfF15c49727C0998392Ff38e45f99b3">SOL/USD</option>
                              <option value="0x51C17E20994C6c0eE787fE1604ef14EBafdB7ce9">PEPU/USD</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-sm font-medium mb-2">
                              Market Direction
                            </label>
                            <div className="flex gap-2 mb-4">
                              <button
                                type="button"
                                onClick={() => setPriceDirection('over')}
                                className={`flex-1 px-3 py-2 rounded text-sm font-medium transition-colors ${
                                  priceDirection === 'over'
                                    ? isDarkMode 
                                      ? 'bg-[#39FF14] text-black' 
                                      : 'bg-[#39FF14] text-black border-2 border-black'
                                    : isDarkMode
                                      ? 'bg-gray-800 hover:bg-gray-700 text-white'
                                      : 'bg-gray-200 hover:bg-gray-300 text-gray-900'
                                }`}
                              >
                                Over (Yes if price ≥ threshold)
                              </button>
                              <button
                                type="button"
                                onClick={() => setPriceDirection('under')}
                                className={`flex-1 px-3 py-2 rounded text-sm font-medium transition-colors ${
                                  priceDirection === 'under'
                                    ? isDarkMode 
                                      ? 'bg-[#39FF14] text-black' 
                                      : 'bg-[#39FF14] text-black border-2 border-black'
                                    : isDarkMode
                                      ? 'bg-gray-800 hover:bg-gray-700 text-white'
                                      : 'bg-gray-200 hover:bg-gray-300 text-gray-900'
                                }`}
                              >
                                Under (Yes if price &lt; threshold)
                              </button>
                            </div>
                          </div>

                          <div>
                            <label className="block text-sm font-medium mb-2">
                              Price Threshold
                            </label>
                            {isLoadingPrice && (
                              <p className={`text-xs mb-2 ${isDarkMode ? 'text-white/70' : 'text-gray-600'}`}>
                                Loading current price...
                              </p>
                            )}
                            {priceError && (
                              <p className={`text-xs mb-2 ${isDarkMode ? 'text-yellow-400' : 'text-yellow-600'}`}>
                                ⚠️ {priceError}
                              </p>
                            )}
                            {currentPrice && !priceError && (
                              <p className={`text-xs mb-2 ${isDarkMode ? 'text-white/70' : 'text-gray-600'}`}>
                                Current price: <span className="text-[#39FF14]">${currentPrice}</span>
                              </p>
                            )}
                            <input
                              type="text"
                              value={priceThresholdDisplay}
                              onChange={(e) => {
                                const value = e.target.value;
                                setPriceThresholdDisplay(value);
                                
                                if (value === '') {
                                  setPriceThreshold('');
                                  return;
                                }
                                
                                // Allow partial input (e.g., "2", "2.", "2.5")
                                // Only update the scaled value when it's a valid number
                                try {
                                  const numValue = parseFloat(value);
                                  if (!isNaN(numValue) && numValue >= 0) {
                                    const scaledValue = BigInt(Math.round(numValue * (10 ** priceDecimals)));
                                    setPriceThreshold(scaledValue.toString());
                                  }
                                } catch {
                                  // Invalid input, keep display value but don't update scaled value
                                }
                              }}
                              placeholder={currentPrice ? `e.g., ${currentPrice}` : "e.g., 2000.00"}
                              className={`w-full px-3 py-2.5 border rounded-lg focus:border-[#39FF14] focus:outline-none text-sm ${
                                isDarkMode 
                                  ? 'bg-black border-gray-700 text-white placeholder-gray-500' 
                                  : 'bg-[#F5F3F0] border-gray-300 text-gray-900 placeholder-gray-500'
                              }`}
                            />
                            {priceThreshold && (
                              <p className={`text-xs mt-1 ${isDarkMode ? 'text-white/70' : 'text-gray-600'}`}>
                                Threshold: ${(() => {
                                  try {
                                    const thresholdBigInt = BigInt(priceThreshold);
                                    const divisor = BigInt(10 ** priceDecimals);
                                    const wholePart = thresholdBigInt / divisor;
                                    const fractionalPart = thresholdBigInt % divisor;
                                    const fractionalStr = fractionalPart.toString().padStart(priceDecimals, '0');
                                    return `${wholePart}.${fractionalStr}`;
                                  } catch {
                                    return 'Invalid';
                                  }
                                })()}
                                {priceDirection === 'over' ? (
                                  <span className="text-green-500"> - Yes wins if price ≥ threshold</span>
                                ) : (
                                  <span className="text-green-500"> - Yes wins if price &lt; threshold</span>
                                )}
                              </p>
                            )}
                            <p className="text-xs text-gray-500 mt-1">
                              {priceDirection === 'over' 
                                ? 'Yes wins if final price is greater than or equal to threshold'
                                : 'Yes wins if final price is less than threshold'}
                            </p>
                          </div>
                        </>
                      )}

                      <div>
                        <label className="block text-sm font-medium mb-2">Payment Token</label>
                        <select
                          value={selectedToken}
                          onChange={(e) => setSelectedToken(e.target.value)}
                          disabled={outcomeType === 'multiple'} // Multi-option markets must use P2P token
                        className={`w-full px-3 py-2.5 border rounded-lg focus:border-[#39FF14] focus:outline-none text-sm appearance-none ${
                          isDarkMode 
                            ? 'bg-black border-gray-700 text-white' 
                            : 'bg-[#F5F3F0] border-gray-300 text-gray-900'
                        }`}
                        >
                          {tokens.map((token) => (
                            <option key={token.address} value={token.address}>
                              {token.name} {outcomeType === 'multiple' && P2P_TOKEN_ADDRESS && token.address !== P2P_TOKEN_ADDRESS ? '(Not available for multi-option)' : ''}
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
                        className={`w-full px-3 py-2.5 border rounded-lg focus:border-[#39FF14] focus:outline-none text-sm ${
                          isDarkMode 
                            ? 'bg-black border-gray-700 text-white placeholder-gray-500' 
                            : 'bg-[#F5F3F0] border-gray-300 text-gray-900 placeholder-gray-500'
                        }`}
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Balance: {getUserTokenBalance(selectedToken) ? formatNumber(formatEther(getUserTokenBalance(selectedToken)!.value)) : '0'} {tokens.find(t => t.address === selectedToken)?.symbol || 'PEPU'}
                        </p>
                      </div>

                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">Market Image</label>
                      <div className="space-y-3">
                        {!imagePreview ? (
                          <div className="relative">
                            <input
                              type="file"
                              accept="image/*"
                              onChange={handleImageUpload}
                              className="hidden"
                              id="image-upload"
                            />
                            <label
                              htmlFor="image-upload"
                              className={`w-full px-3 py-2.5 border-2 border-dashed rounded-lg cursor-pointer transition-colors flex items-center justify-center gap-2 ${
                                isDarkMode 
                                  ? 'border-gray-600 hover:border-gray-500 text-gray-400 hover:text-gray-300' 
                                  : 'border-gray-300 hover:border-gray-400 text-gray-500 hover:text-gray-600'
                              }`}
                            >
                              <Plus size={20} />
                              <span>Click to upload image</span>
                            </label>
                          </div>
                        ) : (
                          <div className="relative">
                            <img
                              src={imagePreview}
                              alt="Market preview"
                              className="w-full h-48 object-cover rounded-lg"
                            />
                            <button
                              type="button"
                              onClick={removeImage}
                              className="absolute top-2 right-2 p-1 bg-red-500 hover:bg-red-600 text-white rounded-full transition-colors"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        )}
                        <p className="text-xs text-gray-500">
                          Upload an image to represent your market (max 10MB, JPG/PNG/GIF)
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Duration */}
                  <div className="space-y-4">
                  <h2 className={`text-base lg:text-lg font-semibold ${
                    isDarkMode ? 'text-[#39FF14]' : 'text-[#39FF14]'
                  }`}>Market Timing</h2>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-2">Staking Duration</label>
                        <p className="text-xs text-gray-500 mb-2">How long users can place stakes</p>
                        <div className="space-y-2">
                          <div className="relative">
                            <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                            <input
                              type="number"
                              value={stakingDays}
                              onChange={(e) => setStakingDays(e.target.value)}
                              placeholder="0"
                              min="0"
                              step="1"
                              className={`w-full pl-8 pr-16 py-2.5 border rounded-lg focus:border-[#39FF14] focus:outline-none text-sm ${
                                isDarkMode 
                                  ? 'bg-black border-gray-300 text-white placeholder-gray-500' 
                                  : 'bg-[#F5F3F0] border-gray-300 text-gray-900 placeholder-gray-500'
                              }`}
                            />
                            <span className={`absolute right-4 top-1/2 transform -translate-y-1/2 text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>days</span>
                          </div>
                          <div className="relative">
                            <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                            <input
                              type="number"
                              value={stakingHours}
                              onChange={(e) => setStakingHours(e.target.value)}
                              placeholder="1"
                              min="0"
                              max="23"
                              step="1"
                              className={`w-full pl-8 pr-16 py-2.5 border rounded-lg focus:border-[#39FF14] focus:outline-none text-sm ${
                                isDarkMode 
                                  ? 'bg-black border-gray-300 text-white placeholder-gray-500' 
                                  : 'bg-[#F5F3F0] border-gray-300 text-gray-900 placeholder-gray-500'
                              }`}
                            />
                            <span className={`absolute right-4 top-1/2 transform -translate-y-1/2 text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>hours</span>
                          </div>
                          <div className="relative">
                            <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                            <input
                              type="number"
                              value={stakingMinutes}
                              onChange={(e) => setStakingMinutes(e.target.value)}
                              placeholder="0"
                              min="0"
                              max="59"
                              step="1"
                              className={`w-full pl-8 pr-16 py-2.5 border rounded-lg focus:border-[#39FF14] focus:outline-none text-sm ${
                                isDarkMode 
                                  ? 'bg-black border-gray-300 text-white placeholder-gray-500' 
                                  : 'bg-[#F5F3F0] border-gray-300 text-gray-900 placeholder-gray-500'
                              }`}
                            />
                            <span className={`absolute right-4 top-1/2 transform -translate-y-1/2 text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>minutes</span>
                          </div>
                        </div>
                        <p className={`text-xs mt-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                          Total: {getStakingDurationMinutes()} minutes
                          <br />
                          <span className={`font-medium ${isDarkMode ? 'text-blue-300' : 'text-blue-600'}`}>
                            Ends: <ClientOnly>{getStakingEndDate()}</ClientOnly>
                          </span>
                        </p>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium mb-2">Resolution Duration</label>
                        <p className="text-xs text-gray-500 mb-2">Total time until market can be resolved</p>
                        <div className="space-y-2">
                          <div className="relative">
                            <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                            <input
                              type="number"
                              value={resolutionDays}
                              onChange={(e) => setResolutionDays(e.target.value)}
                              placeholder="0"
                              min="0"
                              step="1"
                              className={`w-full pl-8 pr-12 py-2.5 border rounded-lg focus:border-[#39FF14] focus:outline-none text-sm ${
                                isDarkMode 
                                  ? 'bg-black border-gray-300 text-white placeholder-gray-500' 
                                  : 'bg-[#F5F3F0] border-gray-300 text-gray-900 placeholder-gray-500'
                              }`}
                            />
                            <span className={`absolute right-4 top-1/2 transform -translate-y-1/2 text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>days</span>
                          </div>
                          <div className="relative">
                            <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                            <input
                              type="number"
                              value={resolutionHours}
                              onChange={(e) => setResolutionHours(e.target.value)}
                              placeholder="2"
                              min="0"
                              max="23"
                              step="1"
                              className={`w-full pl-8 pr-16 py-2.5 border rounded-lg focus:border-[#39FF14] focus:outline-none text-sm ${
                                isDarkMode 
                                  ? 'bg-black border-gray-300 text-white placeholder-gray-500' 
                                  : 'bg-[#F5F3F0] border-gray-300 text-gray-900 placeholder-gray-500'
                              }`}
                            />
                            <span className={`absolute right-4 top-1/2 transform -translate-y-1/2 text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>hours</span>
                          </div>
                          <div className="relative">
                            <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                            <input
                              type="number"
                              value={resolutionMinutes}
                              onChange={(e) => setResolutionMinutes(e.target.value)}
                              placeholder="0"
                              min="0"
                              max="59"
                              step="1"
                              className={`w-full pl-8 pr-12 py-2.5 border rounded-lg focus:border-[#39FF14] focus:outline-none text-sm ${
                                isDarkMode 
                                  ? 'bg-black border-gray-300 text-white placeholder-gray-500' 
                                  : 'bg-[#F5F3F0] border-gray-300 text-gray-900 placeholder-gray-500'
                              }`}
                            />
                            <span className={`absolute right-4 top-1/2 transform -translate-y-1/2 text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>minutes</span>
                          </div>
                        </div>
                        <p className={`text-xs mt-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                          Total: {getResolutionDurationMinutes()} minutes
                          <br />
                          <span className={`font-medium ${isDarkMode ? 'text-green-300' : 'text-green-600'}`}>
                            Resolves: <ClientOnly>{getResolutionEndDate()}</ClientOnly>
                          </span>
                        </p>
                      </div>
                    </div>
                    
                    <div className={`p-3 rounded-lg ${isDarkMode ? 'bg-blue-900/20 border border-blue-800' : 'bg-blue-50 border border-blue-200'}`}>
                      <div className="flex items-start gap-2">
                        <AlertCircle className={`w-4 h-4 mt-0.5 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`} />
                        <div className="text-sm">
                          <p className={`font-medium ${isDarkMode ? 'text-blue-300' : 'text-blue-800'}`}>
                            Timing Example:
                          </p>
                          <p className={`text-xs mt-1 ${isDarkMode ? 'text-blue-400' : 'text-blue-700'}`}>
                            For Premier League prediction: Staking = 2 weeks, Resolution = 6 months
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Categories & Tokens Row */}
                  <div className="grid grid-cols-1 gap-6">
                    {/* Categories */}
                    <div className="space-y-3">
                    <h2 className={`text-base lg:text-lg font-semibold ${
                      isDarkMode ? 'text-[#39FF14]' : 'text-[#39FF14]'
                    }`}>Categories</h2>
                      
                      <div className="flex flex-wrap gap-2">
                        {availableCategories.map((category) => (
                          <button
                            key={category}
                            onClick={() => {
                              if (marketType !== 'PRICE_FEED') {
                                handleCategoryToggle(category);
                              }
                            }}
                            disabled={marketType === 'PRICE_FEED'}
                            className={`
                              px-3 py-1.5 rounded-full text-xs font-medium transition-colors flex items-center gap-1.5 border
                              ${selectedCategories.includes(category)
                                ? isDarkMode 
                                  ? 'bg-[#39FF14] text-black border-[#39FF14]'
                                  : 'bg-[#39FF14] text-black border-[#39FF14]'
                              : isDarkMode
                                ? 'bg-black text-white border-gray-700 hover:bg-gray-900'
                                : 'bg-[#F5F3F0] text-gray-900 border-gray-300 hover:bg-gray-200'
                              }
                              ${marketType === 'PRICE_FEED' ? 'cursor-not-allowed opacity-75' : ''}
                            `}
                          >
                            {selectedCategories.includes(category) && <Minus size={14} />}
                            {category}
                          </button>
                        ))}
                      </div>
                    </div>

                  </div>

                  {/* Outcome Type */}
                  <div className="space-y-4">
                  <h2 className={`text-base lg:text-lg font-semibold ${
                    isDarkMode ? 'text-[#39FF14]' : 'text-[#39FF14]'
                  }`}>Outcome Type</h2>
                    
                    <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                      <button
                        onClick={() => setOutcomeType('yesno')}
                        className={`
                          flex-1 px-4 py-3 rounded-lg border-2 transition-colors flex items-center justify-center gap-2 text-sm font-medium
                          ${outcomeType === 'yesno'
                          ? isDarkMode
                            ? 'border-[#39FF14] bg-black text-[#39FF14]'
                            : 'border-[#39FF14] bg-[#F5F3F0] text-[#39FF14]'
                          : isDarkMode
                            ? 'border-gray-700 bg-black text-white hover:bg-gray-900'
                            : 'border-gray-300 bg-[#F5F3F0] text-gray-900 hover:bg-gray-200'
                          }
                        `}
                      >
                        Yes/No
                      </button>
                      
                      <button
                        onClick={() => {
                          if (marketType !== 'PRICE_FEED') {
                            setOutcomeType('multiple');
                          }
                        }}
                        disabled={marketType === 'PRICE_FEED'}
                        className={`
                          flex-1 px-4 py-3 rounded-lg border-2 transition-colors flex items-center justify-center gap-2 text-sm font-medium
                          ${marketType === 'PRICE_FEED'
                            ? isDarkMode
                              ? 'border-gray-800 bg-gray-900 text-gray-600 cursor-not-allowed opacity-50'
                              : 'border-gray-300 bg-gray-200 text-gray-500 cursor-not-allowed opacity-50'
                            : outcomeType === 'multiple'
                          ? isDarkMode
                            ? 'border-[#39FF14] bg-black text-[#39FF14]'
                            : 'border-[#39FF14] bg-[#F5F3F0] text-[#39FF14]'
                          : isDarkMode
                            ? 'border-gray-700 bg-black text-white hover:bg-gray-900'
                            : 'border-gray-300 bg-[#F5F3F0] text-gray-900 hover:bg-gray-200'
                          }
                        `}
                      >
                        Multiple Options
                        {marketType === 'PRICE_FEED' && ' (Not available)'}
                      </button>
                    </div>
                  </div>


                  {/* Multiple Options */}
                  {outcomeType === 'multiple' && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm lg:text-md font-medium">Options (2-10)</h3>
                        {multipleOptions.length < 10 && (
                          <button
                            onClick={addMultipleOption}
                            className={`px-3 py-1.5 rounded-lg text-sm transition-colors flex items-center gap-2 ${
                              isDarkMode 
                                ? 'bg-[#39FF14] hover:bg-[#39FF14]/80 text-black' 
                                : 'bg-[#39FF14] hover:bg-[#39FF14]/80 text-black border border-black'
                            }`}
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
                            className={`flex-1 px-3 py-2.5 border rounded-lg focus:border-[#39FF14] focus:outline-none text-sm ${
                              isDarkMode 
                                ? 'bg-black border-gray-700 text-white placeholder-gray-400' 
                                : 'bg-[#F5F3F0] border-gray-300 text-gray-900 placeholder-gray-500'
                            }`}
                            />
                            {multipleOptions.length > 2 && (
                              <button
                                onClick={() => removeMultipleOption(index)}
                                className="px-3 py-2.5 bg-red-600 hover:bg-red-700 rounded-lg transition-colors text-white"
                              >
                                <Trash2 size={16} />
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
                      isDarkMode ? 'text-[#39FF14]' : 'text-[#39FF14]'
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
                      className={`w-full px-3 py-2.5 border rounded-lg focus:border-[#39FF14] focus:outline-none text-sm ${
                        isDarkMode 
                          ? 'bg-black border-gray-700 text-white placeholder-gray-400' 
                          : 'bg-[#F5F3F0] border-gray-300 text-gray-900 placeholder-gray-500'
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
                        className={`w-full px-3 py-2.5 border rounded-lg focus:border-[#39FF14] focus:outline-none text-sm appearance-none ${
                          isDarkMode 
                            ? 'bg-black border-gray-700 text-white' 
                            : 'bg-[#F5F3F0] border-gray-300 text-gray-900'
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
                        className={`w-full px-3 py-2.5 border rounded-lg focus:border-[#39FF14] focus:outline-none text-sm appearance-none ${
                          isDarkMode 
                            ? 'bg-black border-gray-700 text-white' 
                            : 'bg-[#F5F3F0] border-gray-300 text-gray-900'
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

                    {/* Single button that switches between Approve and Create Market */}
                    <button 
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        console.log('🔘 Button clicked!');
                        console.log('📋 Current state:', {
                          isConnected,
                          creatorDeposit,
                          P2P_TOKEN_ADDRESS,
                          outcomeType,
                          selectedToken,
                          hasSufficientAllowance,
                          allowance: allowance?.toString(),
                          requiredAmount: requiredAmount.toString(),
                          isApprovalConfirmed,
                          isApprovalPending,
                          isApprovalConfirming,
                          isCreating,
                          isUploadingImage,
                          isUploadingMetadata,
                          isCreatingContract,
                          isPending,
                          isConfirming
                        });
                        
                        // Multiple outcomes always use P2P token, Linear can use any supported token
                        // Approval needed for any ERC20 token (not native PEPU)
                        const needsApproval = (outcomeType === 'multiple' && !hasSufficientAllowance) || 
                                           (outcomeType === 'yesno' && selectedToken !== '0x0000000000000000000000000000000000000000' && !hasSufficientAllowance);
                        
                        console.log('🔍 Needs approval:', needsApproval);
                        
                        if (needsApproval) {
                          console.log('🚀 Calling approveTokens()');
                          approveTokens();
                        } else {
                          console.log('🚀 Calling handleCreateClick()');
                          try {
                            handleCreateClick();
                            console.log('✅ handleCreateClick() called successfully');
                          } catch (error) {
                            console.error('❌ Error calling handleCreateClick:', error);
                            setError('Failed to open confirmation modal. Please try again.');
                          }
                        }
                      }}
                      disabled={(() => {
                        const needsApproval = (outcomeType === 'multiple' && !hasSufficientAllowance) || 
                                           (outcomeType === 'yesno' && selectedToken !== '0x0000000000000000000000000000000000000000' && !hasSufficientAllowance);
                        const isDisabled = !isConnected || 
                        !creatorDeposit ||
                                          (needsApproval 
                          ? (isApprovalPending || isApprovalConfirming) 
                                            : (isCreating || isUploadingImage || isUploadingMetadata || isCreatingContract || isPending || isConfirming));
                        if (isDisabled) {
                          console.log('🔒 Button disabled:', {
                            notConnected: !isConnected,
                            noCreatorDeposit: !creatorDeposit,
                            needsApproval,
                            isApprovalPending,
                            isApprovalConfirming,
                            isCreating,
                            isUploadingImage,
                            isUploadingMetadata,
                            isCreatingContract,
                            isPending,
                            isConfirming
                          });
                        }
                        return isDisabled;
                      })()}
                      className={`w-full px-6 py-3 font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 ${
                        !isConnected || 
                        !creatorDeposit ||
                        (((outcomeType === 'multiple' && !hasSufficientAllowance) || 
                          (outcomeType === 'yesno' && selectedToken !== '0x0000000000000000000000000000000000000000' && !hasSufficientAllowance)) 
                          ? (isApprovalPending || isApprovalConfirming) 
                          : (isCreating || isUploadingImage || isUploadingMetadata || isCreatingContract || isPending || isConfirming))
                          ? 'bg-gray-400 cursor-not-allowed text-gray-200'
                          : ((outcomeType === 'multiple' && !hasSufficientAllowance) || 
                             (outcomeType === 'yesno' && selectedToken !== '0x0000000000000000000000000000000000000000' && !hasSufficientAllowance))
                            ? isDarkMode 
                              ? 'bg-[#39FF14] hover:bg-[#39FF14]/80 text-black'
                              : 'bg-[#39FF14] hover:bg-[#39FF14]/80 text-black border border-black'
                            : isDarkMode 
                              ? 'bg-[#39FF14] hover:bg-[#39FF14]/80 text-black'
                              : 'bg-[#39FF14] hover:bg-[#39FF14]/80 text-black border border-black'
                      }`}
                    >
                      {(isApprovalPending || isApprovalConfirming || isCreating || isUploadingImage || isUploadingMetadata || isCreatingContract || isPending || isConfirming) && <Loader2 size={20} className="animate-spin" />}
                      {isApprovalPending ? 'Approving...' : 
                       isApprovalConfirming ? 'Processing Approval...' :
                       isUploadingImage ? 'Uploading Image...' :
                       isUploadingMetadata ? 'Creating Metadata...' :
                       isCreatingContract ? 'Creating Market...' :
                       isPending ? 'Confirming Transaction...' :
                       isConfirming ? 'Processing...' :
                       ((outcomeType === 'multiple' && !hasSufficientAllowance) || 
                        (outcomeType === 'yesno' && selectedToken !== '0x0000000000000000000000000000000000000000' && !hasSufficientAllowance)) ? 'Approve Tokens' :
                       'Create Market'}
                    </button>
                    {!isConnected && (
                      <p className="text-sm text-gray-500 mt-2 text-center">Please connect your wallet to create a market</p>
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

        {/* Confirmation Modal */}
        {showConfirmModal && (
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4"
            onClick={(e) => {
              if (e.target === e.currentTarget && !isCreating && !isUploadingImage && !isUploadingMetadata && !isCreatingContract) {
                setShowConfirmModal(false);
              }
            }}
          >
            <div className={`rounded-xl border shadow-2xl max-w-lg w-full max-h-[85vh] overflow-y-auto scrollbar-hide transform transition-all duration-200 ${
              isDarkMode ? 'bg-black border-gray-800' : 'bg-[#F5F3F0] border-gray-300'
            }`}>
              <div className="p-4 lg:p-5">
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                  <h2 className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    Confirm Market Creation
                  </h2>
                  {!isCreating && !isUploadingImage && !isUploadingMetadata && !isCreatingContract && (
                    <button
                      onClick={() => setShowConfirmModal(false)}
                      className={`p-1.5 rounded-lg transition-colors ${
                        isDarkMode ? 'hover:bg-gray-800 text-white' : 'hover:bg-gray-200 text-gray-900'
                      }`}
                    >
                      <X size={18} />
                    </button>
                  )}
                </div>

                {/* Market Preview */}
                <div className={`mb-4 rounded-lg border overflow-hidden ${
                  isDarkMode ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-300'
                }`}>
                  {imagePreview && (
                    <div className="w-full h-32 relative">
                      <Image
                        src={imagePreview}
                        alt={title}
                        fill
                        className="object-cover"
                      />
                    </div>
                  )}
                  <div className="p-3">
                    <h3 className={`text-base font-semibold mb-1.5 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                      {title || 'Market Title'}
                    </h3>
                    {description && (
                      <p className={`text-xs mb-2 line-clamp-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                        {description}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {selectedCategories.map((cat) => (
                        <span
                          key={cat}
                          className={`text-xs px-1.5 py-0.5 rounded ${
                            isDarkMode ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {cat}
                        </span>
                      ))}
                    </div>
                    <div className={`text-xs space-y-0.5 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                      <div>Type: {outcomeType === 'multiple' ? 'Multiple Options' : 'Yes/No'}</div>
                      <div>Market Type: {marketType === 'PRICE_FEED' ? 'Price Feed' : 'P2P Optimistic'}</div>
                      <div>Min Stake: {minimumStake} {tokens.find(t => t.address === selectedToken)?.symbol || 'PEPU'}</div>
                      <div>Creator Deposit: {creatorDeposit} {tokens.find(t => t.address === selectedToken)?.symbol || 'PEPU'}</div>
                    </div>
                  </div>
                </div>

                {/* Status Messages - Only show errors and final success */}
                {(error || (success && isConfirmed)) && (
                  <div className="space-y-2 mb-4">
                    {error && (
                      <div className={`p-3 rounded-lg border flex items-center gap-2 ${
                        isDarkMode 
                          ? 'bg-red-900/20 border-red-800 text-red-300' 
                          : 'bg-red-50 border-red-200 text-red-800'
                      }`}>
                        <AlertCircle size={18} />
                        <span className="text-sm">{error}</span>
                      </div>
                    )}

                    {success && isConfirmed && (
                      <div className={`p-3 rounded-lg border flex items-center gap-2 ${
                        isDarkMode 
                          ? 'bg-emerald-900/20 border-emerald-700 text-emerald-300' 
                          : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      }`}>
                        <CheckCircle size={18} />
                        <span className="text-sm">{success}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Action Buttons */}
                {isConfirmed ? (
                  <div className="flex gap-2">
                    <Link
                      href="/"
                      className={`flex-1 px-4 py-2 rounded-lg font-semibold text-center transition-colors text-sm ${
                        isDarkMode 
                          ? 'bg-[#39FF14] hover:bg-[#39FF14]/80 text-black' 
                          : 'bg-[#39FF14] hover:bg-[#39FF14]/80 text-black border border-black'
                      }`}
                    >
                      Go to Market
                    </Link>
                    <button
                      onClick={() => {
                        setShowConfirmModal(false);
                        setSuccess('');
                        setError('');
                        // Reset form
                        setTitle('');
                        setDescription('');
                        setVanityInfo('');
                        setImageFile(null);
                        setImagePreview(null);
                        setSelectedCategories([]);
                        setOutcomeType('yesno');
                        setMultipleOptions(['', '']);
                        setMinimumStake('');
                        setStakingDays('');
                        setStakingHours('');
                        setStakingMinutes('');
                        setResolutionDays('');
                        setResolutionHours('');
                        setResolutionMinutes('');
                        setCreatorDeposit('');
                        setCreatorOutcome('');
                        setSelectedToken('0x0000000000000000000000000000000000000000');
                        setMarketType('UMA_MANUAL');
                        setSelectedPriceFeed('');
                        setPriceThreshold('');
                      }}
                      className={`px-4 py-2 rounded-lg font-semibold transition-colors text-sm ${
                        isDarkMode 
                          ? 'bg-gray-800 hover:bg-gray-700 text-white' 
                          : 'bg-gray-200 hover:bg-gray-300 text-gray-900'
                      }`}
                    >
                      Create Another
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowConfirmModal(false)}
                      disabled={isCreating || isUploadingImage || isUploadingMetadata || isCreatingContract}
                      className={`flex-1 px-4 py-2 rounded-lg font-semibold transition-colors text-sm ${
                        isCreating || isUploadingImage || isUploadingMetadata || isCreatingContract
                          ? 'bg-gray-400 cursor-not-allowed text-gray-200'
                          : isDarkMode 
                            ? 'bg-gray-800 hover:bg-gray-700 text-white' 
                            : 'bg-gray-200 hover:bg-gray-300 text-gray-900'
                      }`}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={createMarket}
                      disabled={isCreating || isUploadingImage || isUploadingMetadata || isCreatingContract || isPending || isConfirming}
                      className={`flex-1 px-3 py-2 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2 text-xs sm:text-sm min-w-0 max-w-full overflow-hidden ${
                        isCreating || isUploadingImage || isUploadingMetadata || isCreatingContract || isPending || isConfirming
                          ? 'bg-gray-400 cursor-not-allowed text-gray-200'
                          : isDarkMode 
                            ? 'bg-[#39FF14] hover:bg-[#39FF14]/80 text-black' 
                            : 'bg-[#39FF14] hover:bg-[#39FF14]/80 text-black border border-black'
                      }`}
                    >
                      {(isCreating || isUploadingImage || isUploadingMetadata || isCreatingContract || isPending || isConfirming) && (
                        <Loader2 size={16} className="animate-spin flex-shrink-0" />
                      )}
                      <span className="truncate">
                        {isUploadingImage ? 'Uploading Image...' :
                         isUploadingMetadata ? 'Creating Metadata...' :
                         isCreatingContract ? 'Creating Market...' :
                         isPending || isConfirming ? 'Confirming...' :
                         'Confirm & Create'}
                      </span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Bottom Notifications Bar */}
        <div className="fixed bottom-0 left-0 right-0 z-50 p-4 pointer-events-none">
          <div className={`max-w-4xl mx-auto space-y-2 pointer-events-auto ${
            sidebarCollapsed ? 'lg:ml-16' : 'lg:ml-64'
          }`}>
            {error && (
              <div className={`p-4 rounded-lg border shadow-lg flex items-center gap-3 animate-slide-up ${
                isDarkMode 
                  ? 'bg-red-900/90 border-red-800 text-red-300' 
                  : 'bg-red-50 border-red-200 text-red-800'
              }`}>
                <AlertCircle size={20} className="flex-shrink-0" />
                <span className="flex-1 text-sm font-medium">{error}</span>
                <button
                  onClick={() => setError('')}
                  className="p-1 rounded hover:bg-red-200/50 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
            )}

            {success && !showConfirmModal && (
              <div className={`p-4 rounded-lg border shadow-lg flex items-center gap-3 animate-slide-up ${
                isDarkMode 
                  ? 'bg-emerald-900/90 border-emerald-700 text-emerald-300' 
                  : 'bg-emerald-50 border-emerald-200 text-emerald-800'
              }`}>
                <CheckCircle size={20} className="flex-shrink-0" />
                <span className="flex-1 text-sm font-medium">{success}</span>
                <button
                  onClick={() => setSuccess('')}
                  className="p-1 rounded hover:bg-emerald-200/50 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
  );
}