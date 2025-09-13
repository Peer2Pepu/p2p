const { ethers } = require("hardhat");

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deploying contracts with account:", deployer.address);
    console.log("Account balance:", ethers.formatEther(await deployer.provider.getBalance(deployer.address)));

    // 1. Use existing PoolToken
    console.log("\n1. Using existing PoolToken...");
    const PoolToken = await ethers.getContractFactory("PoolToken");
    const poolToken = PoolToken.attach("0x28dD14D951cc1b9fF32bDc27DCC7dA04FbfE3aF6");
    console.log("PoolToken address:", await poolToken.getAddress());

    // 2. Deploy PoolVault
    console.log("\n2. Deploying PoolVault...");
    const PoolVault = await ethers.getContractFactory("PoolVault");
    const vault = await PoolVault.deploy(deployer.address, deployer.address); // Partner = deployer for now
    await vault.waitForDeployment();
    console.log("PoolVault deployed to:", await vault.getAddress());

    // 3. Deploy ValidationCore
    console.log("\n3. Deploying ValidationCore...");
    const ValidationCore = await ethers.getContractFactory("ValidationCore");
    const validation = await ValidationCore.deploy(deployer.address);
    await validation.waitForDeployment();
    console.log("ValidationCore deployed to:", await validation.getAddress());

    // 4. Deploy MetricsHub
    console.log("\n4. Deploying MetricsHub...");
    const MetricsHub = await ethers.getContractFactory("MetricsHub");
    const metrics = await MetricsHub.deploy(deployer.address, ethers.ZeroAddress); // Will set EventPool later
    await metrics.waitForDeployment();
    console.log("MetricsHub deployed to:", await metrics.getAddress());

    // 5. Deploy EventPool
    console.log("\n5. Deploying EventPool...");
    const EventPool = await ethers.getContractFactory("EventPool");
    const eventPool = await EventPool.deploy(
        deployer.address,
        await vault.getAddress(),
        await validation.getAddress(),
        await metrics.getAddress(),
        ethers.parseEther("1") // 1 PEPU creation fee
    );
    await eventPool.waitForDeployment();
    console.log("EventPool deployed to:", await eventPool.getAddress());

    // 6. Set EventPool in PoolVault (auto-authorizes it)
    console.log("\n6. Setting EventPool in PoolVault...");
    await vault.setMarketManager(await eventPool.getAddress());
    console.log("EventPool set and authorized in PoolVault");

    // 7. Set EventPool in ValidationCore
    console.log("\n7. Setting EventPool in ValidationCore...");
    await validation.setMarketManager(await eventPool.getAddress());
    console.log("EventPool set in ValidationCore");

    // 8. Set EventPool in MetricsHub
    console.log("\n8. Setting EventPool in MetricsHub...");
    await metrics.setMarketManager(await eventPool.getAddress());
    console.log("EventPool set in MetricsHub");

    // 9. Add PoolToken as supported token
    console.log("\n9. Adding PoolToken as supported token...");
    await eventPool.addSupportedToken(await poolToken.getAddress(), "P2P");
    console.log("PoolToken added as supported token");

    console.log("\n🎉 Deployment Complete!");
    console.log("\nContract Addresses:");
    console.log(`PoolToken: ${await poolToken.getAddress()}`);
    console.log(`PoolVault: ${await vault.getAddress()}`);
    console.log(`ValidationCore: ${await validation.getAddress()}`);
    console.log(`MetricsHub: ${await metrics.getAddress()}`);
    console.log(`EventPool: ${await eventPool.getAddress()}`);

    console.log("\nAdd to your .env file:");
    console.log(`NEXT_PUBLIC_POOL_TOKEN_ADDRESS=${await poolToken.getAddress()}`);
    console.log(`NEXT_PUBLIC_POOL_VAULT_ADDRESS=${await vault.getAddress()}`);
    console.log(`NEXT_PUBLIC_VALIDATION_CORE_ADDRESS=${await validation.getAddress()}`);
    console.log(`NEXT_PUBLIC_METRICS_HUB_ADDRESS=${await metrics.getAddress()}`);
    console.log(`NEXT_PUBLIC_EVENT_POOL_ADDRESS=${await eventPool.getAddress()}`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });