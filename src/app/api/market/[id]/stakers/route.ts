import { NextRequest, NextResponse } from 'next/server';
import { ethers } from 'ethers';

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
              {"name": "creatorDeposit", "type": "uint256"},
              {"name": "creatorOutcome", "type": "uint256"}
            ],
            "name": "",
            "type": "tuple"
          }
        ],
        "stateMutability": "view",
        "type": "function"
      }
    ], provider);

    // Get market data to check for creator deposit
    const marketData = await contract.getMarket(marketId);
    const creator = marketData.creator.toLowerCase();
    const creatorDeposit = marketData.creatorDeposit;
    const creatorOutcome = Number(marketData.creatorOutcome);

    // Query StakePlaced events
    const filter = contract.filters.StakePlaced(marketId);
    const events = await contract.queryFilter(filter, 0, 'latest');

    // Get unique stakers with their latest option and total amount
    const stakerMap = new Map<string, { option: number; amount: bigint }>();
    
    for (const event of events) {
      if (!('args' in event) || !event.args) continue;
      const stakerAddress = (event.args as any).user.toLowerCase();
      const option = Number((event.args as any).option);
      const amount = (event.args as any).amount as bigint;
      
      if (stakerMap.has(stakerAddress)) {
        const existing = stakerMap.get(stakerAddress)!;
        stakerMap.set(stakerAddress, {
          option: option,
          amount: existing.amount + amount
        });
      } else {
        stakerMap.set(stakerAddress, { option, amount });
      }
    }

    // Add creator's stake if they have a creatorDeposit
    if (creatorDeposit > 0) {
      if (stakerMap.has(creator)) {
        const existing = stakerMap.get(creator)!;
        stakerMap.set(creator, {
          option: creatorOutcome,
          amount: existing.amount + creatorDeposit
        });
      } else {
        stakerMap.set(creator, {
          option: creatorOutcome,
          amount: creatorDeposit
        });
      }
    }

    // Convert to array format
    const stakers = Array.from(stakerMap.entries()).map(([address, data]) => ({
      address,
      option: data.option,
      amount: data.amount.toString(),
      isCreator: address === creator
    }));

    // Sort by amount (descending)
    stakers.sort((a, b) => {
      const amountA = BigInt(a.amount);
      const amountB = BigInt(b.amount);
      return amountA > amountB ? -1 : amountA < amountB ? 1 : 0;
    });

    return NextResponse.json({ stakers });
  } catch (error: any) {
    console.error('Error fetching stakers:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch stakers' },
      { status: 500 }
    );
  }
}
