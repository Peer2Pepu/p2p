import { NextRequest, NextResponse } from 'next/server';
import { ethers } from 'ethers';

export async function GET(request: NextRequest) {
  try {
    // Connect to the network using public RPC
    const provider = new ethers.JsonRpcProvider('https://rpc-pepu-v2-mainnet-0.t.conduit.xyz');
    
    // Contract addresses from environment
    const MARKET_MANAGER_ADDRESS = process.env.NEXT_PUBLIC_P2P_MARKETMANAGER_ADDRESS;
    const ANALYTICS_ADDRESS = process.env.NEXT_PUBLIC_P2P_ANALYTICS_ADDRESS;

    if (!MARKET_MANAGER_ADDRESS || !ANALYTICS_ADDRESS) {
      return NextResponse.json(
        { success: false, error: 'Contract addresses not configured' },
        { status: 500 }
      );
    }

    // Contract ABIs
    const MARKET_MANAGER_ABI = [
      {
        "inputs": [],
        "name": "getNextMarketId",
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

    // Create contract instances
    const marketContract = new ethers.Contract(MARKET_MANAGER_ADDRESS, MARKET_MANAGER_ABI, provider);
    const analyticsContract = new ethers.Contract(ANALYTICS_ADDRESS, ANALYTICS_ABI, provider);

    // Get ended markets using analytics contract (state 1 = Ended)
    const endedMarketIds = await analyticsContract.getMarketsByState(1);
    
    if (endedMarketIds.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          endedMarkets: [],
          totalMarkets: 0,
          endedCount: 0
        }
      });
    }

    // Fetch detailed market info for each ended market
    const endedMarkets = [];
    
    for (const marketId of endedMarketIds) {
      try {
        const marketInfo = await marketContract.getMarketInfo(Number(marketId));
        const market = marketInfo.market;
        
        // Double-check that market is not resolved (additional safety check)
        if (!market.isResolved) {
          endedMarkets.push({
            marketId: Number(marketId),
            creator: market.creator,
            ipfsHash: market.ipfsHash,
            isMultiOption: market.isMultiOption,
            maxOptions: Number(market.maxOptions),
            paymentToken: market.paymentToken,
            minStake: market.minStake.toString(),
            creatorDeposit: market.creatorDeposit.toString(),
            creatorOutcome: Number(market.creatorOutcome),
            startTime: Number(market.startTime),
            endTime: Number(market.endTime),
            resolutionEndTime: Number(market.resolutionEndTime),
            state: Number(market.state),
            winningOption: Number(market.winningOption),
            isResolved: market.isResolved,
            totalPool: marketInfo.totalPool.toString(),
            supportPool: marketInfo.supportPool.toString(),
            bettorCount: Number(marketInfo.bettorCount),
            supporterCount: Number(marketInfo.supporterCount),
            tokenSymbol: marketInfo.tokenSymbol
          });
        }
      } catch (error) {
        console.warn(`Failed to fetch market ${marketId}:`, error);
        // Continue with next market
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        endedMarkets,
        totalMarkets: endedMarketIds.length,
        endedCount: endedMarkets.length
      }
    });

  } catch (error: any) {
    console.error('Fetch ended markets error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Failed to fetch ended markets' 
      },
      { status: 500 }
    );
  }
}