const { ethers } = require("ethers");
require("dotenv").config();

const RPC_URL = process.env.RPC_URL || "https://rpc-pepu-v2-mainnet-0.t.conduit.xyz";
const MARKET_MANAGER_ADDRESS =
  process.env.NEXT_PUBLIC_P2P_MARKET_MANAGER_ADDRESS ||
  process.env.NEXT_PUBLIC_P2P_MARKETMANAGER_ADDRESS;

const ZERO = ethers.ZeroAddress.toLowerCase();

const ABI_V2 = [
  {
    inputs: [{ name: "marketId", type: "uint256" }],
    name: "getMarket",
    outputs: [
      {
        components: [
          { name: "creator", type: "address" },
          { name: "ipfsHash", type: "string" },
          { name: "isMultiOption", type: "bool" },
          { name: "maxOptions", type: "uint256" },
          { name: "paymentToken", type: "address" },
          { name: "minStake", type: "uint256" },
          { name: "creatorDeposit", type: "uint256" },
          { name: "creatorOutcome", type: "uint256" },
          { name: "startTime", type: "uint256" },
          { name: "stakeEndTime", type: "uint256" },
          { name: "endTime", type: "uint256" },
          { name: "resolutionEndTime", type: "uint256" },
          { name: "state", type: "uint8" },
          { name: "winningOption", type: "uint256" },
          { name: "isResolved", type: "bool" },
          { name: "resolvedTimestamp", type: "uint256" },
          { name: "resolvedPrice", type: "uint256" },
          { name: "marketType", type: "uint8" },
          { name: "priceFeed", type: "address" },
          { name: "priceThreshold", type: "uint256" },
          { name: "p2pAssertionId", type: "bytes32" },
          { name: "p2pAssertionMade", type: "bool" },
          { name: "p2pDisputedOptionId", type: "uint256" },
        ],
        name: "",
        type: "tuple",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
];

const ABI_LEGACY = [
  {
    inputs: [{ name: "marketId", type: "uint256" }],
    name: "getMarket",
    outputs: [
      {
        components: [
          { name: "creator", type: "address" },
          { name: "ipfsHash", type: "string" },
          { name: "isMultiOption", type: "bool" },
          { name: "maxOptions", type: "uint256" },
          { name: "paymentToken", type: "address" },
          { name: "minStake", type: "uint256" },
          { name: "creatorDeposit", type: "uint256" },
          { name: "creatorOutcome", type: "uint256" },
          { name: "startTime", type: "uint256" },
          { name: "stakeEndTime", type: "uint256" },
          { name: "endTime", type: "uint256" },
          { name: "resolutionEndTime", type: "uint256" },
          { name: "state", type: "uint8" },
          { name: "winningOption", type: "uint256" },
          { name: "isResolved", type: "bool" },
          { name: "marketType", type: "uint8" },
          { name: "priceFeed", type: "address" },
          { name: "priceThreshold", type: "uint256" },
          { name: "p2pAssertionId", type: "bytes32" },
          { name: "p2pAssertionMade", type: "bool" },
        ],
        name: "",
        type: "tuple",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
];

function scoreLayout(m) {
  let score = 0;
  const notes = [];

  const marketType = Number(m.marketType);
  if (marketType === 0 || marketType === 1) {
    score += 2;
  } else {
    notes.push(`marketType unusual: ${marketType}`);
  }

  const feed = (m.priceFeed || "").toLowerCase();
  const threshold = BigInt(m.priceThreshold || 0n);
  const isZeroFeed = feed === ZERO;

  if (marketType === 0) {
    if (!isZeroFeed) score += 4;
    else notes.push("priceFeed is zero for PRICE_FEED market");

    if (threshold > 0n) score += 2;
    else notes.push("priceThreshold is 0 for PRICE_FEED market");
  } else {
    if (isZeroFeed) score += 1;
  }

  const state = Number(m.state);
  if (state >= 0 && state <= 4) score += 1;
  else notes.push(`state unusual: ${state}`);

  return { score, notes };
}

async function decodeWith(label, abi, provider, marketId) {
  const c = new ethers.Contract(MARKET_MANAGER_ADDRESS, abi, provider);
  const m = await c.getMarket(BigInt(marketId));
  const rating = scoreLayout(m);

  return {
    label,
    marketType: Number(m.marketType),
    state: Number(m.state),
    isResolved: Boolean(m.isResolved),
    priceFeed: m.priceFeed,
    priceThreshold: m.priceThreshold?.toString?.() ?? String(m.priceThreshold),
    rating,
  };
}

async function main() {
  if (!MARKET_MANAGER_ADDRESS) {
    throw new Error("Missing NEXT_PUBLIC_P2P_MARKET_MANAGER_ADDRESS / NEXT_PUBLIC_P2P_MARKETMANAGER_ADDRESS");
  }
  const marketId = Number.parseInt(process.argv[2] || "2", 10);
  if (!Number.isFinite(marketId) || marketId < 0) {
    throw new Error(`Invalid market id: ${process.argv[2]}`);
  }

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const [v2, legacy] = await Promise.all([
    decodeWith("v2", ABI_V2, provider, marketId),
    decodeWith("legacy", ABI_LEGACY, provider, marketId),
  ]);

  console.log(`\nABI sanity check for market ${marketId}`);
  console.log(`RPC: ${RPC_URL}`);
  console.log(`MarketManager: ${MARKET_MANAGER_ADDRESS}\n`);

  for (const r of [v2, legacy]) {
    console.log(`[${r.label}]`);
    console.log(`- state: ${r.state}`);
    console.log(`- marketType: ${r.marketType}`);
    console.log(`- isResolved: ${r.isResolved}`);
    console.log(`- priceFeed: ${r.priceFeed}`);
    console.log(`- priceThreshold: ${r.priceThreshold}`);
    console.log(`- score: ${r.rating.score}`);
    if (r.rating.notes.length) {
      console.log(`- notes: ${r.rating.notes.join("; ")}`);
    }
    console.log("");
  }

  const winner = v2.rating.score >= legacy.rating.score ? v2 : legacy;
  console.log(`Likely layout: ${winner.label.toUpperCase()} (higher sanity score)\n`);
}

main().catch((err) => {
  console.error("Script failed:", err?.message || err);
  process.exit(1);
});

