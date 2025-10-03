'use client';

import { useState, useEffect } from 'react';
import { useReadContract, useAccount, useWriteContract } from 'wagmi';
import { parseEther } from 'viem';
import { ethers } from 'ethers';

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
  
  const [marketMetadata, setMarketMetadata] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationCount, setVerificationCount] = useState(0);

  const MARKET_MANAGER_ADDRESS = process.env.NEXT_PUBLIC_P2P_MARKET_MANAGER_ADDRESS as `0x${string}`;

  // Fetch market data
  const { data: market } = useReadContract({
    address: MARKET_MANAGER_ADDRESS,
    abi: MARKET_MANAGER_ABI,
    functionName: 'getMarket',
    args: [BigInt(marketId)],
  }) as { data: any };

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
      if (!market?.ipfsHash) return;
      
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

    fetchMetadata();
  }, [market]);

  // Update verification count
  useEffect(() => {
    if (verifications !== undefined) {
      setVerificationCount(Number(verifications));
    }
  }, [verifications]);

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

      // Refresh verification count
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading market data...</p>
        </div>
      </div>
    );
  }

  if (!market) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Market Not Found</h1>
          <p className="text-gray-600">Market #{marketId} does not exist.</p>
        </div>
      </div>
    );
  }

  const options = getMarketOptions();
  const isMarketEnded = market.state === 1; // Assuming 1 means ended
  const canVerify = isMarketEnded && isConnected;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center gap-4 mb-4">
            {getMarketImage() && (
              <img
                src={getMarketImage()!}
                alt=""
                className="w-16 h-16 rounded-lg object-cover"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            )}
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{getMarketTitle()}</h1>
              <p className="text-gray-600">Market ID: #{marketId}</p>
            </div>
          </div>

          <div className="flex items-center gap-4 text-sm text-gray-600">
            <span className={`px-2 py-1 rounded ${
              isMarketEnded ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
            }`}>
              {isMarketEnded ? 'Ended' : 'Active'}
            </span>
            <span>Verifications: {verificationCount}</span>
          </div>
        </div>

        {/* Verification Section */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-xl font-semibold mb-4">Verify Market Outcome</h2>
          
          {!isConnected ? (
            <div className="text-center py-8">
              <p className="text-gray-600 mb-4">Please connect your wallet to verify this market</p>
              <button className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700">
                Connect Wallet
              </button>
            </div>
          ) : !isMarketEnded ? (
            <div className="text-center py-8">
              <p className="text-gray-600">This market is still active and cannot be verified yet.</p>
            </div>
          ) : (
            <div>
              <p className="text-gray-600 mb-6">Select the winning option for this market:</p>
              
              <div className="space-y-3 mb-6">
                {options.map((option: string, index: number) => (
                  <label
                    key={index}
                    className={`flex items-center p-4 border rounded-lg cursor-pointer transition-colors ${
                      selectedOption === index + 1
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="option"
                      value={index + 1}
                      checked={selectedOption === index + 1}
                      onChange={() => setSelectedOption(index + 1)}
                      className="mr-3"
                    />
                    <span className="font-medium">{option}</span>
                  </label>
                ))}
              </div>

              <button
                onClick={handleVerify}
                disabled={!selectedOption || isVerifying}
                className={`w-full py-3 px-6 rounded-lg font-medium transition-colors ${
                  !selectedOption || isVerifying
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-green-600 text-white hover:bg-green-700'
                }`}
              >
                {isVerifying ? 'Verifying...' : 'Submit Verification'}
              </button>
            </div>
          )}
        </div>

        {/* Market Details */}
        <div className="bg-white rounded-lg shadow-sm p-6 mt-6">
          <h3 className="text-lg font-semibold mb-4">Market Details</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-600">End Time:</span>
              <p className="font-medium">
                {new Date(Number(market.endTime) * 1000).toLocaleString()}
              </p>
            </div>
            <div>
              <span className="text-gray-600">State:</span>
              <p className="font-medium">
                {market.state === 0 ? 'Active' : market.state === 1 ? 'Ended' : 'Resolved'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
