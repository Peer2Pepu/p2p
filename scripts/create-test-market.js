const { ethers } = require("hardhat");
const lighthouse = require('@lighthouse-web3/sdk');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("🚀 Creating test market with Optimistic Oracle resolution...");
    console.log("Using account:", deployer.address);
    console.log("Account balance:", ethers.formatEther(await deployer.provider.getBalance(deployer.address)), "ETH");

    // Contract addresses
    const MARKET_MANAGER_ADDRESS = process.env.NEXT_PUBLIC_P2P_MARKET_MANAGER_ADDRESS || process.env.NEXT_PUBLIC_P2P_MARKETMANAGER_ADDRESS;
    if (!MARKET_MANAGER_ADDRESS) {
        console.error("❌ Missing NEXT_PUBLIC_P2P_MARKET_MANAGER_ADDRESS in .env");
        process.exit(1);
    }

    // Lighthouse API key (from create market page)
    const LIGHTHOUSE_API_KEY = process.env.LIGHTHOUSE_API_KEY || '91729f56.8c58e79bdc194453b56d2b826d2daefb';

    // Market parameters - 10 minute market
    // Research-based question about current events
    const marketTitle = "Will OpenAI release GPT-5 before March 2025?";
    const marketDescription = "This market resolves based on whether OpenAI publicly releases or announces GPT-5 (or a similarly named next-generation model) before March 1, 2025, 11:59 PM UTC. Official announcements, blog posts, or product launches count. Beta releases and leaks do not count. Resolution will be determined through the Optimistic Oracle.";
    const marketOptions = ["Yes", "No"];
    const categories = ["Technology", "AI"];
    
    // Image file path - hardcoded
    const imagePath = "C:\\Users\\USER\\p2p\\p2p\\public\\P2PFINAL-removebg-preview-removebg-preview.png";
    
    // Market configuration
    const isMultiOption = false; // Binary market (Yes/No)
    const maxOptions = 2;
    const paymentToken = "0x0000000000000000000000000000000000000000"; // Native PEPU
    const minStake = ethers.parseEther("0.1"); // 0.1 PEPU minimum stake
    const creatorDeposit = ethers.parseEther("1.0"); // 1 PEPU creator deposit
    const creatorOutcome = 1; // Creator bets on "Yes"
    const stakeDurationMinutes = 5; // 5 minutes for staking
    const resolutionDurationMinutes = 10; // 10 minutes total (market ends after 10 min)
    const marketType = 1; // 1 = UMA_MANUAL (Optimistic Oracle)
    const priceFeed = "0x0000000000000000000000000000000000000000"; // Not used for UMA_MANUAL
    const priceThreshold = 0; // Not used for UMA_MANUAL

    console.log("\n📋 Market Details:");
    console.log("Title:", marketTitle);
    console.log("Type: Optimistic Oracle (UMA_MANUAL)");
    console.log("Staking Duration:", stakeDurationMinutes, "minutes");
    console.log("Resolution Duration:", resolutionDurationMinutes, "minutes");
    console.log("Options:", marketOptions.join(" / "));

    // Step 1: Upload image to IPFS
    console.log("\n1. Uploading image to IPFS...");
    let imageUrl = "";
    try {
        if (!fs.existsSync(imagePath)) {
            console.log("⚠️  Image file not found:", imagePath);
            console.log("   Continuing without image...");
        } else {
            console.log("   Uploading image:", imagePath);
            
            // Upload file using Lighthouse (Node.js method - accepts file path)
            const imageUploadResult = await lighthouse.upload(
                imagePath,
                LIGHTHOUSE_API_KEY
            );
            
            if (imageUploadResult && imageUploadResult.data && imageUploadResult.data.Hash) {
                const imageIpfsHash = imageUploadResult.data.Hash;
                imageUrl = `https://gateway.lighthouse.storage/ipfs/${imageIpfsHash}`;
                console.log("✅ Image uploaded to IPFS:", imageUrl);
            } else {
                console.log("⚠️  Failed to upload image, continuing without image...");
            }
        }
    } catch (error) {
        console.log("⚠️  Error uploading image:", error.message);
        console.log("   Continuing without image...");
    }

    // Step 2: Prepare metadata
    console.log("\n2. Preparing market metadata...");
    const metadata = {
        title: marketTitle,
        description: marketDescription,
        options: marketOptions,
        categories: categories,
        imageUrl: imageUrl,
        resources: [],
        links: []
    };

    // Step 3: Upload metadata to IPFS using Lighthouse
    console.log("3. Uploading metadata to IPFS...");
    let ipfsHash;
    try {
        const uploadResponse = await lighthouse.uploadText(
            JSON.stringify(metadata),
            LIGHTHOUSE_API_KEY
        );
        
        if (uploadResponse && uploadResponse.data && uploadResponse.data.Hash) {
            ipfsHash = uploadResponse.data.Hash;
            console.log("✅ Metadata uploaded to IPFS:", ipfsHash);
        } else {
            throw new Error("Invalid upload response");
        }
    } catch (error) {
        console.error("❌ Failed to upload to IPFS:", error.message);
        // Fallback: use a placeholder hash (not recommended for production)
        ipfsHash = "QmPlaceholderHashForTestMarket123456789";
        console.log("⚠️  Using placeholder hash (market may not display correctly)");
    }

    // Step 4: Get contract instance
    console.log("\n4. Connecting to MarketManager contract...");
    const MarketManager = await ethers.getContractFactory("EventPool");
    const marketManager = MarketManager.attach(MARKET_MANAGER_ADDRESS);

    // Step 5: Calculate total value needed (market creation fee + creator deposit)
    const marketCreationFee = ethers.parseEther("1"); // 1 PEPU creation fee
    const totalValue = marketCreationFee + creatorDeposit;
    console.log("💰 Total value to send:", ethers.formatEther(totalValue), "PEPU");
    console.log("   - Market creation fee:", ethers.formatEther(marketCreationFee), "PEPU");
    console.log("   - Creator deposit:", ethers.formatEther(creatorDeposit), "PEPU");

    // Step 6: Create market
    console.log("\n5. Creating market on blockchain...");
    try {
        const tx = await marketManager.createMarket(
            ipfsHash,
            isMultiOption,
            maxOptions,
            paymentToken,
            minStake,
            creatorDeposit,
            creatorOutcome,
            stakeDurationMinutes,
            resolutionDurationMinutes,
            marketType, // UMA_MANUAL
            priceFeed,
            priceThreshold,
            {
                value: totalValue,
                gasLimit: 1000000 // Gas limit for market creation
            }
        );

        console.log("📝 Transaction sent:", tx.hash);
        console.log("⏳ Waiting for confirmation...");
        
        const receipt = await tx.wait();
        console.log("✅ Transaction confirmed in block:", receipt.blockNumber);

        // Parse MarketCreated event to get market ID
        const marketCreatedEvent = receipt.logs.find(log => {
            try {
                const parsed = marketManager.interface.parseLog(log);
                return parsed && parsed.name === "MarketCreated";
            } catch {
                return false;
            }
        });

        if (marketCreatedEvent) {
            const parsed = marketManager.interface.parseLog(marketCreatedEvent);
            const marketId = parsed.args.marketId.toString();
            console.log("\n🎉 Market created successfully!");
            console.log("📊 Market ID:", marketId);
            console.log("🔗 View market: https://p2p-woad-omega.vercel.app/market/" + marketId);
            console.log("\n📋 Market Summary:");
            console.log("   - Market will be active for", resolutionDurationMinutes, "minutes");
            console.log("   - Staking period:", stakeDurationMinutes, "minutes");
            console.log("   - After market ends, resolution can be requested via Optimistic Oracle");
            console.log("   - Go to /assert page to make an assertion when market ends");
        } else {
            console.log("⚠️  Market created but could not parse MarketCreated event");
            console.log("   Check the transaction receipt for market ID");
        }

    } catch (error) {
        console.error("❌ Failed to create market:", error.message);
        if (error.reason) {
            console.error("   Reason:", error.reason);
        }
        process.exit(1);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
