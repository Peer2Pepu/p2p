const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

async function main() {
    console.log('🔧 Setting up verifiers and partners...');

    // Contract addresses
    const TREASURY_ADDRESS = process.env.NEXT_PUBLIC_P2P_TREASURY_ADDRESS;
    const VERIFICATION_ADDRESS = process.env.NEXT_PUBLIC_P2P_VERIFICATION_ADDRESS;
    const PRIVATE_KEY = process.env.PRIVATE_KEY;

    if (!TREASURY_ADDRESS || !VERIFICATION_ADDRESS || !PRIVATE_KEY) {
        throw new Error('Missing required addresses/keys in .env');
    }

    // Load generated wallets
    const walletsPath = path.join(__dirname, '..', 'generated-wallets', 'wallets.json');
    if (!fs.existsSync(walletsPath)) {
        throw new Error('Generated wallets file not found. Please run: npm run generate-wallets');
    }

    const wallets = JSON.parse(fs.readFileSync(walletsPath, 'utf8'));
    
    if (wallets.length < 4) {
        throw new Error('Need at least 4 wallets. Please run: npm run generate-wallets');
    }

    // Use wallets 1, 2, 3 as verifiers and wallet 4 as partner
    const VERIFIER_ADDRESSES = [
        wallets[0].address, // Wallet 1
        wallets[1].address, // Wallet 2
        wallets[2].address  // Wallet 3
    ];
    const PARTNER_ADDRESS = wallets[3].address; // Wallet 4

    // Create provider and wallet
    const [signer] = await ethers.getSigners();
    const provider = signer.provider;

    // Contract ABIs
    const treasuryABI = [
        "function setPartner(address _partner) external"
    ];

    const verificationABI = [
        "function addVerifier(address verifier) external",
        "function isVerifier(address verifier) external view returns (bool)"
    ];

    const treasury = new ethers.Contract(TREASURY_ADDRESS, treasuryABI, signer);
    const verification = new ethers.Contract(VERIFICATION_ADDRESS, verificationABI, signer);

    try {
        console.log(`📋 Setup Configuration:`);
        console.log(`   Treasury: ${TREASURY_ADDRESS}`);
        console.log(`   Verification: ${VERIFICATION_ADDRESS}`);
        console.log(`   Partner: ${PARTNER_ADDRESS}`);
        console.log(`   Verifier 1: ${VERIFIER_ADDRESSES[0]}`);
        console.log(`   Verifier 2: ${VERIFIER_ADDRESSES[1]}`);
        console.log(`   Verifier 3: ${VERIFIER_ADDRESSES[2]}`);

        // 1. Set partner in Treasury
        console.log(`\n1. Setting partner in Treasury...`);
        const setPartnerTx = await treasury.setPartner(PARTNER_ADDRESS);
        console.log(`   Transaction: ${setPartnerTx.hash}`);
        await setPartnerTx.wait();
        console.log(`   ✅ Partner set to: ${PARTNER_ADDRESS}`);

        // 2. Add verifiers to ValidationCore
        console.log(`\n2. Adding verifiers to ValidationCore...`);

        for (let i = 0; i < VERIFIER_ADDRESSES.length; i++) {
            try {
                console.log(`   Adding verifier ${i + 1}: ${VERIFIER_ADDRESSES[i]}`);
                const addVerifierTx = await verification.addVerifier(VERIFIER_ADDRESSES[i]);
                console.log(`   Transaction: ${addVerifierTx.hash}`);
                await addVerifierTx.wait();
                console.log(`   ✅ Verifier ${i + 1} added`);
            } catch (error) {
                if (error.message.includes("Already a verifier") || error.message.includes("already a verifier")) {
                    console.log(`   ✅ Verifier ${i + 1} already exists: ${VERIFIER_ADDRESSES[i]}`);
                } else {
                    throw error;
                }
            }
        }

        console.log(`\n🎉 Setup complete!`);
        console.log(`   Partner: ${PARTNER_ADDRESS}`);
        console.log(`   Verifiers: ${VERIFIER_ADDRESSES.join(', ')}`);

    } catch (error) {
        console.error('❌ Error setting up verifiers and partners:', error.message);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
