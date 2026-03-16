import { NextRequest, NextResponse } from 'next/server';
import { ethers } from 'ethers';
import { formatEther } from 'viem';

const RPC_URL = 'https://rpc-pepu-v2-mainnet-0.t.conduit.xyz';
const MARKET_MANAGER_ADDRESS = process.env.NEXT_PUBLIC_P2P_MARKET_MANAGER_ADDRESS || process.env.NEXT_PUBLIC_P2P_MARKETMANAGER_ADDRESS;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const marketId = parseInt(id, 10);

    if (isNaN(marketId) || !MARKET_MANAGER_ADDRESS) {
      return NextResponse.json({ error: 'Invalid market ID or missing contract address' }, { status: 400 });
    }

    const provider = new ethers.JsonRpcProvider(RPC_URL);

    const contract = new ethers.Contract(MARKET_MANAGER_ADDRESS, [
      {
        "anonymous": false,
        "inputs": [
          {"indexed": true, "name": "marketId", "type": "uint256"},
          {"indexed": true, "name": "user", "type": "address"},
          {"indexed": false, "name": "option", "type": "uint256"},
          {"indexed": false, "name": "amount", "type": "uint256"}
        ],
        "name": "StakePlaced",
        "type": "event"
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
              {"name": "isResolved", "type": "bool"},
              {"name": "resolvedTimestamp", "type": "uint256"},
              {"name": "marketType", "type": "uint8"},
              {"name": "priceFeed", "type": "address"},
              {"name": "priceThreshold", "type": "uint256"},
              {"name": "resolvedPrice", "type": "uint256"}
            ],
            "name": "",
            "type": "tuple"
          }
        ],
        "stateMutability": "view",
        "type": "function"
      }
    ], provider);

    // Get market start time
    const marketData = await contract.getMarket(marketId);
    const startTime = Number(marketData.startTime);

    // Query StakePlaced events
    const filter = contract.filters.StakePlaced(marketId);
    const events = await contract.queryFilter(filter, 0, 'latest');

    const processedData: Array<{time: string, volume: number, cumulative: number}> = [];
    let cumulative = 0;

    for (const event of events) {
      if (!('args' in event) || !event.args) continue;
      const block = await provider.getBlock(event.blockNumber);
      if (!block) continue;
      const amount = Number(formatEther((event.args as any).amount as bigint));
      cumulative += amount;
      
      processedData.push({
        time: new Date(Number(block.timestamp) * 1000).toLocaleTimeString('en-US', { 
          hour: '2-digit', 
          minute: '2-digit',
          month: 'short',
          day: 'numeric'
        }),
        volume: amount,
        cumulative: cumulative
      });
    }

    if (processedData.length === 0) {
      processedData.push({
        time: new Date(startTime * 1000).toLocaleTimeString('en-US', { 
          hour: '2-digit', 
          minute: '2-digit',
          month: 'short',
          day: 'numeric'
        }),
        volume: 0,
        cumulative: 0
      });
    }

    return NextResponse.json({ chartData: processedData });
  } catch (error: any) {
    console.error('Error fetching chart data:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch chart data' },
      { status: 500 }
    );
  }
}
