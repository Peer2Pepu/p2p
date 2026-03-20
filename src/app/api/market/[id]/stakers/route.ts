import { NextRequest, NextResponse } from 'next/server';
import { ethers } from 'ethers';
import { createClient } from '@supabase/supabase-js';

const RPC_URL = 'https://rpc-pepu-v2-mainnet-0.t.conduit.xyz';
const MARKET_MANAGER_ADDRESS =
  process.env.NEXT_PUBLIC_P2P_MARKET_MANAGER_ADDRESS || process.env.NEXT_PUBLIC_P2P_MARKETMANAGER_ADDRESS;
const TREASURY_ADDRESS = process.env.NEXT_PUBLIC_P2P_TREASURY_ADDRESS;

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

const GET_MARKET_ABI_V2 = {
  inputs: [{ name: 'marketId', type: 'uint256' }],
  name: 'getMarket',
  outputs: [
    {
      components: [
        { name: 'creator', type: 'address' },
        { name: 'ipfsHash', type: 'string' },
        { name: 'isMultiOption', type: 'bool' },
        { name: 'maxOptions', type: 'uint256' },
        { name: 'paymentToken', type: 'address' },
        { name: 'minStake', type: 'uint256' },
        { name: 'creatorDeposit', type: 'uint256' },
        { name: 'creatorOutcome', type: 'uint256' },
        { name: 'startTime', type: 'uint256' },
        { name: 'stakeEndTime', type: 'uint256' },
        { name: 'endTime', type: 'uint256' },
        { name: 'resolutionEndTime', type: 'uint256' },
        { name: 'state', type: 'uint8' },
        { name: 'winningOption', type: 'uint256' },
        { name: 'isResolved', type: 'bool' },
        { name: 'resolvedTimestamp', type: 'uint256' },
        { name: 'marketType', type: 'uint8' },
        { name: 'priceFeed', type: 'address' },
        { name: 'priceThreshold', type: 'uint256' },
        { name: 'resolvedPrice', type: 'uint256' }
      ],
      name: '',
      type: 'tuple'
    }
  ],
  stateMutability: 'view',
  type: 'function'
} as const;

const GET_MARKET_ABI_LEGACY = {
  inputs: [{ name: 'marketId', type: 'uint256' }],
  name: 'getMarket',
  outputs: [
    {
      components: [
        { name: 'creator', type: 'address' },
        { name: 'ipfsHash', type: 'string' },
        { name: 'isMultiOption', type: 'bool' },
        { name: 'maxOptions', type: 'uint256' },
        { name: 'paymentToken', type: 'address' },
        { name: 'minStake', type: 'uint256' },
        { name: 'creatorDeposit', type: 'uint256' },
        { name: 'creatorOutcome', type: 'uint256' },
        { name: 'startTime', type: 'uint256' },
        { name: 'stakeEndTime', type: 'uint256' },
        { name: 'endTime', type: 'uint256' },
        { name: 'resolutionEndTime', type: 'uint256' },
        { name: 'state', type: 'uint8' },
        { name: 'winningOption', type: 'uint256' },
        { name: 'isResolved', type: 'bool' },
        { name: 'marketType', type: 'uint8' },
        { name: 'priceFeed', type: 'address' },
        { name: 'priceThreshold', type: 'uint256' },
        { name: 'p2pAssertionId', type: 'bytes32' },
        { name: 'p2pAssertionMade', type: 'bool' }
      ],
      name: '',
      type: 'tuple'
    }
  ],
  stateMutability: 'view',
  type: 'function'
} as const;

const USER_STAKE_OPTIONS_ABI = {
  inputs: [
    { name: 'marketId', type: 'uint256' },
    { name: 'user', type: 'address' }
  ],
  name: 'userStakeOptions',
  outputs: [{ name: '', type: 'uint256' }],
  stateMutability: 'view',
  type: 'function'
} as const;

const TREASURY_ABI = [
  {
    inputs: [
      { name: 'marketId', type: 'uint256' },
      { name: 'user', type: 'address' },
      { name: 'token', type: 'address' }
    ],
    name: 'getUserStake',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  }
] as const;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const marketId = parseInt(id, 10);

    const supabaseProjectId = process.env.NEXT_PUBLIC_SUPABASE_PROJECT_ID;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (
      isNaN(marketId) ||
      !MARKET_MANAGER_ADDRESS ||
      !TREASURY_ADDRESS ||
      !supabaseProjectId ||
      !supabaseAnonKey
    ) {
      return NextResponse.json(
        { error: 'Invalid market ID or missing env/config' },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(request.url);
    const limitParam = searchParams.get('limit');
    const limit = Math.min(
      Math.max(Number(limitParam || process.env.NEXT_PUBLIC_MARKET_STAKERS_LOOKUP_LIMIT || 2000), 1),
      2000
    );

    const supabase = createClient(
      `https://${supabaseProjectId}.supabase.co`,
      supabaseAnonKey
    );

    const { data: userRows, error } = await supabase
      .from('users')
      .select('address')
      .limit(limit);

    if (error) {
      console.error('Supabase users lookup error:', error);
      return NextResponse.json({ stakers: [], error: error.message || 'Failed to load users' }, { status: 200 });
    }

    const addresses: string[] = (userRows || [])
      .map((u: any) => u?.address)
      .filter((a: any) => typeof a === 'string' && a.length > 0)
      .map((a: string) => a.toLowerCase());

    if (addresses.length === 0) {
      return NextResponse.json({ stakers: [] });
    }

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const marketContractV2 = new ethers.Contract(
      MARKET_MANAGER_ADDRESS,
      [GET_MARKET_ABI_V2, USER_STAKE_OPTIONS_ABI] as any,
      provider
    );
    const marketContractLegacy = new ethers.Contract(
      MARKET_MANAGER_ADDRESS,
      [GET_MARKET_ABI_LEGACY, USER_STAKE_OPTIONS_ABI] as any,
      provider
    );
    const treasuryContract = new ethers.Contract(TREASURY_ADDRESS, TREASURY_ABI as any, provider);

    // Prefer field/index access to avoid ethers tuple spreading issues.
    let marketData: any;
    let usedV2 = true;
    try {
      marketData = await marketContractV2.getMarket(marketId);
    } catch {
      usedV2 = false;
      marketData = await marketContractLegacy.getMarket(marketId);
    }
    const creatorRaw = marketData?.creator ?? marketData?.[0] ?? ZERO_ADDRESS;
    const creator = String(creatorRaw).toLowerCase();
    const paymentToken = String(marketData?.paymentToken ?? marketData?.[4] ?? ZERO_ADDRESS);
    const creatorDeposit = BigInt(marketData?.creatorDeposit ?? marketData?.[6] ?? BigInt(0));
    const creatorOutcome = Number(marketData?.creatorOutcome ?? marketData?.[7] ?? BigInt(0));

    const stakers: Array<{ address: string; option: number; amount: string; isCreator: boolean }> = [];

    // Concurrency control: many parallel calls can cause endpoint failures.
    const concurrency = 8;
    for (let i = 0; i < addresses.length; i += concurrency) {
      const batch = addresses.slice(i, i + concurrency);

      const batchResults = await Promise.allSettled(
        batch.map(async (userAddress) => {
          try {
            // userStakeOptions lives on both ABI variants.
            const optionRaw: bigint = await (usedV2 ? marketContractV2 : marketContractLegacy).userStakeOptions(
              marketId,
              userAddress
            );
            const option = Number(optionRaw ?? BigInt(0));
            if (!option) return null;

            const amountRaw: bigint = await treasuryContract.getUserStake(
              marketId,
              userAddress,
              paymentToken
            );
            const amount = BigInt(amountRaw ?? BigInt(0));
            if (!amount) return null;

            return {
              address: userAddress,
              option,
              amount: amount.toString(),
              isCreator: userAddress === creator
            };
          } catch (e) {
            console.error('Staker lookup failed for', userAddress, e);
            return null;
          }
        })
      );

      for (const r of batchResults) {
        if (r.status !== 'fulfilled') continue;
        if (r.value) stakers.push(r.value);
      }
    }

    // Best-effort: include creator deposit if the creator didn't appear.
    const hasCreator = stakers.some((s) => s.address === creator);
    if (!hasCreator && creatorDeposit > BigInt(0) && creatorOutcome > 0) {
      stakers.push({
        address: creator,
        option: creatorOutcome,
        amount: creatorDeposit.toString(),
        isCreator: true
      });
    }

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
