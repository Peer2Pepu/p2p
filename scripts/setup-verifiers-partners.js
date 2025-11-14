const { ethers } = require("hardhat");
require("dotenv").config();

async function main() {
    console.log('🔧 Setting up verifiers and partners...');

    // Contract addresses
    const TREASURY_ADDRESS = process.env.NEXT_PUBLIC_P2P_TREASURY_ADDRESS;
    const VERIFICATION_ADDRESS = process.env.NEXT_PUBLIC_P2P_VERIFICATION_ADDRESS;
    const PRIVATE_KEY = process.env.PRIVATE_KEY;
    const KEY_ONE = process.env.KEY_ONE;
    const KEY_TWO = process.env.KEY_TWO;
    const PARTNER_ADDRESS = "0x0a66fe87d80aa139b25d1b2f5f9961c09511a862";

    if (!TREASURY_ADDRESS || !VERIFICATION_ADDRESS || !PRIVATE_KEY || !KEY_ONE || !KEY_TWO) {
        throw new Error('Missing required addresses/keys in .env');
    }

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
        // Get addresses from private keys
        const wallet1 = new ethers.Wallet(KEY_ONE, provider);
        const wallet2 = new ethers.Wallet(KEY_TWO, provider);

        console.log(`📋 Setup Configuration:`);
        console.log(`   Treasury: ${TREASURY_ADDRESS}`);
        console.log(`   Verification: ${VERIFICATION_ADDRESS}`);
        console.log(`   Partner: ${PARTNER_ADDRESS}`);
        console.log(`   Verifier 1: ${wallet1.address}`);
        console.log(`   Verifier 2: ${wallet2.address}`);

        // 1. Set partner in Treasury
        console.log(`\n1. Setting partner in Treasury...`);
        const setPartnerTx = await treasury.setPartner(PARTNER_ADDRESS);
        console.log(`   Transaction: ${setPartnerTx.hash}`);
        await setPartnerTx.wait();
        console.log(`   ✅ Partner set to: ${PARTNER_ADDRESS}`);

        // 2. Add verifiers to ValidationCore
        console.log(`\n2. Adding verifiers to ValidationCore...`);

        try {
            console.log(`   Adding verifier 1: ${wallet1.address}`);
            const addVerifier1Tx = await verification.addVerifier(wallet1.address);
            console.log(`   Transaction: ${addVerifier1Tx.hash}`);
            await addVerifier1Tx.wait();
            console.log(`   ✅ Verifier 1 added`);
        } catch (error) {
            if (error.message.includes("Already a verifier")) {
                console.log(`   ✅ Verifier 1 already exists: ${wallet1.address}`);
            } else {
                throw error;
            }
        }

        try {
            console.log(`   Adding verifier 2: ${wallet2.address}`);
            const addVerifier2Tx = await verification.addVerifier(wallet2.address);
            console.log(`   Transaction: ${addVerifier2Tx.hash}`);
            await addVerifier2Tx.wait();
            console.log(`   ✅ Verifier 2 added`);
        } catch (error) {
            if (error.message.includes("Already a verifier")) {
                console.log(`   ✅ Verifier 2 already exists: ${wallet2.address}`);
            } else {
                throw error;
            }
        }

        console.log(`\n🎉 Setup complete!`);
        console.log(`   Partner: ${PARTNER_ADDRESS}`);
        console.log(`   Verifiers: ${wallet1.address}, ${wallet2.address}`);

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
