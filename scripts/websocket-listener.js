const { ethers } = require("ethers");
require("dotenv").config();

const CONTRACT_ADDRESS = process.env.WEBSOCKET_TEST_CONTRACT_ADDRESS;
const RPC_URL = 'https://rpc-pepu-v2-mainnet-0.t.conduit.xyz';
// Try different WebSocket URL patterns - convert HTTPS to WSS
const WS_RPC_URLS = [
  RPC_URL.replace('https://', 'wss://'),
  RPC_URL.replace('http://', 'ws://'),
  `wss://rpc-pepu-v2-mainnet-0.t.conduit.xyz`,
  `ws://rpc-pepu-v2-mainnet-0.t.conduit.xyz`,
];

if (!CONTRACT_ADDRESS) {
  console.error("❌ Missing WEBSOCKET_TEST_CONTRACT_ADDRESS in .env");
  process.exit(1);
}

const CONTRACT_ABI = [
  {
    "anonymous": false,
    "inputs": [
      {"indexed": true, "name": "counter", "type": "uint256"},
      {"name": "message", "type": "string"},
      {"name": "timestamp", "type": "uint256"},
      {"indexed": true, "name": "caller", "type": "address"}
    ],
    "name": "TestEvent",
    "type": "event"
  }
];

async function listenToEvents() {
  try {
    console.log("🔌 Attempting WebSocket connection...");
    console.log("📡 RPC URL:", RPC_URL);
    console.log("📋 Contract:", CONTRACT_ADDRESS);
    console.log("📡 Will try WebSocket URLs:", WS_RPC_URLS.join(", "));
    console.log("");

    // Try WebSocket provider first
    let provider;
    let usingWebSocket = false;
    let wsUrl = null;

    // Try each WebSocket URL
    for (const wsUrlAttempt of WS_RPC_URLS) {
      try {
        console.log(`🔌 Trying WebSocket: ${wsUrlAttempt}...`);
        provider = new ethers.WebSocketProvider(wsUrlAttempt);
        
        // Test connection by getting block number
        await provider.getBlockNumber();
        
        usingWebSocket = true;
        wsUrl = wsUrlAttempt;
        console.log(`✅ WebSocket connection established!`);
        console.log(`   Using: ${wsUrl}`);
        break;
      } catch (wsError) {
        console.log(`   ❌ Failed: ${wsError.message}`);
        continue;
      }
    }

    // Fallback to HTTP polling if WebSocket failed
    if (!usingWebSocket) {
      console.warn("\n⚠️  All WebSocket attempts failed, falling back to HTTP polling...");
      provider = new ethers.JsonRpcProvider(RPC_URL);
      console.log("✅ Using HTTP polling instead");
      console.log("   Note: HTTP polling checks for events every ~4 seconds");
    }

    const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);

    console.log("\n👂 Listening for TestEvent...");
    console.log("⏰ Started at:", new Date().toISOString());
    console.log("─".repeat(60));

    let eventCount = 0;

    // Listen for events
    contract.on("TestEvent", (counter, message, timestamp, caller, event) => {
      eventCount++;
      const eventTime = new Date(Number(timestamp) * 1000).toISOString();
      const receivedTime = new Date().toISOString();
      
      console.log(`\n🎯 Event #${eventCount} received:`);
      console.log(`   Counter: ${counter.toString()}`);
      console.log(`   Message: ${message}`);
      console.log(`   Timestamp: ${eventTime}`);
      console.log(`   Caller: ${caller}`);
      console.log(`   Received at: ${receivedTime}`);
      console.log(`   Block: ${event.log.blockNumber}`);
      console.log(`   Tx Hash: ${event.log.transactionHash}`);
      console.log(`   Method: ${usingWebSocket ? 'WebSocket ✅' : 'HTTP Polling ⚠️'}`);
      console.log("─".repeat(60));
    });

    // Also try to get past events to verify connection
    console.log("\n📚 Fetching recent past events...");
    try {
      const currentBlock = await provider.getBlockNumber();
      const fromBlock = Math.max(0, currentBlock - 100); // Last 100 blocks
      
      const pastEvents = await contract.queryFilter("TestEvent", fromBlock, currentBlock);
      console.log(`✅ Found ${pastEvents.length} past events in last 100 blocks`);
      
      if (pastEvents.length > 0) {
        console.log("\n📋 Recent events:");
        pastEvents.slice(-5).forEach((event, idx) => {
          const decoded = event.args;
          console.log(`   ${idx + 1}. Counter: ${decoded[0].toString()}, Message: ${decoded[1]}`);
        });
      }
    } catch (error) {
      console.warn("⚠️  Could not fetch past events:", error.message);
    }

    console.log("\n✅ Listener active! Waiting for new events...");
    console.log("   Press Ctrl+C to stop\n");

    // Handle connection errors
    if (usingWebSocket) {
      provider.websocket.on('error', (error) => {
        console.error("❌ WebSocket error:", error.message);
      });

      provider.websocket.on('close', () => {
        console.error("❌ WebSocket connection closed. Attempting to reconnect...");
        setTimeout(() => {
          listenToEvents();
        }, 5000);
      });
    }

    // Handle graceful shutdown
    process.on('SIGINT', () => {
      console.log('\n🛑 Stopping listener...');
      contract.removeAllListeners();
      if (usingWebSocket && provider.websocket) {
        provider.websocket.close();
      }
      process.exit(0);
    });

  } catch (error) {
    console.error("❌ Error setting up listener:", error.message);
    console.error("   Full error:", error);
    process.exit(1);
  }
}

listenToEvents();
