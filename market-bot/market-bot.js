const { ethers } = require('ethers');
const TelegramBot = require('node-telegram-bot-api');
require('dotenv').config();

// Configuration
const RPC_URL = 'https://rpc-pepu-v2-mainnet-0.t.conduit.xyz';
const MARKET_MANAGER_ADDRESS = process.env.NEXT_PUBLIC_P2P_MARKET_MANAGER_ADDRESS;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_GROUP_ID = process.env.TELEGRAM_GROUP_ID;
const PRIVATE_KEY = process.env.PRIVATE_KEY;

// Contract ABI
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
    "inputs": [{"name": "marketId", "type": "uint256"}],
    "name": "endMarket",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getActiveMarkets",
    "outputs": [{"name": "", "type": "uint256[]"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "anonymous": false,
    "inputs": [
      {"indexed": true, "name": "marketId", "type": "uint256"},
      {"indexed": true, "name": "winner", "type": "uint256"},
      {"indexed": false, "name": "totalPayout", "type": "uint256"}
    ],
    "name": "MarketResolved",
    "type": "event"
  }
];

class MarketBot {
  constructor() {
    this.provider = new ethers.JsonRpcProvider(RPC_URL, undefined, {
      staticNetwork: true,
      polling: false
    });
    this.wallet = new ethers.Wallet(PRIVATE_KEY, this.provider);
    this.contract = new ethers.Contract(MARKET_MANAGER_ADDRESS, MARKET_MANAGER_ABI, this.wallet);
    this.bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: false });
    
    this.processedMarkets = new Set();
    this.pollingInterval = 5000; // 5 seconds
  }

  async start() {
    console.log('🤖 Market Bot started');
    
    // Start event listener for resolved markets
    this.startEventListener();
    
    // Start polling for markets to end
    this.startPolling();
  }

  async startEventListener() {
    console.log('👂 Listening for MarketResolved events...');
    
    this.contract.on('MarketResolved', async (marketId, winner, totalPayout) => {
      try {
        console.log(`🎉 Market ${marketId} resolved! Winner: ${winner}, Payout: ${ethers.formatEther(totalPayout)}`);
        
        // Get market details
        const market = await this.contract.getMarket(marketId);
        
        // Send notification
        await this.sendResolutionNotification(marketId, winner, totalPayout, market);
        
      } catch (error) {
        console.error('Error handling MarketResolved event:', error);
      }
    });
  }

  async startPolling() {
    console.log('⏰ Starting market polling...');
    
    setInterval(async () => {
      try {
        await this.checkAndEndMarkets();
      } catch (error) {
        console.error('Error in polling:', error);
      }
    }, this.pollingInterval);
  }

  async checkAndEndMarkets() {
    console.log('🔍 Checking markets for end time...');
    
    try {
      // Get all market IDs (you might need to implement getActiveMarkets or track them)
      const marketIds = await this.getAllMarketIds();
      console.log(`📊 Found ${marketIds.length} markets to check:`, marketIds);
      
      for (const marketId of marketIds) {
        try {
          const market = await this.contract.getMarket(marketId);
          const currentTime = Math.floor(Date.now() / 1000);
          const endTime = Number(market.endTime);
          
          console.log(`Market ${marketId}: state=${market.state}, currentTime=${currentTime}, endTime=${endTime}, shouldEnd=${currentTime >= endTime}`);
          console.log(`Market ${marketId}: state check=${Number(market.state) === 0}, time check=${currentTime >= endTime}, both=${Number(market.state) === 0 && currentTime >= endTime}`);
          
          // Check if market should be ended
          if (Number(market.state) === 0 && currentTime >= endTime) {
            console.log(`⏰ Market ${marketId} reached end time, attempting to end...`);
            
            try {
              // Try to end the market
              const tx = await this.contract.endMarket(marketId);
              console.log(`📝 Transaction sent: ${tx.hash}`);
              await tx.wait();
              
              console.log(`✅ Market ${marketId} ended successfully!`);
              
              // Send notification
              await this.sendEndNotification(marketId, market);
              
            } catch (endError) {
              console.error(`❌ Failed to end market ${marketId}:`, endError.message);
            }
            
          }
        } catch (error) {
          console.error(`Error checking market ${marketId}:`, error);
        }
      }
    } catch (error) {
      console.error('Error in checkAndEndMarkets:', error);
    }
  }

  async getAllMarketIds() {
    try {
      // Use the actual contract function to get active markets
      const activeMarkets = await this.contract.getActiveMarkets();
      console.log('📊 Active markets from contract:', activeMarkets);
      return activeMarkets.map(id => Number(id));
    } catch (error) {
      console.error('Error getting active markets:', error);
      return [];
    }
  }

  async sendResolutionNotification(marketId, winner, totalPayout, market) {
    const message = `
🎉 *Market Resolved!*

📊 Market ID: ${marketId}
🏆 Winning Option: ${winner}
💰 Total Payout: ${ethers.formatEther(totalPayout)} PEPU
⏰ Resolved At: ${new Date().toLocaleString()}

Market has been successfully resolved!
    `;

    try {
      await this.bot.sendMessage(TELEGRAM_GROUP_ID, message, { parse_mode: 'Markdown' });
      console.log(`📱 Resolution notification sent for market ${marketId}`);
    } catch (error) {
      console.error('Error sending resolution notification:', error);
    }
  }

  async sendEndNotification(marketId, market) {
    // Get market metadata from IPFS
    let title = `Market #${marketId}`;
    let options = ['Yes', 'No'];
    
    try {
      if (market.ipfsHash) {
        const response = await fetch(`https://gateway.lighthouse.storage/ipfs/${market.ipfsHash}`);
        if (response.ok) {
          const metadata = await response.json();
          title = metadata.title || title;
          options = metadata.options || options;
        }
      }
    } catch (error) {
      console.error('Error fetching metadata:', error);
    }

    const verificationLink = `https://p2p-woad-omega.vercel.app/market/${marketId}`;
    
    const message = `
⏰ *Market Ended - Verification Required*

📊 **${title}**
🆔 Market ID: ${marketId}
🕐 End Time: ${new Date(Number(market.endTime) * 1000).toLocaleString()}
🤖 Ended By: Auto Bot

📋 **Options:**
${options.map((option, index) => `${index + 1}. ${option}`).join('\n')}

🔗 **Verify Result:** [Click here to vote](${verificationLink})

*Only verifiers can access the verification page*
    `;

    try {
      await this.bot.sendMessage(TELEGRAM_GROUP_ID, message, { parse_mode: 'Markdown' });
      console.log(`📱 End notification sent for market ${marketId}`);
    } catch (error) {
      console.error('Error sending end notification:', error);
    }
  }
}

// Start the bot
const bot = new MarketBot();
bot.start().catch(console.error);

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('🛑 Shutting down bot...');
  process.exit(0);
});
