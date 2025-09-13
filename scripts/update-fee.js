const hre = require("hardhat");

async function main() {
  console.log("Updating Treasury creation fee to 10,000 P2P tokens...");

  // Treasury contract address (deployed earlier)
  const TREASURY_ADDRESS = "0x707Ad05808F2230d90C637733FA86780886580D6";
  
  // New creation fee amount (10,000 P2P tokens)
  const NEW_FEE_AMOUNT = ethers.parseUnits("10000", 18);

  try {
    // Get the signer (owner account)
    const [owner] = await ethers.getSigners();
    console.log("Updating with account:", owner.address);
    
    // Create Treasury contract instance
    const Treasury = await ethers.getContractFactory("Treasury");
    const treasury = Treasury.attach(TREASURY_ADDRESS);
    
    // Check current fee
    const currentFee = await treasury.creationFeeAmount();
    console.log("Current creation fee:", ethers.formatUnits(currentFee, 18), "P2P tokens");
    
    // Update the fee
    console.log("\nUpdating creation fee to 10,000 P2P tokens...");
    const tx = await treasury.updateCreationFee(NEW_FEE_AMOUNT);
    console.log("Transaction hash:", tx.hash);
    console.log("Waiting for confirmation...");
    
    const receipt = await tx.wait();
    console.log("Transaction confirmed in block:", receipt.blockNumber);
    console.log("Gas used:", receipt.gasUsed.toString());
    
    // Verify the update
    const newFee = await treasury.creationFeeAmount();
    console.log("\n✅ Creation fee updated successfully!");
    console.log("New creation fee:", ethers.formatUnits(newFee, 18), "P2P tokens");
    
  } catch (error) {
    console.error("❌ Error updating creation fee:", error.message);
    
    if (error.message.includes("Only owner")) {
      console.log("Only the Treasury owner can update the creation fee.");
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
