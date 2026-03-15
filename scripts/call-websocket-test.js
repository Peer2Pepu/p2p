const { ethers } = require("ethers");
require("dotenv").config();

const CONTRACT_ADDRESS = process.env.WEBSOCKET_TEST_CONTRACT_ADDRESS;
const RPC_URL = 'https://rpc-pepu-v2-mainnet-0.t.conduit.xyz';

if (!CONTRACT_ADDRESS) {
  console.error("❌ Missing WEBSOCKET_TEST_CONTRACT_ADDRESS in .env");
  process.exit(1);
}

const CONTRACT_ABI = [
  {
    "inputs": [{"name": "message", "type": "string"}],
    "name": "emitTestEvent",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getCounter",
    "outputs": [{"name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  }
];

async function callTestEvent() {
  try {
    // Get private key from environment
    const privateKey = process.env.PRIVATE_KEY;
    if (!privateKey) {
      throw new Error("PRIVATE_KEY not found in .env file");
    }

    // Ensure private key has 0x prefix
    const privateKeyWithPrefix = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;

    // Create provider and wallet
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(privateKeyWithPrefix, provider);

    console.log("🔗 Connected to:", RPC_URL);
    console.log("👤 Wallet address:", wallet.address);

    // Get balance
    const balance = await provider.getBalance(wallet.address);
    console.log("💰 Balance:", ethers.formatEther(balance), "PEPU");

    if (balance === 0n) {
      console.error("❌ Insufficient balance. Please fund your wallet.");
      process.exit(1);
    }

    // Create contract instance
    const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, wallet);

    // Get current counter
    const currentCounter = await contract.getCounter();
    console.log("🔢 Current counter:", currentCounter.toString());

    // Call emitTestEvent
    const message = `Test event #${Number(currentCounter) + 1} at ${new Date().toISOString()}`;
    console.log(`\n📤 Calling emitTestEvent with message: "${message}"`);

    const tx = await contract.emitTestEvent(message);
    console.log("⏳ Transaction hash:", tx.hash);
    console.log("⏳ Waiting for confirmation...");

    const receipt = await tx.wait();
    console.log("✅ Transaction confirmed!");
    console.log("📊 Block number:", receipt.blockNumber);
    console.log("⛽ Gas used:", receipt.gasUsed.toString());

    // Get updated counter
    const newCounter = await contract.getCounter();
    console.log("🔢 New counter:", newCounter.toString());

    return receipt;
  } catch (error) {
    console.error("❌ Error calling test event:", error.message);
    throw error;
  }
}

// Call every 6 seconds
console.log("🔄 Starting periodic test event calls (every 6 seconds)...");
console.log("Press Ctrl+C to stop\n");

callTestEvent().then(() => {
  const interval = setInterval(async () => {
    try {
      await callTestEvent();
      console.log("\n⏰ Next call in 6 seconds...\n");
    } catch (error) {
      console.error("❌ Error in interval:", error.message);
    }
  }, 6000);

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n🛑 Stopping periodic calls...');
    clearInterval(interval);
    process.exit(0);
  });
}).catch((error) => {
  console.error("❌ Failed to start:", error.message);
  process.exit(1);
});
