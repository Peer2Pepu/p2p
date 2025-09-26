const { ethers } = require('hardhat');
require('dotenv').config();

async function main() {
    console.log('🎯 Starting market resolution process...');

    // Contract addresses
    const MARKET_MANAGER_ADDRESS = process.env.NEXT_PUBLIC_P2P_MARKETMANAGER_ADDRESS;
    const VERIFICATION_ADDRESS = process.env.NEXT_PUBLIC_P2P_VERIFICATION_ADDRESS;
    const ANALYTICS_ADDRESS = process.env.NEXT_PUBLIC_P2P_ANALYTICS_ADDRESS;
    const P2P_TOKEN_ADDRESS = process.env.NEXT_PUBLIC_P2P_TOKEN_ADDRESS;

    // Private keys for verifiers
    const PRIVATE_KEY = process.env.PRIVATE_KEY;
    const KEY_ONE = process.env.KEY_ONE;
    const KEY_TWO = process.env.KEY_TWO;

    if (!MARKET_MANAGER_ADDRESS || !VERIFICATION_ADDRESS || !ANALYTICS_ADDRESS || !PRIVATE_KEY || !KEY_ONE || !KEY_TWO) {
        throw new Error('Missing required environment variables');
    }

    // Create providers and signers using hardhat network
    const [signer1] = await ethers.getSigners();
    const provider = signer1.provider;
    const signer2 = new ethers.Wallet(KEY_ONE, provider);
    const signer3 = new ethers.Wallet(KEY_TWO, provider);

    console.log('📝 Signer addresses:');
    console.log('   Verifier 1:', signer1.address);
    console.log('   Verifier 2:', signer2.address);
    console.log('   Verifier 3:', signer3.address);

    // Contract ABIs
    const marketManagerABI = [
        "function getNextMarketId() external view returns (uint256)",
        "function getMarket(uint256 marketId) external view returns (tuple(address creator, string ipfsHash, bool isMultiOption, uint256 maxOptions, address paymentToken, uint256 minStake, uint256 creatorDeposit, uint256 creatorOutcome, uint256 startTime, uint256 endTime, uint256 resolutionEndTime, uint8 state, uint256 winningOption, bool isResolved))"
    ];

    const verificationABI = [
        "function castVote(uint256 marketId, uint256 option) external",
        "function getVoteCount(uint256 marketId, uint256 option) external view returns (uint256)",
        "function hasVerifierVoted(uint256 marketId, uint256 option, address verifier) external view returns (bool)"
    ];

    const analyticsABI = [
        "function getMarketsByState(uint8 state) external view returns (uint256[] memory)"
    ];

    const marketManager = new ethers.Contract(MARKET_MANAGER_ADDRESS, marketManagerABI, signer1);
    const verification1 = new ethers.Contract(VERIFICATION_ADDRESS, verificationABI, signer1);
    const verification2 = new ethers.Contract(VERIFICATION_ADDRESS, verificationABI, signer2);
    const verification3 = new ethers.Contract(VERIFICATION_ADDRESS, verificationABI, signer3);
    const analytics = new ethers.Contract(ANALYTICS_ADDRESS, analyticsABI, signer1);

    // Get ended markets using analytics contract
    console.log('\n📊 Getting ended markets...');
    const endedMarketIds = await analytics.getMarketsByState(1); // State 1 = Ended
    const endedMarkets = endedMarketIds.map(id => Number(id));
    console.log('📋 Ended markets:', endedMarkets);

    if (endedMarkets.length === 0) {
        console.log('❌ No ended markets to resolve');
        return;
    }

    // Define resolution strategy based on our betting scenarios
    const resolutionStrategy = {
        5: { winningOption: 2, description: "Bitcoin $100K - Creator wins (bet 'No'), others lose (bet 'Yes')" },
        6: { winningOption: 2, description: "Ethereum Gas Fees - Creator loses (bet 'Yes'), others win (bet 'No')" },
        7: { winningOption: 2, description: "PEPE Exchange Listing - Everyone wins including creator (all bet 'No')" },
        8: { winningOption: 4, description: "Crypto Sector Performance - Everyone loses including creator (resolve 'AI & Gaming Tokens' instead of 'Meme Coins')" }
    };

    // Resolve each market
    for (const marketId of endedMarkets) {
        const marketIdNum = Number(marketId);
        console.log(`\n📊 Resolving Market ${marketIdNum}...`);

        try {
            // Get market details
            const market = await marketManager.getMarket(marketId);
            console.log(`   State: ${market.state} (0=Active, 1=Ended, 2=Resolved, 3=Cancelled, 4=Deleted)`);
            console.log(`   Is Multi-Option: ${market.isMultiOption}`);
            console.log(`   Max Options: ${market.maxOptions}`);
            console.log(`   Creator Outcome: ${market.creatorOutcome}`);

            // Check if market is already resolved
            if (market.state === 2n) {
                console.log(`   ✅ Market ${marketIdNum} already resolved with option ${market.winningOption}`);
                continue;
            }

            // Check if market is ended
            if (market.state !== 1n) {
                console.log(`   ⚠️  Market ${marketIdNum} is not in ended state, skipping...`);
                continue;
            }

            // Get resolution strategy
            const strategy = resolutionStrategy[marketIdNum];
            if (!strategy) {
                console.log(`   ⚠️  No resolution strategy for market ${marketIdNum}, skipping...`);
                continue;
            }

            console.log(`   🎯 Strategy: ${strategy.description}`);
            console.log(`   🏆 Voting for winning option: ${strategy.winningOption}`);

            // Vote with all three verifiers
            console.log(`   📝 Verifier 1 voting...`);
            const tx1 = await verification1.castVote(marketId, strategy.winningOption);
            console.log(`   📋 Transaction 1: ${tx1.hash}`);
            await tx1.wait();

            console.log(`   📝 Verifier 2 voting...`);
            const tx2 = await verification2.castVote(marketId, strategy.winningOption);
            console.log(`   📋 Transaction 2: ${tx2.hash}`);
            await tx2.wait();

            console.log(`   📝 Verifier 3 voting...`);
            const tx3 = await verification3.castVote(marketId, strategy.winningOption);
            console.log(`   📋 Transaction 3: ${tx3.hash}`);
            await tx3.wait();

            console.log(`   ✅ Market ${marketIdNum} voted on successfully!`);

        } catch (error) {
            console.log(`   ❌ Failed to vote on market ${marketIdNum}: ${error.message}`);
        }
    }

    console.log('\n🎉 Market resolution process completed!');
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });