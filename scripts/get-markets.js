const { ethers } = require("hardhat");
require('dotenv').config();

async function main() {
    console.log("🔍 Fetching all markets and their information...\n");

    // Get contract addresses from environment variables
    const marketManagerAddress = process.env.NEXT_PUBLIC_P2P_MARKETMANAGER_ADDRESS;
    const analyticsAddress = process.env.NEXT_PUBLIC_P2P_ANALYTICS_ADDRESS;
    const treasuryAddress = process.env.NEXT_PUBLIC_P2P_TREASURY_ADDRESS;
    const verificationAddress = process.env.NEXT_PUBLIC_P2P_VERIFICATION_ADDRESS;
    const tokenAddress = process.env.NEXT_PUBLIC_P2P_TOKEN_ADDRESS;

    if (!marketManagerAddress) {
        console.error("❌ NEXT_PUBLIC_P2P_MARKETMANAGER_ADDRESS not found in .env file");
        process.exit(1);
    }

    // Connect to the network using public RPC
    const provider = new ethers.JsonRpcProvider('https://rpc-pepu-v2-mainnet-0.t.conduit.xyz');
    
    // Get the contract factory and attach to deployed contract
    const EventPool = await ethers.getContractFactory("EventPool");
    const marketManager = EventPool.attach(marketManagerAddress);

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
                // Get basic market info
                const market = await marketManager.getMarket(marketId);
                
                // Get comprehensive market info
                const marketInfo = await marketManager.getMarketInfo(marketId);
                
                // Get option pools for each option
                const optionPools = [];
                for (let option = 1; option <= Number(market.maxOptions); option++) {
                    const pool = await marketManager.getOptionPool(marketId, option, market.paymentToken);
                    optionPools.push({
                        option,
                        pool: ethers.formatEther(pool)
                    });
                }

                // Get total pool and support pool
                const totalPool = await marketManager.getTotalPool(marketId, market.paymentToken);
                const supportPool = await marketManager.getSupportPool(marketId, market.paymentToken);

                // Get bettor and supporter counts
                const bettorCount = await marketManager.getBettorCount(marketId);
                const supporterCount = await marketManager.getSupporterCount(marketId);

                // Check if market is active
                const isActive = await marketManager.isMarketActive(marketId);

                console.log(`\n🏷️  Market ID: ${marketId}`);
                console.log(`   Creator: ${market.creator}`);
                console.log(`   IPFS Hash: ${market.ipfsHash}`);
                console.log(`   Type: ${market.isMultiOption ? 'Multi-Option' : 'Linear'}`);
                console.log(`   Max Options: ${Number(market.maxOptions)}`);
                console.log(`   Payment Token: ${market.paymentToken === ethers.ZeroAddress ? 'PEPU (Native)' : market.paymentToken}`);
                console.log(`   Token Symbol: ${marketInfo.tokenSymbol}`);
                console.log(`   Min Stake: ${ethers.formatEther(market.minStake)} ${marketInfo.tokenSymbol}`);
                console.log(`   Creator Deposit: ${ethers.formatEther(market.creatorDeposit)} ${marketInfo.tokenSymbol}`);
                console.log(`   Creator Outcome: ${Number(market.creatorOutcome)}`);
                console.log(`   Start Time: ${new Date(Number(market.startTime) * 1000).toLocaleString()}`);
                console.log(`   End Time: ${new Date(Number(market.endTime) * 1000).toLocaleString()}`);
                console.log(`   Resolution End Time: ${new Date(Number(market.resolutionEndTime) * 1000).toLocaleString()}`);
                console.log(`   State: ${getMarketStateName(Number(market.state))}`);
                console.log(`   Winning Option: ${Number(market.winningOption)}`);
                console.log(`   Is Resolved: ${market.isResolved}`);
                console.log(`   Is Active: ${isActive}`);
                console.log(`   Total Pool: ${ethers.formatEther(totalPool)} ${marketInfo.tokenSymbol}`);
                console.log(`   Support Pool: ${ethers.formatEther(supportPool)} ${marketInfo.tokenSymbol}`);
                console.log(`   Bettor Count: ${Number(bettorCount)}`);
                console.log(`   Supporter Count: ${Number(supporterCount)}`);
                
                console.log(`   Option Pools:`);
                optionPools.forEach(option => {
                    console.log(`     Option ${option.option}: ${option.pool} ${marketInfo.tokenSymbol}`);
                });

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
