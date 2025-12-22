const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function generateWallets() {
    console.log('🔐 Generating 4 wallets with unique seed phrases...\n');

    const wallets = [];

    for (let i = 1; i <= 4; i++) {
        // Generate a random wallet with mnemonic (12-word seed phrase)
        const wallet = ethers.Wallet.createRandom();
        const mnemonic = wallet.mnemonic.phrase;
        
        const walletData = {
            walletNumber: i,
            address: wallet.address,
            privateKey: wallet.privateKey,
            seedPhrase: mnemonic
        };

        wallets.push(walletData);

        console.log(`✅ Wallet ${i} generated:`);
        console.log(`   Address: ${wallet.address}`);
        console.log(`   Private Key: ${wallet.privateKey}`);
        console.log(`   Seed Phrase: ${mnemonic}\n`);
    }

    // Create output directory if it doesn't exist
    const outputDir = path.join(__dirname, '..', 'generated-wallets');
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    // Save to JSON file
    const outputFile = path.join(outputDir, 'wallets.json');
    fs.writeFileSync(outputFile, JSON.stringify(wallets, null, 2), 'utf8');

    // Also save to a more readable text file
    const textFile = path.join(outputDir, 'wallets.txt');
    let textContent = '='.repeat(80) + '\n';
    textContent += 'GENERATED WALLETS - KEEP THIS FILE SECURE!\n';
    textContent += '='.repeat(80) + '\n\n';

    wallets.forEach((wallet, index) => {
        textContent += `WALLET ${wallet.walletNumber}\n`;
        textContent += '-'.repeat(80) + '\n';
        textContent += `Address:     ${wallet.address}\n`;
        textContent += `Private Key: ${wallet.privateKey}\n`;
        textContent += `Seed Phrase: ${wallet.seedPhrase}\n`;
        textContent += '\n';
    });

    textContent += '='.repeat(80) + '\n';
    textContent += '⚠️  WARNING: Keep these credentials secure and never share them!\n';
    textContent += '='.repeat(80) + '\n';

    fs.writeFileSync(textFile, textContent, 'utf8');

    console.log('📁 Wallet data saved to:');
    console.log(`   JSON: ${outputFile}`);
    console.log(`   TXT:  ${textFile}`);
    console.log('\n⚠️  WARNING: Keep these files secure and never commit them to git!');
}

generateWallets()
    .then(() => {
        console.log('\n✅ Wallet generation complete!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('❌ Error generating wallets:', error);
        process.exit(1);
    });

