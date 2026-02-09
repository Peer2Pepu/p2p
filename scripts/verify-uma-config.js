const hre = require("hardhat");

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Verifying UMA configuration...");
    console.log("Using account:", deployer.address);
    
    const eventPoolAddress = process.env.NEXT_PUBLIC_P2P_MARKET_MANAGER_ADDRESS || "0xc8C6812aE3c44a5c603B7eCae2ceAED96a9144f7";
    console.log("EventPool address:", eventPoolAddress);
    
    const EventPool = await ethers.getContractFactory("EventPool");
    const eventPool = EventPool.attach(eventPoolAddress);
    
    const optimisticOracle = await eventPool.optimisticOracle();
    const finder = await eventPool.finder();
    const defaultBondCurrency = await eventPool.defaultBondCurrency();
    const defaultBond = await eventPool.defaultBond();
    const defaultLiveness = await eventPool.defaultLiveness();
    const defaultIdentifier = await eventPool.defaultIdentifier();
    
    console.log("\n📋 UMA Configuration:");
    console.log("   Finder:", finder);
    console.log("   OptimisticOracle:", optimisticOracle);
    console.log("   Default Bond Currency:", defaultBondCurrency);
    console.log("   Default Bond Amount:", ethers.formatEther(defaultBond), "tokens");
    console.log("   Default Liveness:", defaultLiveness.toString(), "seconds");
    console.log("   Default Identifier:", defaultIdentifier);
    
    if (optimisticOracle !== ethers.ZeroAddress) {
        console.log("\n✅ UMA is configured and ready for UMA_MANUAL markets!");
    } else {
        console.log("\n⚠️  OptimisticOracle not set. Run configure-uma.js to set it.");
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
