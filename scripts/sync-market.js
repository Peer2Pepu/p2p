const { ethers } = require("ethers");
require("dotenv").config();

// Supabase configuration
const { createClient } = require('@supabase/supabase-js');
const supabaseProjectId = process.env.SUPABASE_PROJECT_ID;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseProjectId || !supabaseKey) {
    console.error('❌ Missing Supabase configuration.');
    console.error('   Requires: SUPABASE_PROJECT_ID and SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.log('✅ Using SUPABASE_SERVICE_ROLE_KEY (bypasses RLS)');
} else {
    console.warn('⚠️  WARNING: Using SUPABASE_ANON_KEY instead of SUPABASE_SERVICE_ROLE_KEY');
}

const supabaseUrl = `https://${supabaseProjectId}.supabase.co`;
const supabase = createClient(supabaseUrl, supabaseKey);

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

// Get market ID from command line
const marketId = process.argv[2];

if (!marketId) {
    console.error('❌ Usage: node sync-market.js <marketId>');
    console.error('   Example: node sync-market.js 7');
    process.exit(1);
}

const marketIdNum = parseInt(marketId, 10);
if (isNaN(marketIdNum)) {
    console.error('❌ Invalid market ID. Must be a number.');
    process.exit(1);
}

// Contract ABIs
// Must match P2PMarketManager.Market struct field order exactly
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
                    {"name": "resolvedPrice", "type": "uint256"},
                    {"name": "marketType", "type": "uint8"},
                    {"name": "priceFeed", "type": "address"},
                    {"name": "priceThreshold", "type": "uint256"},
                    {"name": "p2pAssertionId", "type": "bytes32"},
                    {"name": "p2pAssertionMade", "type": "bool"},
                    {"name": "p2pDisputedOptionId", "type": "uint256"}
                ],
                "name": "",
                "type": "tuple"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    }
];

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
    
    const gateways = [
        `https://gateway.lighthouse.storage/ipfs/${ipfsHash}`,
        `https://ipfs.io/ipfs/${ipfsHash}`,
        `https://cloudflare-ipfs.com/ipfs/${ipfsHash}`,
        `https://gateway.pinata.cloud/ipfs/${ipfsHash}`,
        `https://dweb.link/ipfs/${ipfsHash}`
    ];
    
    for (let i = 0; i < gateways.length; i++) {
        const gatewayUrl = gateways[i];
        try {
            console.log(`🔗 Fetching from gateway ${i + 1}/${gateways.length}: ${gatewayUrl}`);
            
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);
            
            const response = await fetch(gatewayUrl, {
                signal: controller.signal,
                headers: { 'Accept': 'application/json' }
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            console.log(`✅ Successfully fetched IPFS data from gateway ${i + 1}`);
            return data;
        } catch (error) {
            if (error.name === 'AbortError') {
                console.warn(`⏱️  Timeout fetching from gateway ${i + 1}, trying next...`);
            } else {
                console.warn(`⚠️  Error fetching from gateway ${i + 1}: ${error.message}, trying next...`);
            }
            
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
        
        for (let i = 0; i < tokens.length; i++) {
            if (tokens[i].toLowerCase() === paymentToken.toLowerCase()) {
                return symbols[i];
            }
        }
        
        console.log(`⚠️  Token ${paymentToken} not found in supported tokens`);
        return paymentToken;
    } catch (error) {
        console.error(`❌ Error getting token symbol for ${paymentToken}:`, error.message);
        return paymentToken;
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

        if (error && error.code !== 'PGRST116') {
            console.error('❌ Error checking market existence:', error);
            return false;
        }

        return !!data;
    } catch (error) {
        console.error('❌ Error checking market existence:', error);
        return false;
    }
}

// Function to insert or update market data in Supabase
async function upsertMarket(marketData, retries = 3) {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            console.log(`📝 Attempting to upsert market ${marketData.market_id} (attempt ${attempt}/${retries})`);
            
            const { data, error } = await supabase
                .from('market')
                .upsert([marketData], { onConflict: 'market_id' });

            if (error) {
                console.error(`❌ Error upserting market (attempt ${attempt}):`, error);
                if (attempt === retries) {
                    return false;
                }
                await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
                continue;
            }

            console.log(`✅ Market ${marketData.market_id} upserted successfully`);
            return true;
        } catch (error) {
            console.error(`❌ Error upserting market (attempt ${attempt}):`, error);
            if (attempt === retries) {
                return false;
            }
            await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
        }
    }
    return false;
}

// Main function to sync market
async function syncMarket() {
    console.log(`🚀 Syncing Market #${marketIdNum} to Supabase...`);
    
    // Create provider
    const provider = new ethers.JsonRpcProvider(RPC_URL, undefined, {
        timeout: 60000,
        retryDelay: 3000,
        maxRetries: 5
    });
    
    // Test connection
    try {
        await provider.getBlockNumber();
        console.log('✅ Connected to RPC');
    } catch (error) {
        console.error('❌ Failed to connect to RPC:', error.message);
        process.exit(1);
    }
    
    // Check if market exists in Supabase
    const exists = await marketExists(marketIdNum);
    if (exists) {
        console.log(`⚠️  Market ${marketIdNum} already exists in Supabase`);
        console.log('   Use this script to update it with latest data from contract');
    }
    
    // Get market data from contract
    const marketContract = new ethers.Contract(MARKET_MANAGER_ADDRESS, MARKET_MANAGER_ABI, provider);
    
    let marketData;
    try {
        console.log(`📡 Fetching market data from contract...`);
        marketData = await marketContract.getMarket(marketIdNum);
        console.log('✅ Market data fetched from contract');
    } catch (error) {
        console.error(`❌ Error fetching market data: ${error.message}`);
        console.error('   Market may not exist on-chain');
        process.exit(1);
    }
    
    // Extract market information
    const {
        creator,
        ipfsHash,
        isMultiOption,
        paymentToken,
        stakeEndTime,
        endTime,
        marketType,
        priceFeed,
        priceThreshold
    } = marketData;
    
    // Determine market type
    const marketTypeStr = Number(marketType) === 0 ? 'PRICE_FEED' : 'P2POPTIMISTIC';
    const priceFeedAddr = priceFeed !== ethers.ZeroAddress ? priceFeed : null;
    const priceThresholdStr = priceThreshold > 0 ? priceThreshold.toString() : null;
    
    console.log(`📊 Market type: ${marketTypeStr}, Price feed: ${priceFeedAddr}, Threshold: ${priceThresholdStr}`);
    
    // Get IPFS data
    let ipfsData = null;
    let imageUrl = null;
    
    if (ipfsHash) {
        console.log(`📥 Fetching IPFS data for ${ipfsHash}`);
        ipfsData = await getIPFSData(ipfsHash);
        
        if (ipfsData && ipfsData.imageUrl) {
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
        market_type: marketTypeStr,
        price_feed: priceFeedAddr,
        price_threshold: priceThresholdStr,
        uma_assertion_made: false
    };
    
    console.log(`📝 Market record prepared:`, marketRecord);
    
    // Upsert into Supabase
    const success = await upsertMarket(marketRecord);
    
    if (success) {
        console.log(`\n✅ Successfully synced Market #${marketIdNum} to Supabase!`);
    } else {
        console.error(`\n❌ Failed to sync Market #${marketIdNum} to Supabase`);
        process.exit(1);
    }
}

// Run the sync
syncMarket().catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
});
