const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("🚀 Deploying P2P Prediction Market System...");
    console.log("Deploying contracts with account:", deployer.address);
    console.log("Account balance:", ethers.formatEther(await deployer.provider.getBalance(deployer.address)), "ETH");

    // Configuration
    const MARKET_CREATION_FEE = ethers.parseEther("1"); // 1 PEPU creation fee

    console.log("\n📋 Deployment Configuration:");
    console.log("Market Creation Fee:", ethers.formatEther(MARKET_CREATION_FEE), "PEPU");

    // 1. Use existing P2P Token
    console.log("\n1. Using existing P2P Token...");
    const poolTokenAddress = "0x28dD14D951cc1b9fF32bDc27DCC7dA04FbfE3aF6";
    console.log("✅ Using existing P2P Token at:", poolTokenAddress);

    // 2. Deploy AdminManager FIRST
    console.log("\n2. Deploying AdminManager...");
    const AdminManager = await ethers.getContractFactory("AdminManager");
    const adminManager = await AdminManager.deploy(deployer.address);
    await adminManager.waitForDeployment();
    const adminManagerAddress = await adminManager.getAddress();
    console.log("✅ AdminManager deployed to:", adminManagerAddress);

    // 3. Deploy PoolVault (Treasury)
    console.log("\n3. Deploying PoolVault (Treasury)...");
    const PARTNER_ADDRESS = "0x0a66fe87d80aa139b25d1b2f5f9961c09511a862";
    const PoolVault = await ethers.getContractFactory("PoolVault");
    const vault = await PoolVault.deploy(deployer.address, PARTNER_ADDRESS);
    await vault.waitForDeployment();
    const vaultAddress = await vault.getAddress();
    console.log("✅ PoolVault deployed to:", vaultAddress);

    // 4. Deploy MetricsHub (Analytics)
    console.log("\n4. Deploying MetricsHub (Analytics)...");
    const MetricsHub = await ethers.getContractFactory("MetricsHub");
    const metricsHub = await MetricsHub.deploy(deployer.address, ethers.ZeroAddress);
    await metricsHub.waitForDeployment();
    const analyticsAddress = await metricsHub.getAddress();
    console.log("✅ MetricsHub deployed to:", analyticsAddress);

    // 5. Deploy P2PMarketManager with AdminManager address
    console.log("\n5. Deploying P2PMarketManager...");
    const P2PMarketManager = await ethers.getContractFactory("P2PMarketManager");
    const marketManager = await P2PMarketManager.deploy(
        deployer.address,
        vaultAddress,
        adminManagerAddress
    );
    await marketManager.waitForDeployment();
    const marketManagerAddress = await marketManager.getAddress();
    console.log("✅ P2PMarketManager deployed to:", marketManagerAddress);

    // 6. Link P2PMarketManager to AdminManager
    console.log("\n6. Linking P2PMarketManager to AdminManager...");
    const setEventPoolTx = await adminManager.setEventPool(marketManagerAddress);
    await setEventPoolTx.wait();
    console.log("✅ P2PMarketManager linked to AdminManager");

    // 7. Set Analytics in AdminManager
    console.log("\n7. Setting Analytics in AdminManager...");
    const setAnalyticsTx = await adminManager.setAnalytics(analyticsAddress);
    await setAnalyticsTx.wait();
    console.log("✅ Analytics set in AdminManager");

    // 8. Set MarketManager in Treasury
    console.log("\n8. Setting MarketManager in Treasury...");
    const setMarketManagerTx = await vault.setMarketManager(marketManagerAddress);
    await setMarketManagerTx.wait();
    console.log("✅ MarketManager set in Treasury");

    // 9. Set MarketManager in Analytics
    console.log("\n9. Setting MarketManager in Analytics...");
    const setAnalyticsMarketManagerTx = await metricsHub.setMarketManager(marketManagerAddress);
    await setAnalyticsMarketManagerTx.wait();
    console.log("✅ MarketManager set in Analytics");

    // 10. Add P2P Token via AdminManager
    console.log("\n10. Adding P2P Token via AdminManager...");
    const addTokenTx = await adminManager.addSupportedToken(poolTokenAddress, "P2P");
    await addTokenTx.wait();
    console.log("✅ P2P Token added as supported token");

    // 11. Configure P2P Optimistic Oracle (using existing deployed addresses from oracle-docs.md)
    console.log("\n11. Configuring P2P Optimistic Oracle...");
    
    // Latest addresses from oracle-docs.md:
    // P2POptimisticOracleV2: 0xfd52d7EBa4Cfc72c8001c8512fBbFb4BAb043DA6
    // P2PVoting: 0x17e603B507E99CbceE1183Bb1A144b56F02921BF
    const P2P_OPTIMISTIC_ORACLE = "0xfd52d7EBa4Cfc72c8001c8512fBbFb4BAb043DA6";
    const P2P_VOTING = "0x17e603B507E99CbceE1183Bb1A144b56F02921BF";
    
    console.log("   Using P2P OptimisticOracleV2 address:", P2P_OPTIMISTIC_ORACLE);
    console.log("   Using P2P Voting address:", P2P_VOTING);
    
    // Set P2P OptimisticOracle address
    console.log("   Setting P2P OptimisticOracle:", P2P_OPTIMISTIC_ORACLE);
    const setOOTx = await marketManager.setOptimisticOracle(P2P_OPTIMISTIC_ORACLE);
    await setOOTx.wait();
    console.log("✅ P2P OptimisticOracle set");

    // Set default bond currency (P2P token)
    console.log("   Setting default bond currency (P2P token)...");
    const setBondCurrencyTx = await marketManager.setDefaultBondCurrency(poolTokenAddress);
    await setBondCurrencyTx.wait();
    console.log("✅ Default bond currency set:", poolTokenAddress);

    // 12. Display Price Feed Addresses (already deployed)
    console.log("\n12. Price Feed Addresses (already deployed on Pepe Unchained):");
    const priceFeeds = {
        "ETH/USD": "0x20D9BBEAE75d9E17176520aD473234BE293e4C5d",
        "BTC/USD": "0xA74CCEe7759c7bb2cE3f0b1599428fed08FaB8Ce",
        "SOL/USD": "0x786BE298CFfF15c49727C0998392Ff38e45f99b3",
        "PEPU/USD": "0x51C17E20994C6c0eE787fE1604ef14EBafdB7ce9"
    };
    for (const [name, address] of Object.entries(priceFeeds)) {
        console.log(`   ${name}: ${address}`);
    }

    // 13. Verify contract parameters
    console.log("\n13. Verifying contract parameters...");
    const minDuration = await adminManager.minMarketDurationMinutes();
    const stakingRestrictionEnabled = await adminManager.bettingRestrictionEnabled();
    const stakingRestrictionMinutes = await adminManager.bettingRestrictionMinutes();
    const isP2PTokenSupported = await adminManager.supportedTokens(poolTokenAddress);
    const p2pTokenSymbol = await adminManager.tokenSymbols(poolTokenAddress);

    console.log("Min Market Duration:", minDuration.toString(), "minutes");
    console.log("Staking Restriction Enabled:", stakingRestrictionEnabled);
    console.log("Staking Restriction Minutes:", stakingRestrictionMinutes.toString());
    console.log("P2P Token Supported:", isP2PTokenSupported);
    console.log("P2P Token Symbol:", p2pTokenSymbol);

    console.log("\n🎉 Deployment Complete!");

    console.log("\n📋 Contract Addresses:");
    console.log(`AdminManager: ${adminManagerAddress}`);
    console.log(`P2P Token (Existing): ${poolTokenAddress}`);
    console.log(`PoolVault (Treasury): ${vaultAddress}`);
    console.log(`MetricsHub (Analytics): ${analyticsAddress}`);
    console.log(`P2PMarketManager: ${marketManagerAddress}`);
    console.log(`P2P OptimisticOracle: ${P2P_OPTIMISTIC_ORACLE}`);
    if (P2P_VOTING) {
        console.log(`P2P VotingV2: ${P2P_VOTING}`);
    }

    console.log("\n📝 Add to your .env file:");
    console.log(`NEXT_PUBLIC_P2P_ADMIN_ADDRESS=${adminManagerAddress}`);
    console.log(`NEXT_PUBLIC_P2P_TOKEN_ADDRESS=${poolTokenAddress}`);
    console.log(`NEXT_PUBLIC_P2P_TREASURY_ADDRESS=${vaultAddress}`);
    console.log(`NEXT_PUBLIC_P2P_ANALYTICS_ADDRESS=${analyticsAddress}`);
    console.log(`NEXT_PUBLIC_P2P_MARKET_MANAGER_ADDRESS=${marketManagerAddress}`);
    console.log(`P2P_OPTIMISTIC_ORACLE_ADDRESS=${P2P_OPTIMISTIC_ORACLE}`);
    if (P2P_VOTING) {
        console.log(`P2P_VOTING_V2_ADDRESS=${P2P_VOTING}`);
    }

    console.log("\n✨ System Features:");
    console.log("• AdminManager contract for all admin functions");
    console.log("• Token whitelist management via AdminManager");
    console.log("• Wallet blacklist management via AdminManager");
    console.log("• Market deletion via AdminManager");
    console.log("• Settable minimum market duration");
    console.log("• Settable staking restrictions");
    console.log("• Fixed fee distribution");
    console.log("• P2P Token support");
    console.log("• P2P Optimistic Oracle integration (for P2POPTIMISTIC markets)");
    console.log("• Price Feed integration (for PRICE_FEED markets)");
    console.log("• Direct price feed resolution (no oracle needed for price markets)");
    console.log("• All contracts properly linked");

    console.log("\n🔧 Next Steps:");
    console.log("1. Update your .env file with the contract addresses above");
    console.log("2. Restart your frontend application");
    console.log("3. For admin tasks, interact with AdminManager contract");
    console.log("4. Test market creation via EventPool (with marketType parameter)");
    console.log("5. Test PRICE_FEED market resolution (direct price feed read)");
    console.log("6. Test P2POPTIMISTIC market resolution:");
    console.log("   - Create market with MarketType.P2POPTIMISTIC");
    console.log("   - Call requestP2PResolution() after market ends");
    console.log("   - Optionally call disputeOracle() if needed");
    console.log("   - Call settleOracle() after dispute window");
    console.log("   - Call resolveP2PMarket() to finalize");
    console.log("7. Test market deletion via AdminManager.deleteMarket()");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });