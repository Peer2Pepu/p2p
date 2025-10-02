const { ethers } = require('hardhat');
require('dotenv').config();

async function main() {
    console.log('🚀 Creating test market for frontend...\n');

    // Get the signer
    const [signer] = await ethers.getSigners();
    console.log('📝 Signer address:', signer.address);

    // Contract addresses from environment
    const MARKET_MANAGER_ADDRESS = process.env.NEXT_PUBLIC_P2P_MARKET_MANAGER_ADDRESS;
    
    if (!MARKET_MANAGER_ADDRESS) {
        throw new Error('❌ Missing required environment variables');
    }

    console.log('🏦 Market Manager address:', MARKET_MANAGER_ADDRESS);

    // Market Manager ABI
    const marketManagerABI = [
        "function createMarket(string memory ipfsHash, bool isMultiOption, uint256 maxOptions, address paymentToken, uint256 minStake, uint256 creatorDeposit, uint256 creatorOutcome, uint256 stakeDurationMinutes, uint256 resolutionDurationMinutes) external payable returns (uint256)",
        "function marketCreationFee() external view returns (uint256)",
        "function owner() external view returns (address)"
    ];

    const marketManager = new ethers.Contract(MARKET_MANAGER_ADDRESS, marketManagerABI, signer);

    // Get creation fee
    const creationFee = await marketManager.marketCreationFee();
    console.log('💰 Market creation fee:', ethers.formatEther(creationFee), 'PEPU');

    // Market data
    const market = {
        title: "Will PEPU reach $1 by end of 2024?",
        description: "PEPU token price prediction for end of year 2024",
        categories: ["Cryptocurrency", "PEPU", "Price Prediction"],
        outcomeType: "binary",
        multipleOptions: ["Yes", "No"],
        paymentToken: ethers.ZeroAddress, // Use PEPU (native)
        minStake: ethers.parseEther("1"), // 1 PEPU minimum
        creatorDeposit: ethers.parseEther("10"), // 10 PEPU creator deposit
        creatorOutcome: 0, // Creator bets on "Yes"
        stakeDurationMinutes: 7 * 24 * 60, // 7 days staking
        resolutionDurationMinutes: 30 * 24 * 60 // 30 days resolution
    };

    console.log(`\n📊 Creating market: ${market.title}`);
    
    try {
        // Use mock IPFS hash
        const ipfsHash = `QmTestMarket${Date.now()}`;
        console.log('   ✅ Mock IPFS Hash:', ipfsHash);

        // Calculate total PEPU needed
        const totalNeeded = market.creatorDeposit + market.minStake;
        console.log('   💰 Total PEPU needed:', ethers.formatEther(totalNeeded));

        // Create market
        console.log('   🏗️ Creating market...');
        const createTx = await marketManager.createMarket(
            ipfsHash,
            false, // isMultiOption (binary)
            market.multipleOptions.length, // maxOptions
            market.paymentToken,
            market.minStake,
            market.creatorDeposit,
            market.creatorOutcome,
            market.stakeDurationMinutes,
            market.resolutionDurationMinutes,
            { value: totalNeeded } // Send PEPU with transaction
        );

        const receipt = await createTx.wait();
        console.log('   📋 Transaction hash:', receipt.hash);
        
        // Get market ID from event
        const marketCreatedEvent = receipt.logs.find(log => {
            try {
                const parsed = marketManager.interface.parseLog(log);
                return parsed.name === 'MarketCreated';
            } catch (e) {
                return false;
            }
        });

        if (marketCreatedEvent) {
            const parsed = marketManager.interface.parseLog(marketCreatedEvent);
            console.log('   🎉 Market created with ID:', parsed.args.marketId.toString());
            console.log('   📅 Stake ends in:', market.stakeDurationMinutes / (24 * 60), 'days');
            console.log('   📅 Market resolves in:', market.resolutionDurationMinutes / (24 * 60), 'days');
        }

        console.log('\n✅ Market creation successful!');

    } catch (error) {
        console.error('   ❌ Failed to create market:', error.message);
        throw error;
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('💥 Script failed:', error);
        process.exit(1);
    });