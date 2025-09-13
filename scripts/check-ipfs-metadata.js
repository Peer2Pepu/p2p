const { ethers } = require("ethers");
require('dotenv').config();

async function main() {
    console.log("🔍 Checking IPFS metadata for markets...\n");

    // Get contract addresses from environment variables
    const marketManagerAddress = process.env.NEXT_PUBLIC_P2P_MARKETMANAGER_ADDRESS;

    if (!marketManagerAddress) {
        console.error("❌ NEXT_PUBLIC_P2P_MARKETMANAGER_ADDRESS not found in .env file");
        process.exit(1);
    }

    // Connect to the network using public RPC
    const provider = new ethers.JsonRpcProvider('https://rpc-pepu-v2-mainnet-0.t.conduit.xyz');
    
    // Contract ABI for the functions we need
    const contractABI = [
        "function getActiveMarkets() external view returns (uint256[])",
        "function getMarket(uint256 marketId) external view returns (tuple(address creator, string ipfsHash, bool isMultiOption, uint256 maxOptions, address paymentToken, uint256 minStake, uint256 creatorDeposit, uint256 creatorOutcome, uint256 startTime, uint256 endTime, uint256 resolutionEndTime, uint8 state, uint256 winningOption, bool isResolved))"
    ];

    const marketManager = new ethers.Contract(marketManagerAddress, contractABI, provider);

    try {
        // Get all active markets
        const activeMarkets = await marketManager.getActiveMarkets();
        console.log(`🟢 Found ${activeMarkets.length} active markets\n`);

        // Check IPFS metadata for each market
        for (let i = 0; i < Math.min(activeMarkets.length, 5); i++) { // Check first 5 markets
            const marketId = activeMarkets[i];
            try {
                // Get basic market info
                const market = await marketManager.getMarket(marketId);
                
                console.log(`\n🏷️  Market ID: ${marketId}`);
                console.log(`   IPFS Hash: ${market.ipfsHash}`);
                console.log(`   Is Multi-Option: ${market.isMultiOption}`);
                
                if (market.ipfsHash) {
                    try {
                        const ipfsUrl = `https://gateway.lighthouse.storage/ipfs/${market.ipfsHash}`;
                        console.log(`   IPFS URL: ${ipfsUrl}`);
                        
                        const response = await fetch(ipfsUrl);
                        if (response.ok) {
                            const metadata = await response.json();
                            console.log(`   Metadata:`, JSON.stringify(metadata, null, 2));
                            
                            if (metadata.categories) {
                                console.log(`   Categories: ${metadata.categories.join(', ')}`);
                            } else {
                                console.log(`   Categories: Not found`);
                            }
                        } else {
                            console.log(`   ❌ Failed to fetch metadata: ${response.status}`);
                        }
                    } catch (error) {
                        console.log(`   ❌ Error fetching IPFS metadata: ${error.message}`);
                    }
                } else {
                    console.log(`   ❌ No IPFS hash`);
                }

            } catch (error) {
                console.log(`\n❌ Error fetching market ${marketId}: ${error.message}`);
            }
        }

    } catch (error) {
        console.error("❌ Error:", error);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
