const { ethers } = require("ethers");
require("dotenv").config();

const RPC_URL = process.env.RPC_URL || "https://rpc-pepu-v2-mainnet-0.t.conduit.xyz";
const MARKET_MANAGER_ADDRESS =
  process.env.NEXT_PUBLIC_P2P_MARKET_MANAGER_ADDRESS ||
  process.env.NEXT_PUBLIC_P2P_MARKETMANAGER_ADDRESS;

const ABI = [
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

const FIELD_NAMES = [
  "creator",
  "ipfsHash",
  "isMultiOption",
  "maxOptions",
  "paymentToken",
  "minStake",
  "creatorDeposit",
  "creatorOutcome",
  "startTime",
  "stakeEndTime",
  "endTime",
  "resolutionEndTime",
  "state",
  "winningOption",
  "isResolved",
  "resolvedTimestamp",
  "resolvedPrice",
  "marketType",
  "priceFeed",
  "priceThreshold",
  "p2pAssertionId",
  "p2pAssertionMade",
  "p2pDisputedOptionId",
];

function asPrintable(v) {
  if (typeof v === "bigint") return v.toString();
  if (Array.isArray(v)) return v.map(asPrintable);
  return v;
}

async function main() {
  if (!MARKET_MANAGER_ADDRESS) {
    throw new Error("Missing NEXT_PUBLIC_P2P_MARKET_MANAGER_ADDRESS / NEXT_PUBLIC_P2P_MARKETMANAGER_ADDRESS");
  }

  const marketIdArg = process.argv[2] || "2";
  const marketId = Number.parseInt(marketIdArg, 10);
  if (!Number.isFinite(marketId) || marketId < 0) {
    throw new Error(`Invalid market id: ${marketIdArg}`);
  }

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const contract = new ethers.Contract(MARKET_MANAGER_ADDRESS, ABI, provider);

  const market = await contract.getMarket(BigInt(marketId));

  console.log(`\n=== Market ${marketId} Struct Inspection ===`);
  console.log(`RPC: ${RPC_URL}`);
  console.log(`MarketManager: ${MARKET_MANAGER_ADDRESS}\n`);

  console.log("Named fields:");
  for (const key of FIELD_NAMES) {
    const value = market?.[key];
    console.log(`- ${key}:`, asPrintable(value));
  }

  console.log("\nRaw tuple by index:");
  for (let i = 0; i < FIELD_NAMES.length; i++) {
    console.log(`[${i}] ${FIELD_NAMES[i]}:`, asPrintable(market?.[i]));
  }

  console.log("\nDerived checks:");
  const isZeroAddress = (addr) =>
    typeof addr === "string" && addr.toLowerCase() === ethers.ZeroAddress.toLowerCase();
  console.log("- hasPriceFeed:", !isZeroAddress(market?.priceFeed));
  console.log("- isPriceFeedType (marketType===0):", Number(market?.marketType) === 0);
  console.log("- isResolved:", Boolean(market?.isResolved));
  console.log("- state:", Number(market?.state));
}

main().catch((err) => {
  console.error("\nScript failed:", err?.message || err);
  process.exit(1);
});

