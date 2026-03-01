const { ethers } = require("ethers");
require("dotenv").config();

// Supabase configuration
// IMPORTANT: Bot uses SERVICE_ROLE_KEY (not anon key) to bypass RLS for INSERT/UPDATE
const { createClient } = require('@supabase/supabase-js');
const supabaseProjectId = process.env.SUPABASE_PROJECT_ID;
// Use service role key for bot (bypasses RLS, allows INSERT/UPDATE/DELETE)
// Browser uses NEXT_PUBLIC_SUPABASE_ANON_KEY (respects RLS, read-only)
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseProjectId || !supabaseKey) {
    console.error('❌ Missing Supabase configuration.');
    console.error('   Bot requires: SUPABASE_PROJECT_ID and SUPABASE_SERVICE_ROLE_KEY');
    console.error('   (SUPABASE_SERVICE_ROLE_KEY bypasses RLS for INSERT/UPDATE operations)');
    console.error('   Fallback: SUPABASE_ANON_KEY (will fail if RLS blocks INSERT)');
    process.exit(1);
}

const supabaseUrl = `https://${supabaseProjectId}.supabase.co`;

const supabase = createClient(supabaseUrl, supabaseKey);

// Warn if using anon key instead of service role key
if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.log('✅ Using SUPABASE_SERVICE_ROLE_KEY (bypasses RLS)');
} else {
    console.warn('⚠️  WARNING: Using SUPABASE_ANON_KEY instead of SUPABASE_SERVICE_ROLE_KEY');
    console.warn('   Bot may fail if RLS policies block INSERT operations');
    console.warn('   Add SUPABASE_SERVICE_ROLE_KEY to .env for proper operation');
}

// Contract configuration
const MARKET_MANAGER_ADDRESS = process.env.NEXT_PUBLIC_P2P_MARKET_MANAGER_ADDRESS || process.env.NEXT_PUBLIC_P2P_MARKETMANAGER_ADDRESS;
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

// IPFS helper function with fallback gateways
async function getIPFSData(ipfsHash) {
    if (!ipfsHash) return null;
    
    // List of IPFS gateways to try (in order)
    const gateways = [
        `https://gateway.lighthouse.storage/ipfs/${ipfsHash}`,
        `https://ipfs.io/ipfs/${ipfsHash}`,
        `https://cloudflare-ipfs.com/ipfs/${ipfsHash}`,
        `https://gateway.pinata.cloud/ipfs/${ipfsHash}`,
        `https://dweb.link/ipfs/${ipfsHash}`
    ];
    
    // Try each gateway with timeout
    for (let i = 0; i < gateways.length; i++) {
        const gatewayUrl = gateways[i];
        try {
            console.log(`🔗 Fetching from gateway ${i + 1}/${gateways.length}: ${gatewayUrl}`);
            
            // Create abort controller for timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
            
            const response = await fetch(gatewayUrl, {
                signal: controller.signal,
                headers: {
                    'Accept': 'application/json'
                }
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            console.log(`✅ Successfully fetched IPFS data from gateway ${i + 1}:`, data);
            return data;
        } catch (error) {
            if (error.name === 'AbortError') {
                console.warn(`⏱️  Timeout fetching from gateway ${i + 1}, trying next...`);
            } else {
                console.warn(`⚠️  Error fetching from gateway ${i + 1}: ${error.message}, trying next...`);
            }
            
            // If this is the last gateway, log the final error
            if (i === gateways.length - 1) {
                console.error(`❌ Failed to fetch IPFS data for ${ipfsHash} from all gateways`);
            }
        }
    }
    
    return null;
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
    const marketIdNum = Number(marketId);

    console.log(`🎯 Processing MarketCreated event: Market #${marketIdNum}`);

    // Check if market already exists in Supabase (most reliable check)
    if (await marketExists(marketIdNum)) {
        console.log(`⏭️  Market ${marketIdNum} already exists in Supabase, skipping`);
        return;
    }

    // Get market data from contract to fetch new fields (marketType, priceFeed, priceThreshold)
    const marketContract = new ethers.Contract(MARKET_MANAGER_ADDRESS, [
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
                        {"name": "marketType", "type": "uint8"},
                        {"name": "priceFeed", "type": "address"},
                        {"name": "priceThreshold", "type": "uint256"},
                        {"name": "p2pAssertionId", "type": "bytes32"},
                        {"name": "p2pAssertionMade", "type": "bool"}
                    ],
                    "name": "",
                    "type": "tuple"
                }
            ],
            "stateMutability": "view",
            "type": "function"
        }
    ], provider);

    let marketType = 'P2POPTIMISTIC';
    let priceFeed = null;
    let priceThreshold = null;

    try {
        const marketData = await marketContract.getMarket(marketId);
        marketType = Number(marketData.marketType) === 0 ? 'PRICE_FEED' : 'P2POPTIMISTIC';
        priceFeed = marketData.priceFeed !== ethers.ZeroAddress ? marketData.priceFeed : null;
        priceThreshold = marketData.priceThreshold > 0 ? marketData.priceThreshold.toString() : null;
        console.log(`📊 Market type: ${marketType}, Price feed: ${priceFeed}, Threshold: ${priceThreshold}`);
    } catch (error) {
        console.warn(`⚠️  Could not fetch market data from contract: ${error.message}`);
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
        market_id: marketIdNum.toString(),
        ipfs: ipfsHash || '',
        image: imageUrl || '',
        stakeend: new Date(Number(stakeEndTime) * 1000).toISOString(),
        endtime: new Date(Number(endTime) * 1000).toISOString(),
        creator: creator.toLowerCase(),
        type: isMultiOption ? 'multi' : 'linear',
        token: tokenSymbol,
        category: categories,
        market_type: marketType,
        price_feed: priceFeed,
        price_threshold: priceThreshold,
        uma_assertion_made: false
    };

    console.log(`📝 Market data:`, marketRecord);

    // Final check if market exists before inserting (race condition protection)
    if (await marketExists(marketIdNum)) {
        console.log(`⏭️  Market ${marketIdNum} already exists in Supabase (final check), skipping insertion`);
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

    // Track processed events to prevent duplicates
    const processedEvents = new Set(); // Track by txHash:logIndex
    const processedMarketIds = new Set(); // Track processed market IDs in this session

    // Create provider with retry configuration
    const provider = new ethers.JsonRpcProvider(RPC_URL, undefined, {
        polling: true,
        pollingInterval: 5000,
        timeout: 60000, // 60 second timeout (increased for slow RPC)
        retryDelay: 3000, // 3 second retry delay
        maxRetries: 5 // Increased retries
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
        const eventKey = `${event.transactionHash}:${event.logIndex}`;
        const marketId = Number(event.args.marketId);
        
        // Skip if already processed
        if (processedEvents.has(eventKey) || processedMarketIds.has(marketId)) {
            console.log(`⏭️  Skipping already processed event: Market #${marketId} (${eventKey})`);
            continue;
        }
        
        processedEvents.add(eventKey);
        processedMarketIds.add(marketId);
        await processMarketEvent(event, provider);
    }
    
    console.log(`✅ Finished processing missed events. Starting real-time monitoring...`);

    setInterval(async () => {
        try {
            // Get current block number with retry logic
            let currentBlock;
            let retries = 0;
            const maxRetries = 3;
            
            while (retries < maxRetries) {
                try {
                    currentBlock = await provider.getBlockNumber();
                    break;
                } catch (error) {
                    retries++;
                    if (retries >= maxRetries) {
                        console.error(`❌ Failed to get block number after ${maxRetries} retries:`, error.message);
                        return; // Skip this iteration, will retry next interval
                    }
                    console.warn(`⚠️  Block number fetch failed (attempt ${retries}/${maxRetries}), retrying...`);
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
            }
            
            if (currentBlock > latestBlock) {
                console.log(`🔍 Checking blocks ${latestBlock + 1} to ${currentBlock}`);

                try {
                    // Filter for MarketCreated events with retry
                    const filter = contract.filters.MarketCreated();
                    const events = await contract.queryFilter(filter, latestBlock + 1, currentBlock);

                    // Process new events
                    for (const event of events) {
                        const eventKey = `${event.transactionHash}:${event.logIndex}`;
                        const marketId = Number(event.args.marketId);
                        
                        // Skip if already processed
                        if (processedEvents.has(eventKey) || processedMarketIds.has(marketId)) {
                            console.log(`⏭️  Skipping already processed event: Market #${marketId} (${eventKey})`);
                            continue;
                        }
                        
                        processedEvents.add(eventKey);
                        processedMarketIds.add(marketId);
                        await processMarketEvent(event, provider);
                    }

                    latestBlock = currentBlock;
                } catch (error) {
                    console.error(`❌ Error querying events:`, error.message);
                    // Don't update latestBlock on error, will retry next interval
                }
            }
        } catch (error) {
            console.error('❌ Error in monitoring loop:', error.message);
            // Continue monitoring despite errors
        }
    }, 10000); // Poll every 10 seconds (increased from 5s to reduce RPC load)
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

