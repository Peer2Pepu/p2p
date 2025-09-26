const { ethers } = require('hardhat');
require('dotenv').config();
const axios = require('axios');

async function main() {
    console.log('🚀 Starting automated market creation...\n');

    // Get the signer
    const [signer] = await ethers.getSigners();
    console.log('📝 Signer address:', signer.address);

    // Contract addresses from environment
    const MARKET_MANAGER_ADDRESS = process.env.NEXT_PUBLIC_P2P_MARKETMANAGER_ADDRESS;
    const P2P_TOKEN_ADDRESS = process.env.NEXT_PUBLIC_P2P_TOKEN_ADDRESS;
    
    if (!MARKET_MANAGER_ADDRESS || !P2P_TOKEN_ADDRESS) {
        throw new Error('❌ Missing required environment variables');
    }

    console.log('🏦 Market Manager address:', MARKET_MANAGER_ADDRESS);
    console.log('🪙 P2P Token address:', P2P_TOKEN_ADDRESS);

    // Market Manager ABI
    const marketManagerABI = [
        "function createMarket(string memory ipfsHash, bool isMultiOption, uint256 maxOptions, address paymentToken, uint256 minStake, uint256 creatorDeposit, uint256 creatorOutcome, uint256 durationMinutes) external payable returns (uint256)",
        "function marketCreationFee() external view returns (uint256)",
        "function owner() external view returns (address)"
    ];

    // P2P Token ABI for approval
    const tokenABI = [
        "function approve(address spender, uint256 amount) external returns (bool)",
        "function balanceOf(address account) external view returns (uint256)",
        "function decimals() external view returns (uint8)"
    ];

    const marketManager = new ethers.Contract(MARKET_MANAGER_ADDRESS, marketManagerABI, signer);
    const p2pToken = new ethers.Contract(P2P_TOKEN_ADDRESS, tokenABI, signer);

    // Get creation fee
    const creationFee = await marketManager.marketCreationFee();
    console.log('💰 Market creation fee:', ethers.formatEther(creationFee), 'PEPU');

    // Define market data
    const marketsData = [
        // 1. PEPU Binary Market (creator bets "No" - WINS)
        {
            title: "Will Bitcoin reach $100,000 by March 31, 2025?",
            description: "Bitcoin has been volatile recently. Will it pump to $100k by end of March 2025?",
            categories: ["Cryptocurrency", "Bitcoin", "Price Prediction"],
            outcomeType: "binary",
            paymentToken: ethers.ZeroAddress, // Native PEPU
            isMultiOption: false,
            maxOptions: 2,
            minStake: ethers.parseEther("300"), // 300 PEPU
            creatorDeposit: ethers.parseEther("500"), // 500 PEPU
            creatorOutcome: 2, // Bets on "No" (correct answer)
            duration: 10
        },
        // 2. PEPU Binary Market (creator bets "Yes" - LOSES)
        {
            title: "Will Ethereum's next upgrade cause gas fees to drop below $5?",
            description: "Ethereum upgrades usually promise lower fees. Will the next major upgrade actually deliver gas fees under $5?",
            categories: ["Cryptocurrency", "Ethereum", "Technology"],
            outcomeType: "binary",
            paymentToken: ethers.ZeroAddress, // Native PEPU
            isMultiOption: false,
            maxOptions: 2,
            minStake: ethers.parseEther("400"), // 400 PEPU
            creatorDeposit: ethers.parseEther("700"), // 700 PEPU
            creatorOutcome: 1, // Bets on "Yes" (wrong answer, "No" is correct)
            duration: 10
        },
        // 3. P2P Token Binary Market (creator bets "No" - WINS)
        {
            title: "Will any major exchange list PEPE coin in their spot trading in February 2025?",
            description: "Major exchanges like Binance, Coinbase, or Kraken adding PEPE to spot trading pairs.",
            categories: ["Cryptocurrency", "Exchanges", "Meme Coins"],
            outcomeType: "binary",
            paymentToken: P2P_TOKEN_ADDRESS,
            isMultiOption: false,
            maxOptions: 2,
            minStake: ethers.parseUnits("700", 18), // 700 P2P tokens
            creatorDeposit: ethers.parseUnits("3000", 18), // 3000 P2P tokens
            creatorOutcome: 2, // Bets on "No" (correct answer)
            duration: 10
        },
        // 4. P2P Token Multi-Option Market (creator bets on option 3 - WINS)
        {
            title: "Which crypto sector will perform best in Q1 2025?",
            description: "Different crypto sectors compete for dominance. Which will have the highest average gains in Q1 2025?",
            categories: ["Cryptocurrency", "Market Analysis", "Sectors"],
            outcomeType: "multiple",
            multipleOptions: ["DeFi Protocols", "Layer 1 Blockchains", "Meme Coins", "AI & Gaming Tokens"],
            paymentToken: P2P_TOKEN_ADDRESS,
            isMultiOption: true,
            maxOptions: 4,
            minStake: ethers.parseUnits("1000", 18), // 1000 P2P tokens
            creatorDeposit: ethers.parseUnits("5000", 18), // 5000 P2P tokens
            creatorOutcome: 1, // Bets on "DeFi Protocols" (wrong answer)
            duration: 10
        }
    ];

    // Upload to IPFS and create markets
    for (let i = 0; i < marketsData.length; i++) {
        const market = marketsData[i];
        
        console.log(`\n📊 Creating market ${i + 1}: ${market.title}`);
        
        try {
            // Upload to IPFS via API
            console.log('   📤 Uploading to IPFS...');
            const ipfsResponse = await axios.post('http://localhost:3001/api/upload-ipfs', {
                title: market.title,
                description: market.description,
                categories: market.categories,
                outcomeType: market.outcomeType,
                multipleOptions: market.multipleOptions || ["Yes", "No"]
            });

            if (!ipfsResponse.data.success) {
                throw new Error(`IPFS upload failed: ${ipfsResponse.data.error}`);
            }

            const ipfsHash = ipfsResponse.data.ipfsHash;
            console.log('   ✅ IPFS Hash:', ipfsHash);

            // Prepare transaction parameters
            let totalValue = creationFee;
            
            if (market.paymentToken === ethers.ZeroAddress) {
                // PEPU market: creation fee + creator deposit in ETH
                totalValue = creationFee + market.creatorDeposit;
                console.log('   💰 Total PEPU needed:', ethers.formatEther(totalValue));
            } else {
                // Token market: approve tokens, pay only creation fee in ETH
                console.log('   🔐 Approving P2P tokens...');
                const approveTx = await p2pToken.approve(MARKET_MANAGER_ADDRESS, market.creatorDeposit);
                await approveTx.wait();
                console.log('   ✅ Tokens approved');
                console.log('   💰 PEPU fee needed:', ethers.formatEther(totalValue));
                console.log('   💰 P2P tokens needed:', ethers.formatUnits(market.creatorDeposit, 18));
            }

            // Create market
            console.log('   🏗️  Creating market...');
            const tx = await marketManager.createMarket(
                ipfsHash,
                market.isMultiOption,
                market.maxOptions,
                market.paymentToken,
                market.minStake,
                market.creatorDeposit,
                market.creatorOutcome,
                market.duration,
                { value: totalValue }
            );

            console.log('   📋 Transaction hash:', tx.hash);
            const receipt = await tx.wait();
            
            // Extract market ID from events
            const marketCreatedEvent = receipt.logs.find(log => {
                try {
                    return marketManager.interface.parseLog(log).name === 'MarketCreated';
                } catch {
                    return false;
                }
            });

            if (marketCreatedEvent) {
                const parsedEvent = marketManager.interface.parseLog(marketCreatedEvent);
                console.log('   🎉 Market created! ID:', parsedEvent.args.marketId.toString());
            }

        } catch (error) {
            console.error(`   ❌ Failed to create market ${i + 1}:`, error.message);
        }
    }

    console.log('\n🎉 Automated market creation completed!');
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('💥 Script failed:', error);
        process.exit(1);
    });