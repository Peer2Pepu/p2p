require('dotenv').config();
const { ethers } = require('ethers');

// Hardcoded contract addresses
const ANALYTICS_ADDRESS = '0x37042Af74995Db02632EcE21ed7989fcE37C267c';
const MARKET_MANAGER_ADDRESS = '0x8080E490ECE90F0A112e0d22D9e43f3F157F611a';

const RPC_URL = 'https://rpc-pepu-v2-mainnet-0.t.conduit.xyz';
const USER_ADDRESS = '0x7e217fa1Ce282653115bA04686aE73dd689Ee588';

// Only necessary ABIs
const ANALYTICS_ABI = [
  {
    "inputs": [{"name": "user", "type": "address"}],
    "name": "getUserMarkets",
    "outputs": [{"name": "", "type": "uint256[]"}],
    "stateMutability": "view",
    "type": "function"
  }
];

const MARKET_MANAGER_ABI = [
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
          {"name": "isResolved", "type": "bool"}
        ],
        "name": "",
        "type": "tuple"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  }
];

async function debugStakes() {
  try {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    
    // Get contract instances
    const analyticsContract = new ethers.Contract(ANALYTICS_ADDRESS, ANALYTICS_ABI, provider);
    const marketManagerContract = new ethers.Contract(MARKET_MANAGER_ADDRESS, MARKET_MANAGER_ABI, provider);

    console.log(`🔍 Fetching markets for user: ${USER_ADDRESS}`);
    
    // Get user's market IDs
    const userMarketIds = await analyticsContract.getUserMarkets(USER_ADDRESS);
    console.log(`📋 Found ${userMarketIds.length} markets:`, userMarketIds.map(id => Number(id)));

    for (const marketId of userMarketIds) {
      console.log(`\n🎯 Market #${marketId}:`);
      
      try {
        // Get market data
        const market = await marketManagerContract.getMarket(marketId);
        
        // Get IPFS metadata
        let marketMetadata = null;
        try {
          const ipfsHash = market.ipfsHash;
          const gatewayUrl = `https://gateway.lighthouse.storage/ipfs/${ipfsHash}`;
          const response = await fetch(gatewayUrl);
          if (response.ok) {
            marketMetadata = await response.json();
          }
        } catch (error) {
          console.log(`   ❌ Error fetching IPFS metadata:`, error.message);
        }

        // Display market info
        console.log(`   📝 Title: ${marketMetadata?.title || `Market #${marketId}`}`);
        console.log(`   🏷️  Type: ${market.isMultiOption ? 'Multiple' : 'Yes/No'}`);
        console.log(`   📊 State: ${market.state} (${market.state === 0 ? 'Active' : market.state === 1 ? 'Ended' : market.state === 2 ? 'Resolved' : market.state === 3 ? 'Cancelled' : 'Unknown'})`);
        console.log(`   ✅ Is Resolved: ${market.isResolved}`);
        console.log(`   🏆 Winning Option: ${market.winningOption}`);
        console.log(`   🔗 Payment Token: ${market.paymentToken}`);
        
        // Check winning option text logic
        const winningOptionText = (!market.isResolved || !market.winningOption || market.winningOption === 0) 
          ? 'Not resolved' 
          : `Option ${market.winningOption}`;
        console.log(`   📋 Winning Option Text: ${winningOptionText}`);
        
        // Check what the UI should show
        console.log(`   🖥️  UI Should Show:`);
        console.log(`      - Status: ${market.state === 0 ? 'Active' : market.state === 1 ? 'Ended' : market.state === 2 ? 'Resolved' : market.state === 3 ? 'Cancelled' : 'Unknown'}`);
        console.log(`      - Winning Option: ${winningOptionText}`);
        
      } catch (error) {
        console.log(`   ❌ Error fetching market ${marketId}:`, error.message);
      }
    }
    
  } catch (error) {
    console.error('❌ Script error:', error);
  }
}

debugStakes();