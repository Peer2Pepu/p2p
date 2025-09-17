import { NextRequest, NextResponse } from 'next/server';
import { ethers } from 'ethers';

export async function POST(request: NextRequest) {
  try {
    const { marketId, winningOption, autoResolve = false } = await request.json();

    if (!marketId) {
      return NextResponse.json(
        { success: false, error: 'Missing marketId parameter' },
        { status: 400 }
      );
    }

    // Connect to the network using public RPC
    const provider = new ethers.JsonRpcProvider('https://rpc-pepu-v2-mainnet-0.t.conduit.xyz');
    
    // Contract addresses from environment
    const MARKET_MANAGER_ADDRESS = process.env.NEXT_PUBLIC_P2P_MARKETMANAGER_ADDRESS;
    const VERIFICATION_ADDRESS = process.env.NEXT_PUBLIC_P2P_VERIFICATION_ADDRESS;

    if (!MARKET_MANAGER_ADDRESS || !VERIFICATION_ADDRESS) {
      return NextResponse.json(
        { success: false, error: 'Contract addresses not configured' },
        { status: 500 }
      );
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
        "inputs": [{"name": "marketId", "type": "uint256"}, {"name": "_winningOption", "type": "uint256"}],
        "name": "resolveMarket",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
      },
      {
        "inputs": [{"name": "marketId", "type": "uint256"}],
        "name": "autoResolve",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
      }
    ];

    const VERIFICATION_ABI = [
      {
        "inputs": [{"name": "marketId", "type": "uint256"}],
        "name": "isResolved",
        "outputs": [{"name": "", "type": "bool"}, {"name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function"
      },
      {
        "inputs": [{"name": "marketId", "type": "uint256"}, {"name": "option", "type": "uint256"}],
        "name": "getVoteCount",
        "outputs": [{"name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function"
      }
    ];

    // Create contract instances
    const marketContract = new ethers.Contract(MARKET_MANAGER_ADDRESS, MARKET_MANAGER_ABI, provider);
    const verificationContract = new ethers.Contract(VERIFICATION_ADDRESS, VERIFICATION_ABI, provider);

    // Get market data
    const market = await marketContract.getMarket(marketId);
    
    // Check if market is in ended state
    if (market.state !== 1) { // MarketState.Ended
      return NextResponse.json(
        { 
          success: false, 
          error: 'Market is not in ended state' 
        },
        { status: 400 }
      );
    }

    // Check if already resolved
    if (market.isResolved) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Market is already resolved' 
        },
        { status: 400 }
      );
    }

    // Check if resolution period has passed
    if (Date.now() / 1000 >= Number(market.resolutionEndTime)) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Resolution period has expired' 
        },
        { status: 400 }
      );
    }

    let result;
    let resolutionData;

    if (autoResolve) {
      // Check if verifier quorum is reached
      const [isResolved, votedOption] = await verificationContract.isResolved(marketId);
      
      if (!isResolved) {
        return NextResponse.json(
          { 
            success: false, 
            error: 'No resolution reached by verifiers yet' 
          },
          { status: 400 }
        );
      }

      // Auto-resolve with the voted option
      result = {
        type: 'autoResolve',
        marketId: Number(marketId),
        winningOption: Number(votedOption),
        message: `Market auto-resolved with option ${votedOption}`
      };

      resolutionData = {
        marketId: Number(marketId),
        winningOption: Number(votedOption),
        resolutionType: 'auto',
        verifierVotes: Number(votedOption)
      };

    } else {
      // Manual resolution
      if (!winningOption || winningOption < 1 || winningOption > Number(market.maxOptions)) {
        return NextResponse.json(
          { 
            success: false, 
            error: `Invalid winning option. Must be between 1 and ${market.maxOptions}` 
          },
          { status: 400 }
        );
      }

      // Check if verifiers have voted for this option
      const [isResolved, votedOption] = await verificationContract.isResolved(marketId);
      
      if (!isResolved || Number(votedOption) !== winningOption) {
        return NextResponse.json(
          { 
            success: false, 
            error: `Insufficient verifier votes for option ${winningOption}` 
          },
          { status: 400 }
        );
      }

      result = {
        type: 'manualResolve',
        marketId: Number(marketId),
        winningOption: Number(winningOption),
        message: `Market resolved with option ${winningOption}`
      };

      resolutionData = {
        marketId: Number(marketId),
        winningOption: Number(winningOption),
        resolutionType: 'manual',
        verifierVotes: Number(votedOption)
      };
    }

    // Get vote counts for all options
    const voteCounts: {[key: number]: number} = {};
    for (let i = 1; i <= Number(market.maxOptions); i++) {
      try {
        const voteCount = await verificationContract.getVoteCount(marketId, i);
        voteCounts[i] = Number(voteCount);
      } catch (error) {
        voteCounts[i] = 0;
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        ...result,
        marketData: {
          id: Number(marketId),
          creator: market.creator,
          isMultiOption: market.isMultiOption,
          maxOptions: Number(market.maxOptions),
          state: Number(market.state),
          isResolved: market.isResolved,
          endTime: Number(market.endTime),
          resolutionEndTime: Number(market.resolutionEndTime)
        },
        resolutionData,
        voteCounts,
        timestamp: Date.now()
      }
    });

  } catch (error: any) {
    console.error('Resolve market error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Failed to resolve market' 
      },
      { status: 500 }
    );
  }
}