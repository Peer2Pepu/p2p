const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");
require('dotenv').config();

async function main() {
    console.log("🔍 Fetching all markets and their information...\n");

    // Get contract addresses from environment variables
    const marketManagerAddress = process.env.NEXT_PUBLIC_P2P_MARKETMANAGER_ADDRESS;

    if (!marketManagerAddress) {
        console.error("❌ NEXT_PUBLIC_P2P_MARKETMANAGER_ADDRESS not found in .env file");
        process.exit(1);
    }

    // Load the actual ABI from the compiled contract
    const contractPath = path.join(__dirname, "..", "artifacts", "contracts", "P2PMarketManager.sol", "EventPool.json");
    const contractData = JSON.parse(fs.readFileSync(contractPath, "utf8"));
    const contractABI = contractData.abi;

    // Connect to the network using public RPC
    const provider = new ethers.JsonRpcProvider('https://rpc-pepu-v2-mainnet-0.t.conduit.xyz');
    
    const marketManager = new ethers.Contract(marketManagerAddress, contractABI, provider);

    try {
        // Get the next market ID to know how many markets exist
        const nextMarketId = await marketManager.getNextMarketId();
        console.log(`📊 Total markets created: ${Number(nextMarketId) - 1}\n`);

        // Get all active markets
        const activeMarkets = await marketManager.getActiveMarkets();
        console.log(`🟢 Active markets: ${activeMarkets.length}\n`);

        // Get all market IDs
        const allMarketIds = await marketManager.getAllMarketIds();
        console.log(`📋 All market IDs: ${allMarketIds.length}\n`);

        // Get detailed information for each market
        console.log("📄 Market Details:");
        console.log("=" .repeat(80));

        for (let i = 0; i < allMarketIds.length; i++) {
            const marketId = allMarketIds[i];
            try {
                console.log(`\n🏷️  Market ID: ${marketId}`);
                
                // Get basic market info
                const market = await marketManager.getMarket(marketId);
                console.log(`   Creator: ${market.creator}`);
                console.log(`   IPFS Hash: ${market.ipfsHash}`);
                console.log(`   Type: ${market.isMultiOption ? 'Multi-Option' : 'Linear'}`);
                console.log(`   Max Options: ${Number(market.maxOptions)}`);
                console.log(`   Payment Token: ${market.paymentToken === ethers.ZeroAddress ? 'PEPU (Native)' : market.paymentToken}`);
                console.log(`   Min Stake: ${ethers.formatEther(market.minStake)}`);
                console.log(`   Creator Deposit: ${ethers.formatEther(market.creatorDeposit)}`);
                console.log(`   Creator Outcome: ${Number(market.creatorOutcome)}`);
                console.log(`   Start Time: ${new Date(Number(market.startTime) * 1000).toLocaleString()}`);
                console.log(`   End Time: ${new Date(Number(market.endTime) * 1000).toLocaleString()}`);
                console.log(`   Resolution End Time: ${new Date(Number(market.resolutionEndTime) * 1000).toLocaleString()}`);
                console.log(`   State: ${getMarketStateName(Number(market.state))}`);
                console.log(`   Winning Option: ${Number(market.winningOption)}`);
                console.log(`   Is Resolved: ${market.isResolved}`);

                // Get comprehensive market info
                try {
                    const marketInfo = await marketManager.getMarketInfo(marketId);
                    console.log(`   Token Symbol: ${marketInfo.tokenSymbol}`);
                    console.log(`   Total Pool: ${ethers.formatEther(marketInfo.totalPool)} ${marketInfo.tokenSymbol}`);
                    console.log(`   Support Pool: ${ethers.formatEther(marketInfo.supportPool)} ${marketInfo.tokenSymbol}`);
                    console.log(`   Bettor Count: ${Number(marketInfo.bettorCount)}`);
                    console.log(`   Supporter Count: ${Number(marketInfo.supporterCount)}`);
                } catch (error) {
                    console.log(`   ❌ Error getting market info: ${error.message}`);
                }

                // Get option pools for each option
                try {
                    console.log(`   Option Pools:`);
                    for (let option = 1; option <= Number(market.maxOptions); option++) {
                        const pool = await marketManager.getOptionPool(marketId, option, market.paymentToken);
                        console.log(`     Option ${option}: ${ethers.formatEther(pool)}`);
                    }
                } catch (error) {
                    console.log(`   ❌ Error getting option pools: ${error.message}`);
                }

                // Check if market is active
                try {
                    const isActive = await marketManager.isMarketActive(marketId);
                    console.log(`   Is Active: ${isActive}`);
                } catch (error) {
                    console.log(`   ❌ Error checking if active: ${error.message}`);
                }

                console.log(`   Time Remaining: ${getTimeRemaining(Number(market.endTime), Number(market.state))}`);

            } catch (error) {
                console.log(`\n❌ Error fetching market ${marketId}: ${error.message}`);
            }
        }

        // Get supported tokens
        console.log("\n\n🪙 Supported Tokens:");
        console.log("=" .repeat(40));
        try {
            const [tokens, symbols] = await marketManager.getSupportedTokens();
            for (let i = 0; i < tokens.length; i++) {
                const tokenAddress = tokens[i];
                const symbol = symbols[i];
                console.log(`${symbol}: ${tokenAddress === ethers.ZeroAddress ? 'Native PEPU' : tokenAddress}`);
            }
        } catch (error) {
            console.log(`❌ Error fetching supported tokens: ${error.message}`);
        }

        // Get market creation fee
        try {
            const creationFee = await marketManager.marketCreationFee();
            console.log(`\n💰 Market Creation Fee: ${ethers.formatEther(creationFee)} PEPU`);
        } catch (error) {
            console.log(`❌ Error fetching creation fee: ${error.message}`);
        }

    } catch (error) {
        console.error("❌ Error:", error);
    }
}

function getMarketStateName(state) {
    const states = ['Active', 'Ended', 'Resolved', 'Cancelled', 'Deleted'];
    return states[state] || 'Unknown';
}

function getTimeRemaining(endTime, state) {
    if (state !== 0) { // Not Active
        return 'Market not active';
    }
    
    const now = Math.floor(Date.now() / 1000);
    const remaining = Number(endTime) - now;
    
    if (remaining <= 0) {
        return 'Betting period ended';
    }
    
    const hours = Math.floor(remaining / 3600);
    const minutes = Math.floor((remaining % 3600) / 60);
    const seconds = remaining % 60;
    
    return `${hours}h ${minutes}m ${seconds}s`;
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
