const { ethers } = require("hardhat");
require("dotenv").config();

async function main() {
    console.log('💰 Withdrawing all funds from Treasury...');

    // Contract addresses
    const TREASURY_ADDRESS = process.env.NEXT_PUBLIC_P2P_TREASURY_ADDRESS;
    const P2P_TOKEN_ADDRESS = process.env.NEXT_PUBLIC_P2P_TOKEN_ADDRESS;
    const PRIVATE_KEY = process.env.PRIVATE_KEY;

    if (!TREASURY_ADDRESS || !P2P_TOKEN_ADDRESS || !PRIVATE_KEY) {
        throw new Error('Missing required addresses/keys in .env');
    }

    // Create wallet and provider
    const [signer] = await ethers.getSigners();
    const provider = signer.provider;

    // Contract ABIs
    const treasuryABI = [
        "function withdraw(address token, uint256 amount, address to) external",
        "function balanceOf(address token) external view returns (uint256)"
    ];

    const tokenABI = [
        "function balanceOf(address account) external view returns (uint256)"
    ];

    const treasury = new ethers.Contract(TREASURY_ADDRESS, treasuryABI, signer);
    const token = new ethers.Contract(P2P_TOKEN_ADDRESS, tokenABI, provider);

    try {
        // Get Treasury balances
        const ethBalance = await provider.getBalance(TREASURY_ADDRESS);
        const tokenBalance = await token.balanceOf(TREASURY_ADDRESS);

        console.log(`📊 Treasury Balances:`);
        console.log(`   ETH: ${ethers.formatEther(ethBalance)} ETH`);
        console.log(`   P2P Token: ${ethers.formatEther(tokenBalance)} P2P tokens`);

        // Withdraw ETH
        if (ethBalance > 0) {
            console.log(`\n💸 Withdrawing ${ethers.formatEther(ethBalance)} ETH...`);
            const tx1 = await treasury.withdraw(ethers.ZeroAddress, ethBalance, signer.address);
            console.log(`   Transaction: ${tx1.hash}`);
            await tx1.wait();
            console.log(`   ✅ ETH withdrawn successfully!`);
        }

        // Withdraw P2P tokens
        if (tokenBalance > 0) {
            console.log(`\n💸 Withdrawing ${ethers.formatEther(tokenBalance)} P2P tokens...`);
            const tx2 = await treasury.withdraw(P2P_TOKEN_ADDRESS, tokenBalance, signer.address);
            console.log(`   Transaction: ${tx2.hash}`);
            await tx2.wait();
            console.log(`   ✅ P2P tokens withdrawn successfully!`);
        }

        console.log(`\n🎉 All funds withdrawn successfully!`);

    } catch (error) {
        console.error('❌ Error withdrawing funds:', error.message);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
