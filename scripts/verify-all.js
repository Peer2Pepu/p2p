const { ethers } = require("hardhat");

async function main() {
    // These are the addresses from the pepe_unchained_v2 mainnet deployment (just deployed)
    // Override with environment variables if needed
    const adminManagerAddress = "0x409D6969443f2Eb0E950bD53835950F363EaECa8";
    const vaultAddress = "0xae2f0FdA407F70A43CE0e65379dd38C248f37277";
    const validationAddress = "0xfb3Ddd4AD9f095D0169E0b606bA893585161D3D2";
    const analyticsAddress = "0xEb873B55a6831AB006e9870455296b88C4369a9E";
    const marketManagerAddress = "0x982BFb01d7427b7FDBCcE3217375664931a49544";

    const [deployer] = await ethers.getSigners();
    console.log("🔍 Verifying contracts on explorer...");
    console.log("Verifying with account:", deployer.address);
    console.log("Network:", hre.network.name);
    
    console.log("\n📋 Contract Addresses to verify:");
    console.log(`AdminManager: ${adminManagerAddress}`);
    console.log(`PoolVault: ${vaultAddress}`);
    console.log(`ValidationCore: ${validationAddress}`);
    console.log(`MetricsHub: ${analyticsAddress}`);
    console.log(`EventPool: ${marketManagerAddress}`);

    // Get the deployer address (used in constructors) - this should match the deployment
    const deployerAddress = deployer.address;
    console.log("Deployer address (for constructor args):", deployerAddress);

    try {
        // 1. Verify AdminManager
        console.log("\n1. Verifying AdminManager...");
        await hre.run("verify:verify", {
            address: adminManagerAddress,
            constructorArguments: [deployerAddress],
            contract: "contracts/AdminManger.sol:AdminManager"
        });
        console.log("✅ AdminManager verified");
    } catch (error) {
        console.log("⚠️  AdminManager verification:", error.message);
    }

    try {
        // 2. Verify PoolVault
        console.log("\n2. Verifying PoolVault (Treasury)...");
        await hre.run("verify:verify", {
            address: vaultAddress,
            constructorArguments: [deployerAddress, deployerAddress], // admin, platformFeeRecipient
            contract: "contracts/P2PTreasury.sol:PoolVault"
        });
        console.log("✅ PoolVault verified");
    } catch (error) {
        console.log("⚠️  PoolVault verification:", error.message);
    }

    try {
        // 3. Verify ValidationCore
        console.log("\n3. Verifying ValidationCore...");
        await hre.run("verify:verify", {
            address: validationAddress,
            constructorArguments: [deployerAddress],
            contract: "contracts/P2PVerification.sol:ValidationCore"
        });
        console.log("✅ ValidationCore verified");
    } catch (error) {
        console.log("⚠️  ValidationCore verification:", error.message);
    }

    try {
        // 4. Verify MetricsHub
        console.log("\n4. Verifying MetricsHub (Analytics)...");
        await hre.run("verify:verify", {
            address: analyticsAddress,
            constructorArguments: [deployerAddress, ethers.ZeroAddress], // admin, marketManager (initially zero)
            contract: "contracts/P2PAnalytics.sol:MetricsHub"
        });
        console.log("✅ MetricsHub verified");
    } catch (error) {
        console.log("⚠️  MetricsHub verification:", error.message);
    }

    try {
        // 5. Verify EventPool (requires vaultAddress and adminManagerAddress as constructor args)
        console.log("\n5. Verifying EventPool (MarketManager)...");
        await hre.run("verify:verify", {
            address: marketManagerAddress,
            constructorArguments: [deployerAddress, vaultAddress, adminManagerAddress],
            contract: "contracts/P2PMarketManager.sol:EventPool"
        });
        console.log("✅ EventPool verified");
    } catch (error) {
        console.log("⚠️  EventPool verification:", error.message);
    }

    console.log("\n🎉 Verification process complete!");
    console.log("\n💡 Note: If verification failed, ensure:");
    console.log("   1. Contracts are deployed on the specified network");
    console.log("   2. Constructor arguments match the deployment");
    console.log("   3. Network has an explorer API configured");
    console.log("   4. Wait a few seconds after deployment before verifying");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
