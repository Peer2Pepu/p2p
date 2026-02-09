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

    // 5. Deploy EventPool with AdminManager address
    console.log("\n5. Deploying EventPool (MarketManager)...");
    const EventPool = await ethers.getContractFactory("EventPool");
    const eventPool = await EventPool.deploy(
        deployer.address,
        vaultAddress,
        adminManagerAddress
    );
    await eventPool.waitForDeployment();
    const marketManagerAddress = await eventPool.getAddress();
    console.log("✅ EventPool deployed to:", marketManagerAddress);

    // 6. Link EventPool to AdminManager
    console.log("\n6. Linking EventPool to AdminManager...");
    const setEventPoolTx = await adminManager.setEventPool(marketManagerAddress);
    await setEventPoolTx.wait();
    console.log("✅ EventPool linked to AdminManager");

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

    // 11. Configure UMA Optimistic Oracle (using existing deployed addresses)
    console.log("\n11. Configuring UMA Optimistic Oracle...");
    // UMA contracts are already deployed - try to find Finder address
    let UMA_FINDER = process.env.UMA_FINDER_ADDRESS || process.env.FINDER_ADDRESS || "";
    
    // Try to read from UMA deployment config if not in env
    if (!UMA_FINDER) {
        const umaConfigPath = path.join(__dirname, "..", "oracle", "p2p-oracle", "packages", "core", "networks", "97741.json");
        if (fs.existsSync(umaConfigPath)) {
            try {
                const umaConfig = JSON.parse(fs.readFileSync(umaConfigPath, "utf8"));
                UMA_FINDER = umaConfig.Finder || umaConfig.finder || "";
                if (UMA_FINDER) {
                    console.log("   Found Finder address from UMA config:", UMA_FINDER);
                }
            } catch (error) {
                console.log("   Could not read UMA config:", error.message);
            }
        }
    }
    
    const UMA_BOND_CURRENCY = poolTokenAddress; // Use P2P token as bond currency
    const UMA_BOND_AMOUNT = ethers.parseEther("1000"); // 1000 P2P tokens
    const UMA_LIVENESS = 7200; // 2 hours in seconds
    const UMA_IDENTIFIER = ethers.id("ASSERT_TRUTH"); // keccak256("ASSERT_TRUTH")

    // Set UMA Finder and OptimisticOracle
    const UMA_OPTIMISTIC_ORACLE = process.env.UMA_OPTIMISTIC_ORACLE_ADDRESS || "0x08134f53EA608Ef199DBa2E86340456D22b480B9";
    
    if (UMA_FINDER && UMA_FINDER !== "") {
        console.log("   Setting UMA Finder (already deployed):", UMA_FINDER);
        try {
            const setFinderTx = await eventPool.setFinder(UMA_FINDER);
            await setFinderTx.wait();
            const optimisticOracle = await eventPool.optimisticOracle();
            console.log("✅ UMA Finder set, OptimisticOracle auto-configured:", optimisticOracle);
        } catch (error) {
            console.log("⚠️  Could not auto-configure from Finder:", error.message);
            console.log("   Setting OptimisticOracle directly:", UMA_OPTIMISTIC_ORACLE);
            const setOOTx = await eventPool.setOptimisticOracle(UMA_OPTIMISTIC_ORACLE);
            await setOOTx.wait();
            console.log("✅ OptimisticOracle set directly");
        }
    } else {
        console.log("⚠️  UMA_FINDER_ADDRESS not found, setting OptimisticOracle directly");
        console.log("   Setting OptimisticOracle:", UMA_OPTIMISTIC_ORACLE);
        const setOOTx = await eventPool.setOptimisticOracle(UMA_OPTIMISTIC_ORACLE);
        await setOOTx.wait();
        console.log("✅ OptimisticOracle set directly");
        console.log("   You can set Finder later using: eventPool.setFinder(finderAddress)");
    }

    // Set default bond configuration
    console.log("   Setting default UMA bond configuration...");
    const setBondTx = await eventPool.setDefaultBond(UMA_BOND_CURRENCY, UMA_BOND_AMOUNT);
    await setBondTx.wait();
    console.log("✅ Default bond set:", ethers.formatEther(UMA_BOND_AMOUNT), "P2P tokens");

    const setLivenessTx = await eventPool.setDefaultLiveness(UMA_LIVENESS);
    await setLivenessTx.wait();
    console.log("✅ Default liveness set:", UMA_LIVENESS, "seconds (2 hours)");

    const setIdentifierTx = await eventPool.setDefaultIdentifier(UMA_IDENTIFIER);
    await setIdentifierTx.wait();
    console.log("✅ Default identifier set: ASSERT_TRUTH");

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
    console.log(`EventPool (MarketManager): ${marketManagerAddress}`);
    
    if (UMA_FINDER && UMA_FINDER !== "") {
        const optimisticOracle = await eventPool.optimisticOracle();
        console.log(`UMA Finder: ${UMA_FINDER}`);
        console.log(`UMA OptimisticOracle: ${optimisticOracle}`);
    }

    console.log("\n📝 Add to your .env file:");
    console.log(`NEXT_PUBLIC_P2P_ADMIN_ADDRESS=${adminManagerAddress}`);
    console.log(`NEXT_PUBLIC_P2P_TOKEN_ADDRESS=${poolTokenAddress}`);
    console.log(`NEXT_PUBLIC_P2P_TREASURY_ADDRESS=${vaultAddress}`);
    console.log(`NEXT_PUBLIC_P2P_ANALYTICS_ADDRESS=${analyticsAddress}`);
    console.log(`NEXT_PUBLIC_P2P_MARKET_MANAGER_ADDRESS=${marketManagerAddress}`);
    console.log(`# UMA_FINDER_ADDRESS=<finder_address_from_p2p-oracle_packages_core_networks_97741.json>`);
    console.log(`# Note: UMA contracts are already deployed - get Finder address from oracle deployment`);

    console.log("\n✨ System Features:");
    console.log("• AdminManager contract for all admin functions");
    console.log("• Token whitelist management via AdminManager");
    console.log("• Wallet blacklist management via AdminManager");
    console.log("• Market deletion via AdminManager");
    console.log("• Settable minimum market duration");
    console.log("• Settable staking restrictions");
    console.log("• Fixed fee distribution");
    console.log("• P2P Token support");
    console.log("• UMA Optimistic Oracle integration (for UMA_MANUAL markets)");
    console.log("• Price Feed integration (for PRICE_FEED markets)");
    console.log("• Direct price feed resolution (no UMA needed for price markets)");
    console.log("• All contracts properly linked");

    console.log("\n🔧 Next Steps:");
    console.log("1. Update your .env file with the contract addresses above");
    console.log("2. If UMA not configured, set UMA_FINDER_ADDRESS in .env and run:");
    console.log("   eventPool.setFinder(UMA_FINDER_ADDRESS)");
    console.log("3. Restart your frontend application");
    console.log("4. For admin tasks, interact with AdminManager contract");
    console.log("5. Test market creation via EventPool (with marketType parameter)");
    console.log("6. Test PRICE_FEED market resolution (direct price feed read)");
    console.log("7. Test UMA_MANUAL market resolution (UMA assertion flow)");
    console.log("8. Test market deletion via AdminManager.deleteMarket()");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });