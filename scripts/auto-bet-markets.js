const { ethers } = require('hardhat');
require('dotenv').config();

async function main() {
    console.log('🎯 Starting automated betting on markets...\n');

    // Get private keys from environment
    const KEY_ONE = process.env.KEY_ONE;
    const KEY_TWO = process.env.KEY_TWO;
    
    if (!KEY_ONE || !KEY_TWO) {
        throw new Error('❌ Missing required environment variables: KEY_ONE and KEY_TWO');
    }

    // Contract addresses
    const MARKET_MANAGER_ADDRESS = process.env.NEXT_PUBLIC_P2P_MARKETMANAGER_ADDRESS;
    const P2P_TOKEN_ADDRESS = process.env.NEXT_PUBLIC_P2P_TOKEN_ADDRESS;
    
    if (!MARKET_MANAGER_ADDRESS || !P2P_TOKEN_ADDRESS) {
        throw new Error('❌ Missing required environment variables');
    }

    console.log('🏦 Market Manager address:', MARKET_MANAGER_ADDRESS);
    console.log('🪙 P2P Token address:', P2P_TOKEN_ADDRESS);

    // Create providers and wallets
    const provider = new ethers.JsonRpcProvider('https://rpc-pepu-v2-mainnet-0.t.conduit.xyz');
    const wallet1 = new ethers.Wallet(KEY_ONE, provider);
    const wallet2 = new ethers.Wallet(KEY_TWO, provider);

    console.log('👤 Wallet 1 address:', wallet1.address);
    console.log('👤 Wallet 2 address:', wallet2.address);

    // Contract ABIs
    const marketManagerABI = [
        "function getNextMarketId() external view returns (uint256)",
        "function getMarket(uint256 marketId) external view returns (tuple(address creator, string ipfsHash, bool isMultiOption, uint256 maxOptions, address paymentToken, uint256 minStake, uint256 creatorDeposit, uint256 creatorOutcome, uint256 startTime, uint256 endTime, uint256 resolutionEndTime, uint8 state, uint256 winningOption, bool isResolved))",
        "function placeBet(uint256 marketId, uint256 option) external payable",
        "function placeBetWithToken(uint256 marketId, uint256 option, uint256 amount) external"
    ];

    const tokenABI = [
        "function approve(address spender, uint256 amount) external returns (bool)",
        "function balanceOf(address account) external view returns (uint256)",
        "function decimals() external view returns (uint8)"
    ];

    const marketManager1 = new ethers.Contract(MARKET_MANAGER_ADDRESS, marketManagerABI, wallet1);
    const marketManager2 = new ethers.Contract(MARKET_MANAGER_ADDRESS, marketManagerABI, wallet2);
    const p2pToken1 = new ethers.Contract(P2P_TOKEN_ADDRESS, tokenABI, wallet1);
    const p2pToken2 = new ethers.Contract(P2P_TOKEN_ADDRESS, tokenABI, wallet2);

    // Get total markets
    const nextMarketId = await marketManager1.getNextMarketId();
    console.log('📊 Total markets:', nextMarketId.toString());

    // Define betting strategy for each market
    const bettingStrategy = [
        // Market 5: Bitcoin $100k (Creator bets "No" - WINS)
        // Strategy: Everyone bets "Yes" (wrong) - Creator wins, everyone loses
        {
            marketId: 5,
            wallet1Bet: { option: 1, amount: ethers.parseEther("300") }, // Bet "Yes" (wrong) - min stake
            wallet2Bet: { option: 1, amount: ethers.parseEther("350") }, // Bet "Yes" (wrong) - above min
            description: "Everyone bets YES (wrong) - Creator wins, everyone loses"
        },
        // Market 6: Ethereum Gas Fees (Creator bets "Yes" - LOSES) 
        // Strategy: Everyone bets "No" (correct) - Everyone wins, creator loses
        {
            marketId: 6,
            wallet1Bet: { option: 2, amount: ethers.parseEther("400") }, // Bet "No" (correct) - min stake
            wallet2Bet: { option: 2, amount: ethers.parseEther("450") }, // Bet "No" (correct) - above min
            description: "Everyone bets NO (correct) - Everyone wins, creator loses"
        },
        // Market 7: PEPE Exchange Listing (Creator bets "No" - WINS)
        // Strategy: Everyone bets "No" (correct) - Everyone wins including creator
        {
            marketId: 7,
            wallet1Bet: { option: 2, amount: ethers.parseUnits("700", 18) }, // Bet "No" (correct) - min stake
            wallet2Bet: { option: 2, amount: ethers.parseUnits("800", 18) }, // Bet "No" (correct) - above min
            description: "Everyone bets NO (correct) - Everyone wins including creator"
        },
        // Market 8: Crypto Sector Performance (Creator bets "Meme Coins" - WINS)
        // Strategy: Everyone bets on wrong options - NO ONE ELSE bets on "Meme Coins" (option 3 - correct)
        // Result: Only creator wins, everyone else loses - But we want everyone to lose
        // So we need to change the resolution to make "Meme Coins" the wrong answer
        {
            marketId: 8,
            wallet1Bet: { option: 1, amount: ethers.parseUnits("1000", 18) }, // Bet "DeFi Protocols" - min stake
            wallet2Bet: { option: 2, amount: ethers.parseUnits("1100", 18) }, // Bet "Layer 1 Blockchains" - above min
            description: "Everyone bets wrong options - Creator will win unless we resolve differently"
        }
    ];

    // Execute betting strategy
    for (const strategy of bettingStrategy) {
        console.log(`\n📊 Market ${strategy.marketId}: ${strategy.description}`);
        
        try {
            // Get market info
            const market = await marketManager1.getMarket(strategy.marketId);
            console.log(`   Market state: ${market.state} (0=Active, 1=Ended, 2=Resolved, 3=Cancelled, 4=Deleted)`);
            console.log(`   Market state type: ${typeof market.state}, value: ${market.state}`);
            
            if (market.state !== 0n) {
                console.log(`   ⚠️  Market ${strategy.marketId} is not active, skipping...`);
                continue;
            }

            // Wallet 1 betting
            console.log(`   🎯 Wallet 1 betting ${ethers.formatEther(strategy.wallet1Bet.amount)} on option ${strategy.wallet1Bet.option}...`);
            
            if (market.paymentToken === ethers.ZeroAddress) {
                // PEPU market
                const tx1 = await marketManager1.placeBet(
                    strategy.marketId,
                    strategy.wallet1Bet.option,
                    { value: strategy.wallet1Bet.amount }
                );
                console.log(`   📋 Wallet 1 transaction: ${tx1.hash}`);
                await tx1.wait();
                console.log(`   ✅ Wallet 1 bet successful!`);
            } else {
                // P2P token market
                const approveTx1 = await p2pToken1.approve(MARKET_MANAGER_ADDRESS, strategy.wallet1Bet.amount);
                await approveTx1.wait();
                
                const tx1 = await marketManager1.placeBetWithToken(
                    strategy.marketId,
                    strategy.wallet1Bet.option,
                    strategy.wallet1Bet.amount
                );
                console.log(`   📋 Wallet 1 transaction: ${tx1.hash}`);
                await tx1.wait();
                console.log(`   ✅ Wallet 1 bet successful!`);
            }

            // Wallet 2 betting
            console.log(`   🎯 Wallet 2 betting ${ethers.formatEther(strategy.wallet2Bet.amount)} on option ${strategy.wallet2Bet.option}...`);
            
            if (market.paymentToken === ethers.ZeroAddress) {
                // PEPU market
                const tx2 = await marketManager2.placeBet(
                    strategy.marketId,
                    strategy.wallet2Bet.option,
                    { value: strategy.wallet2Bet.amount }
                );
                console.log(`   📋 Wallet 2 transaction: ${tx2.hash}`);
                await tx2.wait();
                console.log(`   ✅ Wallet 2 bet successful!`);
            } else {
                // P2P token market
                const approveTx2 = await p2pToken2.approve(MARKET_MANAGER_ADDRESS, strategy.wallet2Bet.amount);
                await approveTx2.wait();
                
                const tx2 = await marketManager2.placeBetWithToken(
                    strategy.marketId,
                    strategy.wallet2Bet.option,
                    strategy.wallet2Bet.amount
                );
                console.log(`   📋 Wallet 2 transaction: ${tx2.hash}`);
                await tx2.wait();
                console.log(`   ✅ Wallet 2 bet successful!`);
            }

        } catch (error) {
            console.error(`   ❌ Failed to bet on market ${strategy.marketId}:`, error.message);
        }
    }

    console.log('\n🎉 Automated betting completed!');
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('💥 Script failed:', error);
        process.exit(1);
    });