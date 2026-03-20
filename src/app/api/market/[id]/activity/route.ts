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

    const marketData = await contract.getMarket(marketId);
    const creator = marketData.creator.toLowerCase();
    const creatorDeposit = marketData.creatorDeposit as bigint;
    const creatorOutcome = Number(marketData.creatorOutcome);
    const startTime = Number(marketData.startTime);

    const filter = contract.filters.StakePlaced(marketId);
    const events = await contract.queryFilter(filter, 0, 'latest');

    const stakerMap = new Map<string, { option: number; amount: bigint }>();
    const chartData: Array<{ time: string; volume: number; cumulative: number }> = [];
    let cumulative = 0;

    for (const event of events) {
      if (!('args' in event) || !event.args) continue;

      const stakerAddress = (event.args as any).user.toLowerCase();
      const option = Number((event.args as any).option);
      const amount = (event.args as any).amount as bigint;

      const existing = stakerMap.get(stakerAddress);
      stakerMap.set(stakerAddress, {
        option,
        amount: existing ? existing.amount + amount : amount
      });

      const block = await provider.getBlock(event.blockNumber);
      if (!block) continue;

      const volume = Number(formatEther(amount));
      cumulative += volume;
      chartData.push({
        time: new Date(Number(block.timestamp) * 1000).toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        }),
        volume,
        cumulative
      });
    }

    if (creatorDeposit > BigInt(0)) {
      const existing = stakerMap.get(creator);
      stakerMap.set(creator, {
        option: creatorOutcome,
        amount: existing ? existing.amount + creatorDeposit : creatorDeposit
      });
    }

    const stakers = Array.from(stakerMap.entries()).map(([address, data]) => ({
      address,
      option: data.option,
      amount: data.amount.toString(),
      isCreator: address === creator
    }));

    stakers.sort((a, b) => {
      const amountA = BigInt(a.amount);
      const amountB = BigInt(b.amount);
      return amountA > amountB ? -1 : amountA < amountB ? 1 : 0;
    });

    if (chartData.length === 0) {
      chartData.push({
        time: new Date(startTime * 1000).toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        }),
        volume: 0,
        cumulative: 0
      });
    }

    return NextResponse.json({ stakers, chartData });
  } catch (error: any) {
    console.error('Error fetching market activity:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch market activity' },
      { status: 500 }
    );
  }
}
