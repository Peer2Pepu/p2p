const { ethers } = require("hardhat");
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function askQuestion(question) {
    return new Promise((resolve) => {
        rl.question(question, resolve);
    });
}

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Using account:", deployer.address);

    // Contract address
    const VERIFICATION_ADDRESS = process.env.NEXT_PUBLIC_P2P_VERIFICATION_ADDRESS;
    
    if (!VERIFICATION_ADDRESS) {
        console.error("❌ NEXT_PUBLIC_P2P_VERIFICATION_ADDRESS not found in .env");
        process.exit(1);
    }

    // Get Verification contract
    const Verification = await ethers.getContractFactory("ValidationCore");
    const verification = Verification.attach(VERIFICATION_ADDRESS);

    // List all verifiers
    const verifiers = await verification.getVerifiers();
    const count = await verification.getVerifierCount();
    
    console.log(`\n📋 Verifiers (${count}):`);
    if (verifiers.length === 0) {
        console.log("   No verifiers found");
    } else {
        verifiers.forEach((verifier, index) => {
            console.log(`   ${index + 1}. ${verifier}`);
        });
    }

    // Ask if user wants to add a verifier
    const answer = await askQuestion("\nWould you like to add a verifier? (yes/no): ");
    
    if (answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y') {
        const address = await askQuestion("Enter verifier address: ");
        
        if (!ethers.isAddress(address)) {
            console.log("❌ Invalid address format");
            rl.close();
            return;
        }

        try {
            console.log(`\n➕ Adding verifier: ${address}`);
            const tx = await verification.addVerifier(address);
            await tx.wait();
            console.log("✅ Verifier added successfully!");
        } catch (error) {
            console.log("❌ Error:", error.message);
        }
    }

    rl.close();
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });