const { ethers } = require("hardhat");

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Setting partner address with account:", deployer.address);

    // Treasury contract address
    const TREASURY_ADDRESS = "0x444e02e38015E5121B70643c13a3056854e8cAb7";
    const PARTNER_ADDRESS = "0x7e217fa1Ce282653115bA04686aE73dd689Ee588";

    // Get Treasury contract
    const Treasury = await ethers.getContractFactory("P2PTreasury");
    const treasury = Treasury.attach(TREASURY_ADDRESS);

    console.log("Current partner:", await treasury.partner());
    console.log("Setting new partner to:", PARTNER_ADDRESS);

    // Set partner address
    const tx = await treasury.setPartner(PARTNER_ADDRESS);
    await tx.wait();

    console.log("✅ Partner address updated successfully!");
    console.log("New partner:", await treasury.partner());
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });