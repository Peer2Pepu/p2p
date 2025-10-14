const { ethers } = require('ethers');

// Contract addresses
const ANALYTICS_ADDRESS = '0x...'; // You'll need to provide this
const MARKET_MANAGER_ADDRESS = '0x...'; // You'll need to provide this
const TREASURY_ADDRESS = '0x...'; // You'll need to provide this
const ADMIN_ADDRESS = '0x...'; // You'll need to provide this

const RPC_URL = 'https://rpc-pepu-v2-mainnet-0.t.conduit.xyz';
const USER_ADDRESS = '0x7e217fa1Ce282653115bA04686aE73dd689Ee588';

// Contract ABIs
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
  },
  {
    "inputs": [{"name": "marketId", "type": "uint256"}, {"name": "user", "type": "address"}],
    "name": "userStakeOptions",
    "outputs": [{"name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  }
];

const TREASURY_ABI = [
  {
    "inputs": [{"name": "marketId", "type": "uint256"}, {"name": "user", "type": "address"}, {"name": "token", "type": "address"}],
    "name": "getUserStake",
    "outputs": [{"name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  }
];

const ADMIN_ABI = [
  {
    "inputs": [{"name": "token", "type": "address"}],
    "name": "tokenSymbols",
    "outputs": [{"name": "", "type": "string"}],
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
    const treasuryContract = new ethers.Contract(TREASURY_ADDRESS, TREASURY_ABI, provider);
    const adminContract = new ethers.Contract(ADMIN_ADDRESS, ADMIN_ABI, provider);

    console.log(`🔍 Fetching markets for user: ${USER_ADDRESS}`);
    
    // Get user's market IDs
    const userMarketIds = await analyticsContract.getUserMarkets(USER_ADDRESS);
    console.log(`📋 Found ${userMarketIds.length} markets:`, userMarketIds.map(id => Number(id)));

    for (const marketId of userMarketIds) {
      console.log(`\n🎯 Market #${marketId}:`);
      
      try {
        // Get market data
        const market = await marketManagerContract.getMarket(marketId);
        
        // Get user's stake amount
        const userStakeAmount = await treasuryContract.getUserStake(marketId, USER_ADDRESS, market.paymentToken);
        
        // Skip if user didn't stake
        if (userStakeAmount === 0n) {
          console.log(`   ⏭️  User didn't stake in this market`);
          continue;
        }
        
        // Get user's stake option
        const userStakeOption = await marketManagerContract.userStakeOptions(marketId, USER_ADDRESS);
        
        // Get token symbol
        const tokenSymbol = await adminContract.tokenSymbols(market.paymentToken);
        
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
        console.log(`   💰 Stake Amount: ${ethers.formatEther(userStakeAmount)} ${tokenSymbol}`);
        console.log(`   🎯 User Option: ${userStakeOption}`);
        console.log(`   🔗 Payment Token: ${market.paymentToken}`);
        
        // Check winning option text logic
        const winningOptionText = (!market.isResolved || !market.winningOption || market.winningOption === 0) 
          ? 'Not resolved' 
          : `Option ${market.winningOption}`;
        console.log(`   📋 Winning Option Text: ${winningOptionText}`);
        
      } catch (error) {
        console.log(`   ❌ Error fetching market ${marketId}:`, error.message);
      }
    }
    
  } catch (error) {
    console.error('❌ Script error:', error);
  }
}

debugStakes();