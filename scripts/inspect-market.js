const { ethers } = require("ethers");
require("dotenv").config();

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const DEFAULT_RPC_URL = "https://rpc-pepu-v2-mainnet-0.t.conduit.xyz";
const RPC_URL = process.env.RPC_URL || DEFAULT_RPC_URL;
const MARKET_MANAGER_ADDRESS =
  process.env.NEXT_PUBLIC_P2P_MARKET_MANAGER_ADDRESS ||
  process.env.NEXT_PUBLIC_P2P_MARKETMANAGER_ADDRESS;

const MARKET_MANAGER_ABI_V2 = [
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
          { name: "p2pDisputedOptionId", type: "uint256" }
        ],
        name: "",
        type: "tuple"
      }
    ],
    stateMutability: "view",
    type: "function"
  }
];

const MARKET_MANAGER_ABI_LEGACY = [
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
          { name: "p2pAssertionMade", type: "bool" }
        ],
        name: "",
        type: "tuple"
      }
    ],
    stateMutability: "view",
    type: "function"
  }
];

const PRICE_FEED_ABI = [
  { inputs: [], name: "decimals", outputs: [{ name: "", type: "uint8" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "description", outputs: [{ name: "", type: "string" }], stateMutability: "view", type: "function" }
];

function parseMarketId(argvValue) {
  if (!argvValue) return 2;
  const parsed = Number(argvValue);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error("Invalid market ID. Pass a non-negative integer.");
  }
  return parsed;
}

function formatTimestamp(secondsLike) {
  const secs = Number(secondsLike);
  if (!Number.isFinite(secs) || secs <= 0) return "N/A";
  return new Date(secs * 1000).toISOString();
}

function marketTypeLabel(marketType) {
  return Number(marketType) === 0 ? "PRICE_FEED" : "UMA_MANUAL";
}

function stateLabel(state) {
  const labels = {
    0: "Active",
    1: "StakingEnded",
    2: "Resolved",
    3: "Disputed",
    4: "Cancelled"
  };
  return labels[Number(state)] || `Unknown(${state.toString()})`;
}

async function main() {
  if (!MARKET_MANAGER_ADDRESS) {
    console.error("Missing NEXT_PUBLIC_P2P_MARKET_MANAGER_ADDRESS (or NEXT_PUBLIC_P2P_MARKETMANAGER_ADDRESS) in environment.");
    process.exit(1);
  }

  const marketId = parseMarketId(process.argv[2]);
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const contractV2 = new ethers.Contract(MARKET_MANAGER_ADDRESS, MARKET_MANAGER_ABI_V2, provider);
  const contractLegacy = new ethers.Contract(MARKET_MANAGER_ADDRESS, MARKET_MANAGER_ABI_LEGACY, provider);

  console.log(`Inspecting market #${marketId}`);
  console.log(`RPC: ${RPC_URL}`);
  console.log(`MarketManager: ${MARKET_MANAGER_ADDRESS}`);
  console.log("--------------------------------------------------");

  let market = await contractV2.getMarket(marketId);
  let abiVersion = "v2";
  if (Number(market.marketType) > 1) {
    market = await contractLegacy.getMarket(marketId);
    abiVersion = "legacy";
  }
  const isPriceFeedMarket = market.priceFeed && market.priceFeed.toLowerCase() !== ZERO_ADDRESS;

  let priceFeedDecimals = null;
  let priceFeedDescription = null;
  if (isPriceFeedMarket) {
    const feed = new ethers.Contract(market.priceFeed, PRICE_FEED_ABI, provider);
    try {
      priceFeedDecimals = Number(await feed.decimals());
    } catch {}
    try {
      priceFeedDescription = await feed.description();
    } catch {}
  }

  const thresholdRaw = market.priceThreshold?.toString?.() ?? "0";
  const resolvedRaw = market.resolvedPrice?.toString?.() ?? "N/A";
  const thresholdFormatted =
    priceFeedDecimals !== null ? ethers.formatUnits(market.priceThreshold, priceFeedDecimals) : "N/A";
  const resolvedFormatted =
    priceFeedDecimals !== null && market.resolvedPrice !== undefined
      ? ethers.formatUnits(market.resolvedPrice, priceFeedDecimals)
      : "N/A";

  const output = {
    marketId,
    abiVersionUsed: abiVersion,
    creator: market.creator,
    ipfsHash: market.ipfsHash,
    isMultiOption: market.isMultiOption,
    maxOptions: market.maxOptions.toString(),
    paymentToken: market.paymentToken,
    minStakeRaw: market.minStake.toString(),
    creatorDepositRaw: market.creatorDeposit.toString(),
    creatorOutcome: market.creatorOutcome.toString(),
    startTime: formatTimestamp(market.startTime),
    stakeEndTime: formatTimestamp(market.stakeEndTime),
    endTime: formatTimestamp(market.endTime),
    resolutionEndTime: formatTimestamp(market.resolutionEndTime),
    state: `${market.state.toString()} (${stateLabel(market.state)})`,
    winningOption: market.winningOption.toString(),
    isResolved: market.isResolved,
    resolvedTimestamp: formatTimestamp(market.resolvedTimestamp),
    marketType: `${market.marketType.toString()} (${marketTypeLabel(market.marketType)})`,
    priceFeed: market.priceFeed,
    priceFeedDescription: priceFeedDescription || "N/A",
    priceFeedDecimals: priceFeedDecimals ?? "N/A",
    priceThresholdRaw: thresholdRaw,
    priceThresholdFormatted: thresholdFormatted,
    resolvedPriceRaw: resolvedRaw,
    resolvedPriceFormatted: resolvedFormatted
  };

  console.log(JSON.stringify(output, null, 2));
}

main().catch((err) => {
  console.error("Failed to inspect market:", err.message || err);
  process.exit(1);
});
