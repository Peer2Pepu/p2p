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
const RPC_URL = 'https://rpc-pepu-v2-mainnet-0.t.conduit.xyz';

if (!MARKET_MANAGER_ADDRESS) {
    console.error('❌ Missing NEXT_PUBLIC_P2P_MARKET_MANAGER_ADDRESS in .env');
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

// Function to insert market data into Supabase
async function insertMarket(marketData) {
    try {
        const { data, error } = await supabase
            .from('market')
            .insert([marketData]);

        if (error) {
            console.error('❌ Error inserting market:', error);
            return false;
        }

        console.log(`✅ Market ${marketData.market_id} inserted successfully`);
        return true;
    } catch (error) {
        console.error('❌ Error inserting market:', error);
        return false;
    }
}

// Main monitoring function
async function monitorMarketEvents() {
    console.log('🚀 Starting Market Event Monitor...');
    console.log(`📡 Monitoring MarketManager: ${MARKET_MANAGER_ADDRESS}`);
    console.log(`🔄 Polling every 5 seconds`);

    // Create provider
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const contract = new ethers.Contract(MARKET_MANAGER_ADDRESS, MARKET_MANAGER_ABI, provider);

    // Get the latest block number to start monitoring from
    let latestBlock = await provider.getBlockNumber();
    console.log(`📦 Starting from block: ${latestBlock}`);
    
    // Check last 500 blocks for any missed events on startup
    console.log(`🔍 Checking last 500 blocks for missed events...`);
    const startBlock = Math.max(0, latestBlock - 500);
    
    const filter = contract.filters.MarketCreated();
    const missedEvents = await contract.queryFilter(filter, startBlock, latestBlock);
    
    console.log(`📋 Found ${missedEvents.length} events in last 500 blocks`);
    
    for (const event of missedEvents) {
        const { marketId, creator, ipfsHash, startTime, stakeEndTime, endTime } = event.args;

        console.log(`🎯 Processing missed event: Market #${marketId}`);

        // Check if market already exists
        if (await marketExists(marketId)) {
            console.log(`⏭️  Market ${marketId} already exists, skipping`);
            continue;
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

        // Prepare market data for Supabase
        const marketRecord = {
            market_id: marketId.toString(),
            ipfs: ipfsHash || '',
            image: imageUrl || '',
            stakeend: new Date(Number(stakeEndTime) * 1000).toISOString(),
            endtime: new Date(Number(endTime) * 1000).toISOString(),
            creator: creator.toLowerCase()
        };

        console.log(`📝 Market data:`, marketRecord);

        // Insert into Supabase
        await insertMarket(marketRecord);
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

                for (const event of events) {
                    const { marketId, creator, ipfsHash, startTime, stakeEndTime, endTime } = event.args;

                    console.log(`🎯 Found MarketCreated event: Market #${marketId}`);

                    // Check if market already exists
                    if (await marketExists(marketId)) {
                        console.log(`⏭️  Market ${marketId} already exists, skipping`);
                        continue;
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

                    // Prepare market data for Supabase
                    const marketRecord = {
                        market_id: marketId.toString(),
                        ipfs: ipfsHash || '',
                        image: imageUrl || '',
                        stakeend: new Date(Number(stakeEndTime) * 1000).toISOString(),
                        endtime: new Date(Number(endTime) * 1000).toISOString(),
                        creator: creator.toLowerCase()
                    };

                    console.log(`📝 Market data:`, marketRecord);

                    // Insert into Supabase
                    await insertMarket(marketRecord);
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
