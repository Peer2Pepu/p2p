const { ethers } = require('ethers');
const TelegramBot = require('node-telegram-bot-api');
require('dotenv').config();

// Configuration
const RPC_URL = 'https://rpc-pepu-v2-mainnet-0.t.conduit.xyz';
const MARKET_MANAGER_ADDRESS = process.env.NEXT_PUBLIC_P2P_MARKET_MANAGER_ADDRESS || process.env.NEXT_PUBLIC_P2P_MARKETMANAGER_ADDRESS;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_GROUP_ID = process.env.TELEGRAM_GROUP_ID;
const PRIVATE_KEY = process.env.PRIVATE_KEY;

// Validate required environment variables
if (!MARKET_MANAGER_ADDRESS) {
    console.error('❌ Missing NEXT_PUBLIC_P2P_MARKET_MANAGER_ADDRESS in .env');
    process.exit(1);
}

if (!TELEGRAM_BOT_TOKEN) {
    console.error('❌ Missing TELEGRAM_BOT_TOKEN in .env');
    process.exit(1);
}

if (!TELEGRAM_GROUP_ID) {
    console.error('❌ Missing TELEGRAM_GROUP_ID in .env');
    process.exit(1);
}

if (!PRIVATE_KEY) {
    console.error('❌ Missing PRIVATE_KEY in .env');
    process.exit(1);
}

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
  },
  {
    "inputs": [],
    "name": "getNextMarketId",
    "outputs": [{"name": "", "type": "uint256"}],
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
    "inputs": [{"name": "marketId", "type": "uint256"}],
    "name": "resolvePriceFeedMarket",
    "outputs": [],
    "stateMutability": "nonpayable",
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
    
    // Track notifications already sent to avoid duplicates
    this.processedEndNotices = new Set();
    this.pollingInterval = 5000; // 5 seconds
  }

  // Support both named tuple objects and index-based tuples.
  getMarketFields(market) {
    const hasNamed = market && typeof market === 'object' && !Array.isArray(market);
    const read = (name, index, fallback) => {
      const named = hasNamed ? market[name] : undefined;
      const indexed = market?.[index];
      return named !== undefined ? named : (indexed !== undefined ? indexed : fallback);
    };

    // V2 layout: ... isResolved(14), resolvedTimestamp(15), marketType(16), priceFeed(17), priceThreshold(18), resolvedPrice(19)
    // Legacy layout: ... isResolved(14), marketType(15), priceFeed(16), priceThreshold(17), ...
    const resolvedTsCandidate = read('resolvedTimestamp', 15, 0n);
    const hasResolvedTimestampSlot =
      typeof resolvedTsCandidate === 'bigint' && resolvedTsCandidate > 1000000000n;

    const marketType = Number(
      read('marketType', hasResolvedTimestampSlot ? 16 : 15, 1n)
    );
    const priceFeed = read('priceFeed', hasResolvedTimestampSlot ? 17 : 16, ethers.ZeroAddress);

    return {
      endTime: Number(read('endTime', 10, 0n)),
      resolutionEndTime: Number(read('resolutionEndTime', 11, 0n)),
      state: Number(read('state', 12, 0)),
      isResolved: Boolean(read('isResolved', 14, false)),
      marketType,
      priceFeed,
      hasPriceFeed:
        !!priceFeed &&
        typeof priceFeed === 'string' &&
        priceFeed.toLowerCase() !== ethers.ZeroAddress.toLowerCase(),
    };
  }

  async start() {
    console.log('🤖 Market Bot started');

    // RPC behind load balancers often drops eth_newFilter state ("filter not found").
    // Polling flow below handles end + resolve and sends notifications explicitly.
    console.log('👂 Event listener disabled (using polling-only mode)');

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
      // Get all market IDs (not just active ones)
      const allMarketIds = await this.getAllMarketIds();
      console.log(`📊 Found ${allMarketIds.length} markets to check:`, allMarketIds);
      
      for (const marketId of allMarketIds) {
        try {
          const market = await this.contract.getMarket(marketId);
          const currentTime = Math.floor(Date.now() / 1000);
          const { endTime, resolutionEndTime, state, marketType, isResolved, hasPriceFeed } = this.getMarketFields(market);
          
          console.log(`Market ${marketId}: state=${state}, type=${marketType}, currentTime=${currentTime}, endTime=${endTime}, resolutionEndTime=${resolutionEndTime}, isResolved=${isResolved}, hasPriceFeed=${hasPriceFeed}`);

          if (state === 1 && marketType === 0 && !hasPriceFeed && !isResolved) {
            console.warn(
              `⚠️ Market ${marketId} is PRICE_FEED but has zero priceFeed address; cannot auto-resolve on-chain.`
            );
          }
          
          // End active markets that have reached end time (works for both PRICE_FEED and P2POPTIMISTIC)
          if (state === 0 && currentTime >= endTime) {
            const marketTypeName = marketType === 0 ? 'PRICE_FEED' : 'P2POPTIMISTIC (Optimistic Oracle)';
            console.log(`⏰ Market ${marketId} (${marketTypeName}) reached end time, attempting to end...`);
            try {
              const tx = await this.contract.endMarket(marketId);
              console.log(`📝 Transaction sent: ${tx.hash}`);
              await tx.wait();
              console.log(`✅ Market ${marketId} ended successfully!`);

              // Refetch to ensure fresh data
              const endedMarket = await this.contract.getMarket(marketId);
              
              // If this is a PRICE_FEED market (has price feed address), auto-resolve it after ending
              const endedPriceFeed = endedMarket.priceFeed;
              const endedHasPriceFeed = endedPriceFeed && endedPriceFeed !== ethers.ZeroAddress;
              if (endedHasPriceFeed) {
                console.log(`💰 Market ${marketId} is a price feed market, attempting auto-resolution...`);
                try {
                  // Wait a bit for the endMarket transaction to be fully processed
                  await new Promise(resolve => setTimeout(resolve, 2000));
                  
                  // Check if resolution time has passed
                  const endedResolutionEndTime = Number(endedMarket.resolutionEndTime);
                  if (currentTime >= endedResolutionEndTime && !endedMarket.isResolved) {
                    const resolveTx = await this.contract.resolvePriceFeedMarket(marketId);
                    console.log(`📝 Resolution transaction sent: ${resolveTx.hash}`);
                    const receipt = await resolveTx.wait();
                    console.log(`✅ Market ${marketId} auto-resolved successfully!`);
                    await this.sendResolutionNotification(marketId, 0, 0n, endedMarket, receipt?.hash);
                  } else {
                    console.log(`⏳ Market ${marketId} resolution time not yet reached or already resolved`);
                  }
                } catch (resolveError) {
                  console.error(`❌ Failed to auto-resolve price feed market ${marketId}:`, resolveError.message);
                }
              }

              // Notify once per runtime
              if (!this.processedEndNotices.has(marketId)) {
                await this.sendEndNotification(marketId, endedMarket);
                this.processedEndNotices.add(marketId);
              }
            } catch (endError) {
              console.error(`❌ Failed to end market ${marketId}:`, endError.message);
            }
          }
          
          // Check for PRICE_FEED markets that are ended but not resolved
          // Only attempt if market has a price feed address (safest check)
          if (state === 1 && hasPriceFeed && !isResolved) {
            if (currentTime >= resolutionEndTime) {
              console.log(`💰 Market ${marketId} is an ended price feed market ready for resolution...`);
              try {
                const resolveTx = await this.contract.resolvePriceFeedMarket(marketId);
                console.log(`📝 Resolution transaction sent: ${resolveTx.hash}`);
                const receipt = await resolveTx.wait();
                console.log(`✅ Market ${marketId} auto-resolved successfully!`);
                await this.sendResolutionNotification(marketId, 0, 0n, market, receipt?.hash);
              } catch (resolveError) {
                console.error(`❌ Failed to auto-resolve price feed market ${marketId}:`, resolveError.message);
              }
            } else {
              const timeUntilResolution = resolutionEndTime - currentTime;
              const hoursUntil = Math.floor(timeUntilResolution / 3600);
              const minutesUntil = Math.floor((timeUntilResolution % 3600) / 60);
              console.log(`⏳ Market ${marketId} waiting for resolution time (${hoursUntil}h ${minutesUntil}m remaining)`);
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
      // Get the next market ID to know how many markets exist
      const nextMarketId = await this.contract.getNextMarketId();
      const totalMarkets = Number(nextMarketId);
      
      if (totalMarkets === 0) {
        return [];
      }
      
      // Iterate through all market IDs and return all valid markets
      const allMarketIds = [];
      let activeCount = 0;
      
      for (let i = 1; i < totalMarkets; i++) {
        try {
          const market = await this.contract.getMarket(i);
          const state = Number(market.state);
          // State 0 = Active, 1 = Ended, 2 = Resolved, 3 = Cancelled
          // Include all markets except cancelled ones (we need to check ended ones for resolution)
          if (state !== 3) { // Not cancelled
            allMarketIds.push(i);
            if (state === 0) {
              activeCount++;
            }
          }
        } catch (error) {
          // Market might not exist or be deleted, skip it
          continue;
        }
      }
      
      console.log(`📊 Found ${activeCount} active markets out of ${allMarketIds.length} total markets`);
      return allMarketIds;
    } catch (error) {
      console.error('Error getting all markets:', error);
      return [];
    }
  }

  async sendResolutionNotification(marketId, winner, totalPayout, market, txHash = null) {
    const message = `
🎉 *Market Resolved!*

📊 Market ID: ${marketId}
🏆 Winning Option: ${winner}
💰 Total Payout: ${ethers.formatEther(totalPayout)} PEPU
⏰ Resolved At: ${new Date().toLocaleString()}
${txHash ? `🧾 Tx: \`${txHash}\`\n` : ''}

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

