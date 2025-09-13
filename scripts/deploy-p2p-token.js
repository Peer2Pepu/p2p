const { ethers } = require("hardhat");

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deploying P2P Token with account:", deployer.address);
    console.log("Account balance:", ethers.formatEther(await deployer.provider.getBalance(deployer.address)));

    // Deploy P2PToken
    console.log("\nDeploying P2PToken...");
    const P2PToken = await ethers.getContractFactory("P2PToken");
    const p2pToken = await P2PToken.deploy(deployer.address, 1000000); // 1M tokens
    await p2pToken.waitForDeployment();
    
    const tokenAddress = await p2pToken.getAddress();
    console.log("P2PToken deployed to:", tokenAddress);

    // Get token details
    const name = await p2pToken.name();
    const symbol = await p2pToken.symbol();
    const decimals = await p2pToken.decimals();
    const totalSupply = await p2pToken.totalSupply();
    const ownerBalance = await p2pToken.balanceOf(deployer.address);

    console.log("\nToken Details:");
    console.log("Name:", name);
    console.log("Symbol:", symbol);
    console.log("Decimals:", decimals.toString());
    console.log("Total Supply:", ethers.formatEther(totalSupply));
    console.log("Owner Balance:", ethers.formatEther(ownerBalance));

    console.log("\n🎉 P2P Token Deployment Complete!");
    console.log("\nContract Address:");
    console.log(`P2PToken: ${tokenAddress}`);

    console.log("\nAdd to your .env file:");
    console.log(`NEXT_PUBLIC_P2P_ADDRESS=${tokenAddress}`);

    console.log("\nTo verify the contract, run:");
    console.log(`npx hardhat verify --network pepe_unchained_v2_testnet ${tokenAddress} "${deployer.address}" "1000000"`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });