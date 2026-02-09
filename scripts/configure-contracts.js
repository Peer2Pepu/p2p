const { ethers } = require("hardhat");

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("🔧 Configuring contract permissions...");
    console.log("Using account:", deployer.address);

    // Contract addresses from deployment
    const ADMIN_MANAGER_ADDRESS = "0x2Bd11db9bcd50bE341fb339E41Fd283F91a4e0cd";
    const TREASURY_ADDRESS = "0xe349EE2E8a966968a888beb2f89Bc3744b49623a";
    const ANALYTICS_ADDRESS = "0x68Cde6b75fb99aaB0b0322295Fb59d63aC5a7f90";
    const MARKET_MANAGER_ADDRESS = "0x7FE1a05D48447458975AE5A0556399778Ee6160d";
    const P2P_TOKEN_ADDRESS = "0x28dD14D951cc1b9fF32bDc27DCC7dA04FbfE3aF6";

    // Get contract instances
    const AdminManager = await ethers.getContractAt("AdminManager", ADMIN_MANAGER_ADDRESS);
    const Treasury = await ethers.getContractAt("PoolVault", TREASURY_ADDRESS);
    const Analytics = await ethers.getContractAt("MetricsHub", ANALYTICS_ADDRESS);
    const MarketManager = await ethers.getContractAt("EventPool", MARKET_MANAGER_ADDRESS);

    console.log("\n1. Linking EventPool to AdminManager...");
    try {
        const setEventPoolTx = await AdminManager.setEventPool(MARKET_MANAGER_ADDRESS);
        await setEventPoolTx.wait();
        console.log("✅ EventPool linked to AdminManager");
    } catch (error) {
        console.error("❌ Failed to link EventPool:", error.message);
    }

    console.log("\n2. Setting Analytics in AdminManager...");
    try {
        const setAnalyticsTx = await AdminManager.setAnalytics(ANALYTICS_ADDRESS);
        await setAnalyticsTx.wait();
        console.log("✅ Analytics set in AdminManager");
    } catch (error) {
        console.error("❌ Failed to set Analytics:", error.message);
    }

    console.log("\n3. Setting MarketManager in Treasury...");
    try {
        const setMarketManagerTx = await Treasury.setMarketManager(MARKET_MANAGER_ADDRESS);
        await setMarketManagerTx.wait();
        console.log("✅ MarketManager set in Treasury");
    } catch (error) {
        console.error("❌ Failed to set MarketManager in Treasury:", error.message);
    }

    console.log("\n4. Setting MarketManager in Analytics...");
    try {
        const setAnalyticsMarketManagerTx = await Analytics.setMarketManager(MARKET_MANAGER_ADDRESS);
        await setAnalyticsMarketManagerTx.wait();
        console.log("✅ MarketManager set in Analytics");
    } catch (error) {
        console.error("❌ Failed to set MarketManager in Analytics:", error.message);
    }

    console.log("\n5. Adding P2P Token via AdminManager...");
    try {
        const addTokenTx = await AdminManager.addSupportedToken(P2P_TOKEN_ADDRESS, "P2P");
        await addTokenTx.wait();
        console.log("✅ P2P Token added as supported token");
    } catch (error) {
        console.error("❌ Failed to add P2P Token:", error.message);
    }

    console.log("\n6. Verifying permissions...");
    try {
        const eventPool = await AdminManager.eventPool();
        const analytics = await AdminManager.analytics();
        const treasuryMarketManager = await Treasury.marketManager();
        const analyticsMarketManager = await Analytics.marketManager();
        const isP2PTokenSupported = await AdminManager.supportedTokens(P2P_TOKEN_ADDRESS);

        console.log("EventPool in AdminManager:", eventPool);
        console.log("Analytics in AdminManager:", analytics);
        console.log("MarketManager in Treasury:", treasuryMarketManager);
        console.log("MarketManager in Analytics:", analyticsMarketManager);
        console.log("P2P Token supported:", isP2PTokenSupported);

        if (eventPool.toLowerCase() === MARKET_MANAGER_ADDRESS.toLowerCase() &&
            analytics.toLowerCase() === ANALYTICS_ADDRESS.toLowerCase() &&
            treasuryMarketManager.toLowerCase() === MARKET_MANAGER_ADDRESS.toLowerCase() &&
            analyticsMarketManager.toLowerCase() === MARKET_MANAGER_ADDRESS.toLowerCase() &&
            isP2PTokenSupported) {
            console.log("\n✅ All permissions configured correctly!");
        } else {
            console.log("\n⚠️  Some permissions may not be set correctly");
        }
    } catch (error) {
        console.error("❌ Failed to verify permissions:", error.message);
    }

    console.log("\n🎉 Configuration complete!");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
