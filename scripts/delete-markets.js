const { ethers } = require('hardhat');
require('dotenv').config();

async function main() {
    console.log('🚀 Starting market deletion process...\n');

    // Get the signer
    const [signer] = await ethers.getSigners();
    console.log('📝 Signer address:', signer.address);

    // Contract addresses from environment
    const MARKET_MANAGER_ADDRESS = process.env.NEXT_PUBLIC_P2P_MARKETMANAGER_ADDRESS;
    
    if (!MARKET_MANAGER_ADDRESS) {
        throw new Error('❌ Missing required environment variable: NEXT_PUBLIC_P2P_MARKETMANAGER_ADDRESS');
    }

    console.log('🏦 Market Manager address:', MARKET_MANAGER_ADDRESS);

    // Get market manager contract instance
    const marketManagerABI = [
        "function getNextMarketId() external view returns (uint256)",
        "function getMarket(uint256 marketId) external view returns (tuple(address creator, string ipfsHash, bool isMultiOption, uint256 maxOptions, address paymentToken, uint256 minStake, uint256 creatorDeposit, uint256 creatorOutcome, uint256 startTime, uint256 endTime, uint256 resolutionEndTime, uint8 state, uint256 winningOption, bool isResolved))",
        "function deleteMarket(uint256 marketId, string memory reason) external",
        "function owner() external view returns (address)"
    ];
    
    const marketManager = new ethers.Contract(MARKET_MANAGER_ADDRESS, marketManagerABI, signer);

    // Check if signer is the owner
    const owner = await marketManager.owner();
    console.log('👑 Market Manager owner:', owner);
    
    if (signer.address.toLowerCase() !== owner.toLowerCase()) {
        throw new Error('❌ Signer is not the market manager owner! Only the owner can delete markets.');
    }

    // Get total number of markets
    const nextMarketId = await marketManager.getNextMarketId();
    console.log('📊 Total markets created:', nextMarketId.toString() - 1);

    if (nextMarketId.toString() === '1') {
        console.log('⚠️  No markets to delete!');
        return;
    }

    console.log('\n🔍 Checking all markets...\n');

    // Check each market
    for (let marketId = 1; marketId < Number(nextMarketId.toString()); marketId++) {
        try {
            const market = await marketManager.getMarket(marketId);
            
            console.log(`Market ${marketId}:`);
            console.log(`  Creator: ${market.creator}`);
            console.log(`  State: ${market.state} (0=Active, 1=Ended, 2=Resolved, 3=Cancelled, 4=Deleted)`);
            console.log(`  Payment Token: ${market.paymentToken}`);
            console.log(`  IPFS Hash: ${market.ipfsHash}`);
            console.log(`  Start Time: ${new Date(Number(market.startTime.toString()) * 1000).toLocaleString()}`);
            console.log(`  End Time: ${new Date(Number(market.endTime.toString()) * 1000).toLocaleString()}`);
            console.log('  ---');
            
        } catch (error) {
            console.log(`Market ${marketId}: Error reading market data - ${error.message}`);
        }
    }

    console.log('\n🗑️  Deleting all markets...\n');

    // Delete all markets
    for (let marketId = 1; marketId < Number(nextMarketId.toString()); marketId++) {
        try {
            console.log(`Deleting market ${marketId}...`);
            const tx = await marketManager.deleteMarket(marketId, "Cleaning up test markets");
            console.log(`   Transaction hash: ${tx.hash}`);
            await tx.wait();
            console.log(`   ✅ Market ${marketId} deleted successfully!`);
        } catch (error) {
            console.log(`   ❌ Failed to delete market ${marketId}: ${error.message}`);
        }
    }

    console.log('\n🎉 Market deletion process completed!');
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('💥 Script failed:', error);
        process.exit(1);
    });