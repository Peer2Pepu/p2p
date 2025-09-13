"use client";

import React, { useState, useRef, useEffect } from 'react';
import { 
  Plus,
  Menu,
  Sun,
  Moon,
  Wallet,
  AlertCircle,
  CheckCircle,
  Loader2,
  Coins,
  Hash,
  Tag
} from 'lucide-react';
import { Sidebar } from '../components/Sidebar';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, useBalance, useChainId, useDisconnect, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { pepuMainnet } from '../chains';
import { useTheme } from '../context/ThemeContext';

export default function AddTokenPage() {
  const { isDarkMode, toggleTheme } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showDisconnectModal, setShowDisconnectModal] = useState(false);
  const connectButtonRef = useRef<HTMLDivElement>(null);
  
  // Form state
  const [tokenAddress, setTokenAddress] = useState('');
  const [tokenSymbol, setTokenSymbol] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Contract addresses from environment
  const P2P_MARKETMANAGER_ADDRESS = process.env.NEXT_PUBLIC_P2P_MARKETMANAGER_ADDRESS as `0x${string}`;

  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { disconnect } = useDisconnect();

  // Contract hooks
  const { writeContract, data: hash, isPending, error: writeError } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash,
  });

  const onMenuClick = () => setSidebarOpen(!sidebarOpen);
  const onSidebarClose = () => setSidebarOpen(false);
  const onToggleCollapse = () => setSidebarCollapsed(!sidebarCollapsed);

  // Validate token address
  const isValidAddress = (address: string) => {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  };

  // Validate symbol
  const isValidSymbol = (symbol: string) => {
    return symbol.length >= 1 && symbol.length <= 10 && /^[A-Z0-9]+$/.test(symbol);
  };

  // Add token function
  const addToken = async () => {
    if (!isConnected || !address) {
      setError('Please connect your wallet');
      return;
    }

    // Validate inputs
    if (!tokenAddress.trim()) {
      setError('Please enter a token address');
      return;
    }

    if (!isValidAddress(tokenAddress)) {
      setError('Please enter a valid token address (0x...)');
      return;
    }

    if (!tokenSymbol.trim()) {
      setError('Please enter a token symbol');
      return;
    }

    if (!isValidSymbol(tokenSymbol)) {
      setError('Token symbol must be 1-10 uppercase letters/numbers only');
      return;
    }

    setIsAdding(true);
    setError('');
    setSuccess('');

    try {
      await writeContract({
        address: P2P_MARKETMANAGER_ADDRESS,
        abi: [
          {
            "inputs": [
              {"name": "token", "type": "address"},
              {"name": "symbol", "type": "string"}
            ],
            "name": "addSupportedToken",
            "outputs": [],
            "stateMutability": "nonpayable",
            "type": "function"
          }
        ],
        functionName: 'addSupportedToken',
        args: [tokenAddress as `0x${string}`, tokenSymbol.toUpperCase()],
      });
    } catch (err: any) {
      setError(err.message || 'Failed to add token');
      setIsAdding(false);
      setSuccess('');
    }
  };

  // Handle transaction success
  useEffect(() => {
    if (isConfirmed) {
      setSuccess(`Token ${tokenSymbol.toUpperCase()} added successfully!`);
      setIsAdding(false);
      setError('');
      // Reset form
      setTokenAddress('');
      setTokenSymbol('');
    }
  }, [isConfirmed, tokenSymbol]);

  // Handle transaction error
  useEffect(() => {
    if (writeError) {
      setError(`Transaction failed: ${writeError.message}`);
      setIsAdding(false);
      setSuccess('');
    }
  }, [writeError]);

  // Clear success message after 5 seconds
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => {
        setSuccess('');
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [success]);

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
                  <h1 className="text-sm lg:text-xl font-semibold">Add Token</h1>
                  <p className="text-xs text-gray-500 dark:text-gray-400 lg:hidden">Add new supported token</p>
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
          <div className="max-w-2xl mx-auto">
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
              <div className="p-6 space-y-6">
                {/* Header */}
                <div className="text-center">
                  <div className={`inline-flex items-center justify-center w-12 h-12 rounded-full mb-4 ${
                    isDarkMode ? 'bg-emerald-500/20' : 'bg-emerald-100'
                  }`}>
                    <Plus className={`w-6 h-6 ${isDarkMode ? 'text-emerald-400' : 'text-emerald-600'}`} />
                  </div>
                  <h2 className={`text-xl font-semibold mb-2 ${
                    isDarkMode ? 'text-white' : 'text-gray-900'
                  }`}>
                    Add New Token
                  </h2>
                  <p className={`text-sm ${
                    isDarkMode ? 'text-gray-400' : 'text-gray-600'
                  }`}>
                    Add a new ERC20 token to the supported tokens list
                  </p>
                </div>

                {/* Form Fields */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      <div className="flex items-center gap-2">
                        <Hash className="w-4 h-4" />
                        Token Address
                      </div>
                    </label>
                    <input
                      type="text"
                      value={tokenAddress}
                      onChange={(e) => setTokenAddress(e.target.value)}
                      placeholder="0x..."
                      className={`w-full px-3 py-2.5 border rounded-lg focus:border-emerald-500 focus:outline-none text-sm ${
                        isDarkMode 
                          ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                          : 'bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-500'
                      }`}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Enter the contract address of the ERC20 token
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      <div className="flex items-center gap-2">
                        <Tag className="w-4 h-4" />
                        Token Symbol
                      </div>
                    </label>
                    <input
                      type="text"
                      value={tokenSymbol}
                      onChange={(e) => setTokenSymbol(e.target.value.toUpperCase())}
                      placeholder="USDC"
                      className={`w-full px-3 py-2.5 border rounded-lg focus:border-emerald-500 focus:outline-none text-sm ${
                        isDarkMode 
                          ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                          : 'bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-500'
                      }`}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Enter the token symbol (1-10 uppercase letters/numbers)
                    </p>
                  </div>
                </div>

                {/* Submit Button */}
                <div className="pt-4">
                  <button 
                    onClick={addToken}
                    disabled={!isConnected || isAdding || isPending || isConfirming}
                    className={`w-full px-6 py-3 font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 ${
                      !isConnected || isAdding || isPending || isConfirming
                        ? 'bg-gray-400 cursor-not-allowed text-gray-200'
                        : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    }`}
                  >
                    {(isAdding || isPending || isConfirming) && <Loader2 size={20} className="animate-spin" />}
                    {isAdding ? 'Adding Token...' : 
                     isPending ? 'Confirming Transaction...' :
                     isConfirming ? 'Processing...' :
                     'Add Token'}
                  </button>
                  {!isConnected && (
                    <p className="text-sm text-gray-500 mt-2 text-center">Please connect your wallet to add a token</p>
                  )}
                </div>

                {/* Info Box */}
                <div className={`p-4 rounded-lg border ${
                  isDarkMode 
                    ? 'bg-blue-900/20 border-blue-800 text-blue-200' 
                    : 'bg-blue-50 border-blue-200 text-blue-800'
                }`}>
                  <div className="flex items-start gap-3">
                    <Coins className="w-5 h-5 mt-0.5 flex-shrink-0" />
                    <div className="text-sm">
                      <p className="font-medium mb-1">Important Notes:</p>
                      <ul className="space-y-1 text-xs">
                        <li>• Only contract owner can add new tokens</li>
                        <li>• Token must be a valid ERC20 contract</li>
                        <li>• Symbol will be automatically converted to uppercase</li>
                        <li>• Once added, tokens can be used for market creation</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
