const { ethers } = require("ethers");
require("dotenv").config();

// Supabase configuration
const { createClient } = require('@supabase/supabase-js');
const supabaseProjectId = process.env.SUPABASE_PROJECT_ID;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseProjectId || !supabaseKey) {
    console.error('❌ Missing Supabase configuration. Please set SUPABASE_PROJECT_ID and SUPABASE_ANON_KEY in .env');
    process.exit(1);
}

const supabaseUrl = `https://${supabaseProjectId}.supabase.co`;

const supabase = createClient(supabaseUrl, supabaseKey);

// Contract configuration
const MARKET_MANAGER_ADDRESS = process.env.NEXT_PUBLIC_P2P_MARKET_MANAGER_ADDRESS;
const ADMIN_MANAGER_ADDRESS = process.env.NEXT_PUBLIC_P2P_ADMIN_ADDRESS;
const RPC_URL = 'https://rpc-pepu-v2-mainnet-0.t.conduit.xyz';

if (!MARKET_MANAGER_ADDRESS) {
    console.error('❌ Missing NEXT_PUBLIC_P2P_MARKET_MANAGER_ADDRESS in .env');
    process.exit(1);
}

if (!ADMIN_MANAGER_ADDRESS) {
    console.error('❌ Missing NEXT_PUBLIC_P2P_ADMIN_ADDRESS in .env');
    process.exit(1);
}

// Contract ABI for MarketCreated event
const MARKET_MANAGER_ABI = [
    {
        "anonymous": false,
        "inputs": [
            {"indexed": true, "name": "marketId", "type": "uint256"},
            {"indexed": true, "name": "creator", "type": "address"},
            {"name": "ipfsHash", "type": "string"},
            {"name": "isMultiOption", "type": "bool"},
            {"name": "maxOptions", "type": "uint256"},
            {"name": "paymentToken", "type": "address"},
            {"name": "minStake", "type": "uint256"},
            {"name": "startTime", "type": "uint256"},
            {"name": "stakeEndTime", "type": "uint256"},
            {"name": "endTime", "type": "uint256"},
            {"name": "resolutionEndTime", "type": "uint256"}
        ],
        "name": "MarketCreated",
        "type": "event"
    }
];

// Contract ABI for AdminManager getSupportedTokens function
const ADMIN_MANAGER_ABI = [
    {
        "inputs": [],
        "name": "getSupportedTokens",
        "outputs": [
            {"name": "tokens", "type": "address[]"},
            {"name": "symbols", "type": "string[]"}
        ],
        "stateMutability": "view",
        "type": "function"
    }
];

// IPFS helper function
async function getIPFSData(ipfsHash) {
    try {
        const gatewayUrl = `https://gateway.lighthouse.storage/ipfs/${ipfsHash}`;
        console.log(`🔗 Fetching from: ${gatewayUrl}`);
        
        const response = await fetch(gatewayUrl);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        console.log(`✅ Successfully fetched IPFS data:`, data);
        return data;
    } catch (error) {
        console.error(`❌ Error fetching IPFS data for ${ipfsHash}:`, error.message);
        return null;
    }
}

// Function to get token symbol from AdminManager contract
async function getTokenSymbol(provider, paymentToken) {
    try {
        const adminContract = new ethers.Contract(ADMIN_MANAGER_ADDRESS, ADMIN_MANAGER_ABI, provider);
        const [tokens, symbols] = await adminContract.getSupportedTokens();
        
        // Find the matching token address
        for (let i = 0; i < tokens.length; i++) {
            if (tokens[i].toLowerCase() === paymentToken.toLowerCase()) {
                return symbols[i];
            }
        }
        
        // If not found in supported tokens, return the address as fallback
        console.log(`⚠️  Token ${paymentToken} not found in supported tokens`);
        return paymentToken;
    } catch (error) {
        console.error(`❌ Error getting token symbol for ${paymentToken}:`, error.message);
        return paymentToken; // Return address as fallback
    }
}

// Function to check if market exists in Supabase
async function marketExists(marketId) {
    try {
        const { data, error } = await supabase
            .from('market')
            .select('market_id')
            .eq('market_id', marketId.toString())
            .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
            console.error('❌ Error checking market existence:', error);
            return false;
        }

        return !!data;
    } catch (error) {
        console.error('❌ Error checking market existence:', error);
        return false;
    }
}

// Function to insert market data into Supabase with retry logic
async function insertMarket(marketData, retries = 3) {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            console.log(`📝 Attempting to insert market ${marketData.market_id} (attempt ${attempt}/${retries})`);
            
            const { data, error } = await supabase
                .from('market')
                .insert([marketData]);

            if (error) {
                // Check if it's a duplicate key error
                if (error.code === '23505' || error.message.includes('duplicate key')) {
                    console.log(`⏭️  Market ${marketData.market_id} already exists (duplicate key), skipping`);
                    return true; // Consider this a success since the market exists
                }
                
                console.error(`❌ Error inserting market (attempt ${attempt}):`, error);
                if (attempt === retries) {
                    return false;
                }
                // Wait before retry
                await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
                continue;
            }

            console.log(`✅ Market ${marketData.market_id} inserted successfully`);
            return true;
        } catch (error) {
            // Check if it's a duplicate key error
            if (error.code === '23505' || error.message.includes('duplicate key')) {
                console.log(`⏭️  Market ${marketData.market_id} already exists (duplicate key), skipping`);
                return true; // Consider this a success since the market exists
            }
            
            console.error(`❌ Error inserting market (attempt ${attempt}):`, error);
            if (attempt === retries) {
                return false;
            }
            // Wait before retry
            await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
        }
    }
    return false;
}

// Function to process a single market event
async function processMarketEvent(event, provider) {
    const { marketId, creator, ipfsHash, isMultiOption, paymentToken, startTime, stakeEndTime, endTime } = event.args;

    console.log(`🎯 Processing MarketCreated event: Market #${marketId}`);

    // Check if market already exists
    if (await marketExists(marketId)) {
        console.log(`⏭️  Market ${marketId} already exists, skipping`);
        return;
    }

    // Get IPFS data
    let ipfsData = null;
    let imageUrl = null;

    if (ipfsHash) {
        console.log(`📥 Fetching IPFS data for ${ipfsHash}`);
        ipfsData = await getIPFSData(ipfsHash);
        
        if (ipfsData && ipfsData.imageUrl) {
            // Use the imageUrl directly from IPFS data
            imageUrl = ipfsData.imageUrl;
            console.log(`🖼️  Image URL: ${imageUrl}`);
        }
    }

    // Get token symbol
    console.log(`💰 Getting token symbol for ${paymentToken}`);
    const tokenSymbol = await getTokenSymbol(provider, paymentToken);
    console.log(`🏷️  Token symbol: ${tokenSymbol}`);

    // Extract categories from IPFS data
    let categories = '';
    if (ipfsData && ipfsData.categories && Array.isArray(ipfsData.categories)) {
        categories = ipfsData.categories.join(', ');
        console.log(`🏷️  Categories extracted: ${categories}`);
    }

    // Prepare market data for Supabase
    const marketRecord = {
        market_id: marketId.toString(),
        ipfs: ipfsHash || '',
        image: imageUrl || '',
        stakeend: new Date(Number(stakeEndTime) * 1000).toISOString(),
        endtime: new Date(Number(endTime) * 1000).toISOString(),
        creator: creator.toLowerCase(),
        type: isMultiOption ? 'multi' : 'linear',
        token: tokenSymbol,
        category: categories
    };

    console.log(`📝 Market data:`, marketRecord);

    // Double-check if market exists before inserting (race condition protection)
    if (await marketExists(marketId)) {
        console.log(`⏭️  Market ${marketId} already exists in Supabase, skipping insertion`);
        return;
    }

    // Insert into Supabase
    await insertMarket(marketRecord);
}

// Main monitoring function
async function monitorMarketEvents() {
    console.log('🚀 Starting Market Event Monitor...');
    console.log(`📡 Monitoring MarketManager: ${MARKET_MANAGER_ADDRESS}`);
    console.log(`🔄 Polling every 5 seconds`);

    // Create provider with retry configuration
    const provider = new ethers.JsonRpcProvider(RPC_URL, undefined, {
        polling: true,
        pollingInterval: 5000,
        timeout: 30000, // 30 second timeout
        retryDelay: 2000, // 2 second retry delay
        maxRetries: 3
    });
    
    // Test connection with retry logic
    let latestBlock;
    let retries = 0;
    const maxRetries = 5;
    
    while (retries < maxRetries) {
        try {
            console.log(`🔌 Testing RPC connection (attempt ${retries + 1}/${maxRetries})...`);
            latestBlock = await provider.getBlockNumber();
            console.log(`📦 Connected! Starting from block: ${latestBlock}`);
            break;
        } catch (error) {
            retries++;
            console.error(`❌ RPC connection failed (attempt ${retries}/${maxRetries}):`, error.message);
            
            if (retries >= maxRetries) {
                console.error('❌ Failed to connect to RPC after maximum retries. Exiting...');
                process.exit(1);
            }
            
            console.log(`⏳ Waiting 5 seconds before retry...`);
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
    }
    
    const contract = new ethers.Contract(MARKET_MANAGER_ADDRESS, MARKET_MANAGER_ABI, provider);
    
    // Check last 500 blocks for any missed events on startup
    console.log(`🔍 Checking last 500 blocks for missed events...`);
    const startBlock = Math.max(0, latestBlock - 500);
    
    const filter = contract.filters.MarketCreated();
    const missedEvents = await contract.queryFilter(filter, startBlock, latestBlock);
    
    console.log(`📋 Found ${missedEvents.length} events in last 500 blocks`);
    
    // Process missed events
    for (const event of missedEvents) {
        await processMarketEvent(event, provider);
    }
    
    console.log(`✅ Finished processing missed events. Starting real-time monitoring...`);

    setInterval(async () => {
        try {
            // Get current block number
            const currentBlock = await provider.getBlockNumber();
            
            if (currentBlock > latestBlock) {
                console.log(`🔍 Checking blocks ${latestBlock + 1} to ${currentBlock}`);

                // Filter for MarketCreated events
                const filter = contract.filters.MarketCreated();
                const events = await contract.queryFilter(filter, latestBlock + 1, currentBlock);

                // Process new events
                for (const event of events) {
                    await processMarketEvent(event, provider);
                }

                latestBlock = currentBlock;
            }
        } catch (error) {
            console.error('❌ Error in monitoring loop:', error);
        }
    }, 5000); // Poll every 5 seconds
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down Market Event Monitor...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n🛑 Shutting down Market Event Monitor...');
    process.exit(0);
});

// Start monitoring
monitorMarketEvents().catch(console.error);
