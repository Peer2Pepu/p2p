const hre = require("hardhat");

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Configuring UMA on existing deployment...");
    console.log("Using account:", deployer.address);
    
    // Get deployed EventPool address from .env or use the one from latest deployment
    const eventPoolAddress = process.env.NEXT_PUBLIC_P2P_MARKET_MANAGER_ADDRESS || "0xc8C6812aE3c44a5c603B7eCae2ceAED96a9144f7";
    console.log("EventPool address:", eventPoolAddress);
    
    const EventPool = await ethers.getContractFactory("EventPool");
    const eventPool = EventPool.attach(eventPoolAddress);
    
    // UMA addresses
    const UMA_FINDER = process.env.UMA_FINDER_ADDRESS || "0x3DddFc9f57Bd4841c6246709bb8483B93Baa328f";
    const UMA_OPTIMISTIC_ORACLE = process.env.UMA_OPTIMISTIC_ORACLE_ADDRESS || "0x08134f53EA608Ef199DBa2E86340456D22b480B9";
    
    console.log("\n1. Setting UMA Finder:", UMA_FINDER);
    try {
        const setFinderTx = await eventPool.setFinder(UMA_FINDER);
        await setFinderTx.wait();
        const optimisticOracle = await eventPool.optimisticOracle();
        console.log("✅ Finder set, OptimisticOracle auto-configured:", optimisticOracle);
    } catch (error) {
        console.log("⚠️  Finder lookup failed:", error.message);
        console.log("   Setting OptimisticOracle directly:", UMA_OPTIMISTIC_ORACLE);
        const setOOTx = await eventPool.setOptimisticOracle(UMA_OPTIMISTIC_ORACLE);
        await setOOTx.wait();
        console.log("✅ OptimisticOracle set directly");
        
        // Also set Finder address manually (even though lookup failed, we want it stored)
        console.log("   Setting Finder address (without lookup):", UMA_FINDER);
        const setFinderOnlyTx = await eventPool.setFinderOnly(UMA_FINDER);
        await setFinderOnlyTx.wait();
        console.log("✅ Finder address set");
    }
    
    // Verify configuration
    const configuredOO = await eventPool.optimisticOracle();
    const configuredFinder = await eventPool.finder();
    console.log("\n✅ UMA Configuration Complete!");
    console.log("   Finder:", configuredFinder);
    console.log("   OptimisticOracle:", configuredOO);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
