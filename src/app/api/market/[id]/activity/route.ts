import { NextRequest, NextResponse } from 'next/server';
import { ethers } from 'ethers';
import { formatEther } from 'viem';

const RPC_URL = 'https://rpc-pepu-v2-mainnet-0.t.conduit.xyz';
const MARKET_MANAGER_ADDRESS = process.env.NEXT_PUBLIC_P2P_MARKET_MANAGER_ADDRESS || process.env.NEXT_PUBLIC_P2P_MARKETMANAGER_ADDRESS;
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

const MARKET_ABI_V2 = [
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
];

const MARKET_ABI_LEGACY = [
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
          {"name": "marketType", "type": "uint8"},
          {"name": "priceFeed", "type": "address"},
          {"name": "priceThreshold", "type": "uint256"},
          {"name": "p2pAssertionId", "type": "bytes32"},
          {"name": "p2pAssertionMade", "type": "bool"}
        ],
        "name": "",
        "type": "tuple"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  }
];

const STAKE_EVENT_ABI = {
  "anonymous": false,
  "inputs": [
    {"indexed": true, "name": "marketId", "type": "uint256"},
    {"indexed": true, "name": "user", "type": "address"},
    {"indexed": false, "name": "option", "type": "uint256"},
    {"indexed": false, "name": "amount", "type": "uint256"}
  ],
  "name": "StakePlaced",
  "type": "event"
};

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
    const contractV2 = new ethers.Contract(MARKET_MANAGER_ADDRESS, [...MARKET_ABI_V2, STAKE_EVENT_ABI], provider);
    const contractLegacy = new ethers.Contract(MARKET_MANAGER_ADDRESS, [...MARKET_ABI_LEGACY, STAKE_EVENT_ABI], provider);

    let marketData: any;
    let hasV2ResolvedFields = true;
    try {
      marketData = await contractV2.getMarket(marketId);
      if (Number(marketData?.marketType) > 1) {
        marketData = await contractLegacy.getMarket(marketId);
        hasV2ResolvedFields = false;
      }
    } catch {
      marketData = await contractLegacy.getMarket(marketId);
      hasV2ResolvedFields = false;
    }

    const creatorRaw = (marketData?.creator ?? marketData?.[0] ?? ZERO_ADDRESS) as string;
    const creator = creatorRaw.toLowerCase();
    const creatorDeposit = (marketData?.creatorDeposit ?? marketData?.[6] ?? BigInt(0)) as bigint;
    const creatorOutcome = Number(marketData?.creatorOutcome ?? marketData?.[7] ?? BigInt(0));
    const startTime = Number(marketData?.startTime ?? marketData?.[8] ?? BigInt(0));

    const contractForEvents = hasV2ResolvedFields ? contractV2 : contractLegacy;
    const filter = contractForEvents.filters.StakePlaced(marketId);
    const events = await contractForEvents.queryFilter(filter, 0, 'latest');

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

      const volume = Number(formatEther(amount));
      cumulative += volume;

      let labelTime = new Date(startTime * 1000).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
      try {
        const block = await provider.getBlock(event.blockNumber);
        if (block) {
          labelTime = new Date(Number(block.timestamp) * 1000).toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          });
        }
      } catch {
        // Keep fallback labelTime when block lookup fails.
      }

      chartData.push({
        time: labelTime,
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
