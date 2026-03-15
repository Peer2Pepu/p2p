const { ethers } = require("hardhat");
require("dotenv").config();

async function main() {
  console.log("🚀 Deploying WebSocketTest contract...");

  // Get deployer account
  const [deployer] = await ethers.getSigners();
  console.log("📝 Deploying with account:", deployer.address);

  // Get balance
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("💰 Account balance:", ethers.formatEther(balance), "PEPU");

  // Deploy contract
  const WebSocketTest = await ethers.getContractFactory("WebSocketTest");
  const contract = await WebSocketTest.deploy();

  await contract.waitForDeployment();
  const address = await contract.getAddress();

  console.log("✅ WebSocketTest deployed to:", address);
  console.log("📋 Contract address:", address);

  // Verify deployment
  const counter = await contract.getCounter();
  console.log("🔢 Initial counter:", counter.toString());

  console.log("\n📝 Add this to your .env:");
  console.log(`WEBSOCKET_TEST_CONTRACT_ADDRESS=${address}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });
