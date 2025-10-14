const { ethers } = require("hardhat");

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
    const PoolVault = await ethers.getContractFactory("PoolVault");
    const vault = await PoolVault.deploy(deployer.address, deployer.address);
    await vault.waitForDeployment();
    const vaultAddress = await vault.getAddress();
    console.log("✅ PoolVault deployed to:", vaultAddress);

    // 4. Deploy ValidationCore
    console.log("\n4. Deploying ValidationCore...");
    const ValidationCore = await ethers.getContractFactory("ValidationCore");
    const validationCore = await ValidationCore.deploy(deployer.address);
    await validationCore.waitForDeployment();
    const validationAddress = await validationCore.getAddress();
    console.log("✅ ValidationCore deployed to:", validationAddress);

    // 5. Deploy MetricsHub (Analytics)
    console.log("\n5. Deploying MetricsHub (Analytics)...");
    const MetricsHub = await ethers.getContractFactory("MetricsHub");
    const metricsHub = await MetricsHub.deploy(deployer.address, ethers.ZeroAddress);
    await metricsHub.waitForDeployment();
    const analyticsAddress = await metricsHub.getAddress();
    console.log("✅ MetricsHub deployed to:", analyticsAddress);

    // 6. Deploy EventPool with AdminManager address
    console.log("\n6. Deploying EventPool (MarketManager)...");
    const EventPool = await ethers.getContractFactory("EventPool");
    const eventPool = await EventPool.deploy(
        deployer.address,
        vaultAddress,
        adminManagerAddress
    );
    await eventPool.waitForDeployment();
    const marketManagerAddress = await eventPool.getAddress();
    console.log("✅ EventPool deployed to:", marketManagerAddress);

    // 7. Link EventPool to AdminManager
    console.log("\n7. Linking EventPool to AdminManager...");
    const setEventPoolTx = await adminManager.setEventPool(marketManagerAddress);
    await setEventPoolTx.wait();
    console.log("✅ EventPool linked to AdminManager");

    // 8. Set Analytics and Verification in AdminManager
    console.log("\n8. Setting Analytics in AdminManager...");
    const setAnalyticsTx = await adminManager.setAnalytics(analyticsAddress);
    await setAnalyticsTx.wait();
    console.log("✅ Analytics set in AdminManager");
    
    console.log("\n9. Setting Verification in AdminManager...");
    const setVerificationTx = await adminManager.setVerification(validationAddress);
    await setVerificationTx.wait();
    console.log("✅ Verification set in AdminManager");

    // 10. Set MarketManager in Treasury
    console.log("\n10. Setting MarketManager in Treasury...");
    const setMarketManagerTx = await vault.setMarketManager(marketManagerAddress);
    await setMarketManagerTx.wait();
    console.log("✅ MarketManager set in Treasury");

    // 11. Set MarketManager in ValidationCore
    console.log("\n11. Setting MarketManager in ValidationCore...");
    const setValidationMarketManagerTx = await validationCore.setMarketManager(marketManagerAddress);
    await setValidationMarketManagerTx.wait();
    console.log("✅ MarketManager set in ValidationCore");

    // 12. Set MarketManager in Analytics
    console.log("\n12. Setting MarketManager in Analytics...");
    const setAnalyticsMarketManagerTx = await metricsHub.setMarketManager(marketManagerAddress);
    await setAnalyticsMarketManagerTx.wait();
    console.log("✅ MarketManager set in Analytics");

    // 13. Add P2P Token via AdminManager
    console.log("\n13. Adding P2P Token via AdminManager...");
    const addTokenTx = await adminManager.addSupportedToken(poolTokenAddress, "P2P");
    await addTokenTx.wait();
    console.log("✅ P2P Token added as supported token");

    // 14. Add verifiers to ValidationCore
    console.log("\n14. Adding verifiers to ValidationCore...");
    const verifiers = [
        "0x62942BbBb86482bFA0C064d0262E23Ca04ea99C5"
    ];

    for (const verifier of verifiers) {
        try {
            const addVerifierTx = await validationCore.addVerifier(verifier);
            await addVerifierTx.wait();
            console.log(`✅ Verifier added: ${verifier}`);
        } catch (error) {
            console.log(`⚠️  Verifier ${verifier} might already exist or failed:`, error.message);
        }
    }

    // 15. Verify contract parameters
    console.log("\n15. Verifying contract parameters...");
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
    console.log(`ValidationCore: ${validationAddress}`);
    console.log(`MetricsHub (Analytics): ${analyticsAddress}`);
    console.log(`EventPool (MarketManager): ${marketManagerAddress}`);

    console.log("\n📝 Add to your .env file:");
    console.log(`NEXT_PUBLIC_P2P_ADMIN_ADDRESS=${adminManagerAddress}`);
    console.log(`NEXT_PUBLIC_P2P_TOKEN_ADDRESS=${poolTokenAddress}`);
    console.log(`NEXT_PUBLIC_P2P_TREASURY_ADDRESS=${vaultAddress}`);
    console.log(`NEXT_PUBLIC_P2P_VERIFICATION_ADDRESS=${validationAddress}`);
    console.log(`NEXT_PUBLIC_P2P_ANALYTICS_ADDRESS=${analyticsAddress}`);
    console.log(`NEXT_PUBLIC_P2P_MARKET_MANAGER_ADDRESS=${marketManagerAddress}`);

    console.log("\n✨ System Features:");
    console.log("• AdminManager contract for all admin functions");
    console.log("• Token whitelist management via AdminManager");
    console.log("• Wallet blacklist management via AdminManager");
    console.log("• Market deletion via AdminManager");
    console.log("• Settable minimum market duration");
    console.log("• Settable staking restrictions");
    console.log("• Fixed fee distribution");
    console.log("• P2P Token support");
    console.log("• Multiple verifiers");
    console.log("• All contracts properly linked");

    console.log("\n🔧 Next Steps:");
    console.log("1. Update your .env file with the contract addresses above");
    console.log("2. Restart your frontend application");
    console.log("3. For admin tasks, interact with AdminManager contract");
    console.log("4. Test market creation via EventPool");
    console.log("5. Test market deletion via AdminManager.deleteMarket()");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });