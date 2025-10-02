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

    // 2. Deploy PoolVault (Treasury)
    console.log("\n2. Deploying PoolVault (Treasury)...");
    const PoolVault = await ethers.getContractFactory("PoolVault");
    const vault = await PoolVault.deploy(deployer.address, deployer.address); // Partner = deployer for now
    await vault.waitForDeployment();
    const vaultAddress = await vault.getAddress();
    console.log("✅ PoolVault deployed to:", vaultAddress);

    // 3. Deploy ValidationCore
    console.log("\n3. Deploying ValidationCore...");
    const ValidationCore = await ethers.getContractFactory("ValidationCore");
    const validationCore = await ValidationCore.deploy(deployer.address);
    await validationCore.waitForDeployment();
    const validationAddress = await validationCore.getAddress();
    console.log("✅ ValidationCore deployed to:", validationAddress);

    // 4. Deploy MetricsHub (Analytics)
    console.log("\n4. Deploying MetricsHub (Analytics)...");
    const MetricsHub = await ethers.getContractFactory("MetricsHub");
    const metricsHub = await MetricsHub.deploy(deployer.address, ethers.ZeroAddress); // Set MarketManager later
    await metricsHub.waitForDeployment();
    const analyticsAddress = await metricsHub.getAddress();
    console.log("✅ MetricsHub deployed to:", analyticsAddress);

    // 5. Deploy EventPool (MarketManager)
    console.log("\n5. Deploying EventPool (MarketManager)...");
    const EventPool = await ethers.getContractFactory("EventPool");
    const eventPool = await EventPool.deploy(
        deployer.address,
        vaultAddress,
        validationAddress,
        analyticsAddress,
        MARKET_CREATION_FEE
    );
    await eventPool.waitForDeployment();
    const marketManagerAddress = await eventPool.getAddress();
    console.log("✅ EventPool deployed to:", marketManagerAddress);

    // 6. Set MarketManager in Treasury
    console.log("\n6. Setting MarketManager in Treasury...");
    const setMarketManagerTx = await vault.setMarketManager(marketManagerAddress);
    await setMarketManagerTx.wait();
    console.log("✅ MarketManager set in Treasury");

    // 7. Set MarketManager in ValidationCore
    console.log("\n7. Setting MarketManager in ValidationCore...");
    const setValidationMarketManagerTx = await validationCore.setMarketManager(marketManagerAddress);
    await setValidationMarketManagerTx.wait();
    console.log("✅ MarketManager set in ValidationCore");

    // 8. Set MarketManager in Analytics
    console.log("\n8. Setting MarketManager in Analytics...");
    const setAnalyticsMarketManagerTx = await metricsHub.setMarketManager(marketManagerAddress);
    await setAnalyticsMarketManagerTx.wait();
    console.log("✅ MarketManager set in Analytics");

    // 9. Add existing P2P Token as supported token
    console.log("\n9. Adding existing P2P Token as supported token...");
    const addTokenTx = await eventPool.addSupportedToken(poolTokenAddress, "P2P");
    await addTokenTx.wait();
    console.log("✅ Existing P2P Token added as supported token");

    // 10. Add verifiers to ValidationCore
    console.log("\n10. Adding verifiers to ValidationCore...");
    const verifiers = [
        "0x62942BbBb86482bFA0C064d0262E23Ca04ea99C5", // Deployer
        "0xf4d502bb2aF3ec63C6F5b982C34A09E96a710bA3", // Additional verifier 1
        "0x1234567890123456789012345678901234567890"  // Additional verifier 2
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

    // 11. Verify contract parameters
    console.log("\n11. Verifying contract parameters...");
    const minDuration = await eventPool.minMarketDurationMinutes();
    const stakingRestrictionEnabled = await eventPool.bettingRestrictionEnabled();
    const stakingRestrictionMinutes = await eventPool.bettingRestrictionMinutes();
    const isP2PTokenSupported = await eventPool.supportedTokens(poolTokenAddress);
    const p2pTokenSymbol = await eventPool.tokenSymbols(poolTokenAddress);

    console.log("Min Market Duration:", minDuration.toString(), "minutes");
    console.log("Staking Restriction Enabled:", stakingRestrictionEnabled);
    console.log("Staking Restriction Minutes:", stakingRestrictionMinutes.toString());
    console.log("P2P Token Supported:", isP2PTokenSupported);
    console.log("P2P Token Symbol:", p2pTokenSymbol);

    console.log("\n🎉 Deployment Complete!");

    console.log("\n📋 Contract Addresses:");
    console.log(`P2P Token (Existing): ${poolTokenAddress}`);
    console.log(`PoolVault (Treasury): ${vaultAddress}`);
    console.log(`ValidationCore: ${validationAddress}`);
    console.log(`MetricsHub (Analytics): ${analyticsAddress}`);
    console.log(`EventPool (MarketManager): ${marketManagerAddress}`);

    console.log("\n📝 Add to your .env file:");
    console.log(`NEXT_PUBLIC_P2P_TOKEN_ADDRESS=${poolTokenAddress}`);
    console.log(`NEXT_PUBLIC_P2P_TREASURY_ADDRESS=${vaultAddress}`);
    console.log(`NEXT_PUBLIC_P2P_VERIFICATION_ADDRESS=${validationAddress}`);
    console.log(`NEXT_PUBLIC_P2P_ANALYTICS_ADDRESS=${analyticsAddress}`);
    console.log(`NEXT_PUBLIC_P2P_MARKET_MANAGER_ADDRESS=${marketManagerAddress}`);

    console.log("\n✨ System Features:");
    console.log("• Fixed fee distribution bug");
    console.log("• Settable minimum market duration (default: 5 minutes)");
    console.log("• Settable staking restrictions (default: disabled)");
    console.log("• P2P Token support");
    console.log("• Multiple verifiers");
    console.log("• All contracts properly linked");

    console.log("\n🔧 Next Steps:");
    console.log("1. Update your .env file with the new addresses");
    console.log("2. Restart your frontend application");
    console.log("3. Test market creation and resolution");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });