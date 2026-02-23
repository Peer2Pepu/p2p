const { ethers } = require("hardhat");
const lighthouse = require('@lighthouse-web3/sdk');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Contract addresses
const MARKET_MANAGER_ADDRESS = process.env.NEXT_PUBLIC_P2P_MARKET_MANAGER_ADDRESS || process.env.NEXT_PUBLIC_P2P_MARKETMANAGER_ADDRESS;
const P2P_TOKEN_ADDRESS = process.env.NEXT_PUBLIC_P2P_TOKEN_ADDRESS || "0x28dD14D951cc1b9fF32bDc27DCC7dA04FbfE3aF6";
const ORACLE_ADDRESS = process.env.P2P_OPTIMISTIC_ORACLE_ADDRESS || "0x98295b46375c26077fD4b75419dbDf2FEfF21445";
const VOTING_ADDRESS = process.env.P2P_VOTING_V2_ADDRESS || "0x124c2C6945A239739B18EF1a92F45D5b061fEAE1";

// Private keys from .env
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const KEY_ONE = process.env.KEY_ONE;
const KEY_TWO = process.env.KEY_TWO;
const KEY_THREE = process.env.KEY_THREE;

if (!PRIVATE_KEY || !KEY_ONE || !KEY_TWO) {
    console.error("❌ Missing required private keys in .env (PRIVATE_KEY, KEY_ONE, KEY_TWO)");
    process.exit(1);
}

// Contract ABIs
const MARKET_MANAGER_ABI = [
    "function createMarket(string memory ipfsHash, bool isMultiOption, uint256 maxOptions, address paymentToken, uint256 minStake, uint256 creatorDeposit, uint256 creatorOutcome, uint256 stakeDurationMinutes, uint256 resolutionDurationMinutes, uint8 marketType, address priceFeed, uint256 priceThreshold) external payable returns (uint256)",
    "function endMarket(uint256 marketId) external",
    "function requestP2PResolution(uint256 marketId, bytes memory claim, uint256 optionId) external",
    "function disputeOracle(uint256 marketId) external",
    "function resolveP2PMarket(uint256 marketId) external",
    "function placeStakeWithToken(uint256 marketId, uint256 option, uint256 amount) external",
    "function getMarket(uint256 marketId) external view returns (tuple(address creator, string ipfsHash, bool isMultiOption, uint256 maxOptions, address paymentToken, uint256 minStake, uint256 creatorDeposit, uint256 creatorOutcome, uint256 startTime, uint256 stakeEndTime, uint256 endTime, uint256 resolutionEndTime, uint8 state, uint256 winningOption, bool isResolved, uint8 marketType, address priceFeed, uint256 priceThreshold, bytes32 p2pAssertionId, bool p2pAssertionMade))",
    "event MarketCreated(uint256 indexed marketId, address indexed creator, string ipfsHash)"
];

const ORACLE_ABI = [
    "function assertTruthWithDefaults(bytes memory claim, address asserter, uint256 optionId) external returns (bytes32)",
    "function disputeAssertion(bytes32 assertionId, address disputer) external",
    "function getAssertion(bytes32 assertionId) external view returns (bytes memory claim, address asserter, address disputer, uint256 assertionTime, uint256 assertionDeadline, uint256 expirationTime, bool settled, bool result, address currency, uint256 bond, bytes32 identifier, bytes memory ancillaryData, uint256 optionId)",
    "function settleAssertion(bytes32 assertionId) external",
    "function getAssertionResult(bytes32 assertionId) external view returns (bool result, uint256 optionId)",
    "function getMinimumBond(address currency) external view returns (uint256)"
];

const VOTING_ABI = [
    "function requestPrice(bytes32 identifier, uint256 time, bytes memory ancillaryData) external returns (bytes32)",
    "function stake(uint256 amount) external",
    "function vote(bytes32 requestId, int256 price) external",
    "function resolveVote(bytes32 requestId) external",
    "function requests(bytes32) external view returns (bytes32 identifier, uint256 time, bytes memory ancillaryData, uint256 deadline, uint256 totalVotes, bool resolved, int256 result)",
    "function getPrice(bytes32 identifier, uint256 time, bytes memory ancillaryData) external view returns (int256)"
];

const ERC20_ABI = [
    "function approve(address spender, uint256 amount) external returns (bool)",
    "function allowance(address owner, address spender) external view returns (uint256)",
    "function balanceOf(address owner) external view returns (uint256)"
];

// Helper function to sleep with timeout protection
async function sleep(seconds) {
    if (seconds <= 0) return;
    
    console.log(`   ⏱️  Sleeping ${seconds} seconds...`);
    const endTime = Date.now() + (seconds * 1000);
    let lastUpdate = Date.now();
    
    const updateInterval = setInterval(() => {
        const remaining = Math.max(0, Math.floor((endTime - Date.now()) / 1000));
        const now = Date.now();
        
        // Update every 5 seconds to avoid spam
        if (now - lastUpdate >= 5000) {
            if (remaining > 0) {
                process.stdout.write(`\r   ⏱️  ${remaining} seconds remaining...`);
                lastUpdate = now;
            } else {
                clearInterval(updateInterval);
                process.stdout.write('\r   ✅ Time reached!                    \n');
            }
        }
    }, 1000);
    
    try {
        await new Promise(resolve => setTimeout(resolve, seconds * 1000));
    } finally {
        clearInterval(updateInterval);
    }
}

// Helper to wait until a specific timestamp with timeout and staleness checks
async function waitUntil(timestamp, maxWaitSeconds = null) {
    const now = Math.floor(Date.now() / 1000);
    let waitTime = timestamp - now + 5; // Add 5 sec buffer
    
    // If timestamp is in the past, check if it's too stale
    if (waitTime < 0) {
        const staleTime = now - timestamp;
        if (staleTime > 300) { // More than 5 minutes stale
            throw new Error(`Timestamp is too stale (${staleTime} seconds old). Market may have already progressed.`);
        }
        console.log("   ⚠️  Timestamp already passed, but within acceptable range");
        return;
    }
    
    // Cap wait time if maxWaitSeconds is provided
    if (maxWaitSeconds && waitTime > maxWaitSeconds) {
        console.warn(`   ⚠️  Wait time (${waitTime}s) exceeds max (${maxWaitSeconds}s), capping...`);
        waitTime = maxWaitSeconds;
    }
    
    console.log(`   ⏱️  Waiting ${waitTime} seconds (until ${new Date(timestamp * 1000).toLocaleTimeString()})...`);
    
    // Sleep in chunks to allow for interruption and staleness checks
    const chunkSize = 30; // Check every 30 seconds
    let remaining = waitTime;
    
    while (remaining > 0) {
        const sleepTime = Math.min(chunkSize, remaining);
        
        // Check if timestamp is still valid (not too stale)
        const currentTime = Math.floor(Date.now() / 1000);
        if (timestamp < currentTime - 300) {
            throw new Error("Timestamp became stale during wait. Aborting.");
        }
        
        await sleep(sleepTime);
        remaining -= sleepTime;
        
        if (remaining > 0) {
            // Recalculate remaining time in case of clock drift
            const newNow = Math.floor(Date.now() / 1000);
            const newRemaining = timestamp - newNow + 5;
            if (newRemaining > 0 && newRemaining < remaining) {
                remaining = newRemaining;
            }
        }
    }
    
    console.log("   ✅ Target time reached!");
}

async function main() {
    const rpcUrl = process.env.PEPE_RPC_URL || "https://rpc-pepu-v2-mainnet-0.t.conduit.xyz";
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    
    // Create wallets
    const walletCreator = new ethers.Wallet(PRIVATE_KEY, provider);
    const walletKeyOne = new ethers.Wallet(KEY_ONE, provider);
    const walletKeyTwo = new ethers.Wallet(KEY_TWO, provider);
    const walletKeyThree = KEY_THREE ? new ethers.Wallet(KEY_THREE, provider) : null;
    
    console.log("🚀 Starting Automated Market Test");
    console.log("Creator:", walletCreator.address);
    console.log("Key One:", walletKeyOne.address);
    console.log("Key Two:", walletKeyTwo.address);
    if (walletKeyThree) console.log("Key Three:", walletKeyThree.address);
    
    // Contract instances
    const marketManager = new ethers.Contract(MARKET_MANAGER_ADDRESS, MARKET_MANAGER_ABI, provider);
    const oracle = new ethers.Contract(ORACLE_ADDRESS, ORACLE_ABI, provider);
    const voting = new ethers.Contract(VOTING_ADDRESS, VOTING_ABI, provider);
    const p2pToken = new ethers.Contract(P2P_TOKEN_ADDRESS, ERC20_ABI, provider);
    
    // Get minimum bond
    const minimumBond = await oracle.getMinimumBond(P2P_TOKEN_ADDRESS);
    console.log("\n💰 Minimum Bond:", ethers.formatEther(minimumBond), "P2P");
    
    // ============================================
    // STEP 1: Create Market
    // ============================================
    console.log("\n📝 Step 1: Creating Market...");
    const marketTitle = "Will Drew buy a hoodie by the end of this market?";
    const marketDescription = "This market resolves based on whether Drew purchases a hoodie before the market ends. Resolution will be determined through the Optimistic Oracle.";
    const marketOptions = ["Yes", "No"];
    const categories = ["Personal", "Shopping"];
    const vanityLink = `drew-hoodie-${Date.now()}`;
    
    // Calculate timestamps
    const now = Math.floor(Date.now() / 1000);
    const stakeEndTime = now + (5 * 60); // 5 minutes from now
    const endTime = now + (6 * 60); // 6 minutes from now
    const stakeDurationMinutes = 5;
    const resolutionDurationMinutes = 6;
    
    console.log("   Title:", marketTitle);
    console.log("   Stake End:", new Date(stakeEndTime * 1000).toLocaleTimeString());
    console.log("   Market End:", new Date(endTime * 1000).toLocaleTimeString());
    
    // Step 1a: Upload image to IPFS (matching create-test-market.js pattern)
    const LIGHTHOUSE_API_KEY = process.env.LIGHTHOUSE_API_KEY || '91729f56.8c58e79bdc194453b56d2b826d2daefb';
    // Use absolute path like create-test-market.js
    const imagePath = path.join(__dirname, "..", "public", "P2PFINAL-removebg-preview-removebg-preview.png");
    let imageUrl = "";
    
    console.log("\n   1. Uploading image to IPFS...");
    try {
        if (!fs.existsSync(imagePath)) {
            console.log("   ⚠️  Image file not found:", imagePath);
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
                console.log("   ✅ Image uploaded to IPFS:", imageUrl);
            } else {
                console.log("   ⚠️  Failed to upload image, continuing without image...");
            }
        }
    } catch (error) {
        console.log("   ⚠️  Error uploading image:", error.message);
        console.log("   Continuing without image...");
    }
    
    // Step 1b: Prepare metadata
    console.log("\n   2. Preparing market metadata...");
    const metadata = {
        title: marketTitle,
        description: marketDescription,
        options: marketOptions,
        categories: categories,
        imageUrl: imageUrl,
        vanityLink: vanityLink,
        resources: [],
        links: []
    };
    
    // Step 1c: Upload metadata to IPFS using Lighthouse
    console.log("   3. Uploading metadata to IPFS...");
    let ipfsHash;
    try {
        const uploadResponse = await lighthouse.uploadText(
            JSON.stringify(metadata),
            LIGHTHOUSE_API_KEY
        );
        
        if (uploadResponse && uploadResponse.data && uploadResponse.data.Hash) {
            ipfsHash = uploadResponse.data.Hash;
            console.log("   ✅ Metadata uploaded to IPFS:", ipfsHash);
        } else {
            throw new Error("Invalid upload response");
        }
    } catch (error) {
        console.error("   ❌ Failed to upload to IPFS:", error.message);
        // Fallback: use a placeholder hash (not recommended for production)
        ipfsHash = "QmPlaceholderHashForTestMarket123456789";
        console.log("   ⚠️  Using placeholder hash (market may not display correctly)");
    }
    
    // Approve tokens for creator deposit (25 P2P)
    const creatorDeposit = ethers.parseEther("25");
    const marketCreationFee = ethers.parseEther("1");
    const totalNeeded = creatorDeposit + marketCreationFee;
    
    console.log("\n   Approving P2P tokens for market creation...");
    const approveMarketTx = await p2pToken.connect(walletCreator).approve(MARKET_MANAGER_ADDRESS, totalNeeded * 2n);
    await approveMarketTx.wait();
    console.log("   ✅ Approved");
    
    // Create market
    console.log("\n   Creating market on blockchain...");
    const createMarketTx = await marketManager.connect(walletCreator).createMarket(
        ipfsHash,
        false, // isMultiOption
        2, // maxOptions
        P2P_TOKEN_ADDRESS, // P2P Token
        ethers.parseEther("0.1"), // minStake
        creatorDeposit, // creatorDeposit (25 P2P)
        1, // creatorOutcome (YES)
        stakeDurationMinutes,
        resolutionDurationMinutes,
        1, // marketType: P2POPTIMISTIC
        "0x0000000000000000000000000000000000000000", // priceFeed (not used)
        0, // priceThreshold (not used)
        { value: marketCreationFee } // Market creation fee in ETH
    );
    
    console.log("   📝 Transaction sent:", createMarketTx.hash);
    console.log("   ⏳ Waiting for confirmation...");
    const createReceipt = await createMarketTx.wait();
    console.log("   ✅ Transaction confirmed in block:", createReceipt.blockNumber);
    
    // Get market ID by querying the contract - find the market we just created
    console.log("   🔍 Finding market ID...");
    let marketId = null;
    // Check markets starting from 1 up to 1000
    for (let i = 1; i < 1000; i++) {
        try {
            const market = await marketManager.getMarket(i);
            if (market.creator.toLowerCase() === walletCreator.address.toLowerCase() && 
                market.ipfsHash === ipfsHash) {
                marketId = i;
                break;
            }
        } catch {
            continue;
        }
    }
    
    if (!marketId) {
        console.error("   ❌ Could not find market ID");
        process.exit(1);
    }
    
    console.log("   ✅ Market created! Market ID:", marketId);
    console.log("   ✅ Market created! Market ID:", marketId);
    
    // ============================================
    // STEP 2: Stake on NO with KEY_ONE
    // ============================================
    console.log("\n💰 Step 2: Staking on NO with KEY_ONE...");
    await sleep(5); // Wait 5 seconds
    
    const stakeAmount = ethers.parseEther("30");
    console.log("   Staking amount:", ethers.formatEther(stakeAmount), "P2P");
    console.log("   Option: NO (option 2)");
    
    // Approve tokens for staking
    const approveStakeTx = await p2pToken.connect(walletKeyOne).approve(MARKET_MANAGER_ADDRESS, stakeAmount * 2n);
    await approveStakeTx.wait();
    console.log("   ✅ Approved tokens");
    
    // Stake on option 2 (NO)
    const stakeTx = await marketManager.connect(walletKeyOne).placeStakeWithToken(
        marketId,
        2, // Option 2 = NO
        stakeAmount,
        { gasLimit: 500000 }
    );
    await stakeTx.wait();
    console.log("   ✅ Staked 30 P2P on NO");
    
    // ============================================
    // STEP 3: Wait for market to end (bot will end it)
    // ============================================
    console.log("\n⏳ Step 3: Waiting for market to end (bot will handle ending)...");
    
    // Get market data to check end time
    let marketData = await marketManager.getMarket(marketId);
    const marketEndTime = Number(marketData.endTime);
    const marketEndTimePlus30Sec = marketEndTime + 30; // 6:30 min
    
    console.log("   Market end time:", new Date(marketEndTime * 1000).toLocaleTimeString());
    console.log("   Will wait until:", new Date(marketEndTimePlus30Sec * 1000).toLocaleTimeString());
    console.log("   (Bot should end the market automatically)");
    
    // Wait for market to be ended by bot
    await waitUntil(marketEndTimePlus30Sec, 600); // Max 10 minutes wait
    
    // Verify market is ended
    let attempts = 0;
    let marketEnded = false;
    while (attempts < 10 && !marketEnded) {
        marketData = await marketManager.getMarket(marketId);
        if (marketData.state === 1) { // MarketState.Ended
            marketEnded = true;
            console.log("   ✅ Market is ended");
        } else {
            console.log(`   ⏳ Market still active (state: ${marketData.state}), waiting 5 more seconds...`);
            await sleep(5);
            attempts++;
        }
    }
    
    if (!marketEnded) {
        console.error("   ❌ Market was not ended after waiting. Proceeding anyway...");
    }
    
    // ============================================
    // STEP 4: Make Assertion with KEY_TWO as YES
    // ============================================
    console.log("\n📢 Step 4: Making Assertion with KEY_TWO as YES...");
    
    // Check approval for KEY_TWO
    const keyTwoAllowance = await p2pToken.allowance(walletKeyTwo.address, MARKET_MANAGER_ADDRESS);
    console.log("   Current allowance:", ethers.formatEther(keyTwoAllowance), "P2P");
    
    if (keyTwoAllowance < minimumBond) {
        console.log("   Approving tokens for assertion...");
        const approveAssertTx = await p2pToken.connect(walletKeyTwo).approve(MARKET_MANAGER_ADDRESS, minimumBond * 2n);
        await approveAssertTx.wait();
        console.log("   ✅ Approved");
    }
    
    // Make assertion
    const claimText = "Yes";
    const claimBytes = ethers.toUtf8Bytes(claimText);
    const assertTx = await marketManager.connect(walletKeyTwo).requestP2PResolution(
        marketId,
        claimBytes,
        1 // optionId: 1 = YES
    );
    const assertReceipt = await assertTx.wait();
    console.log("   ✅ Assertion made");
    
    // Get assertion ID from market
    const updatedMarket = await marketManager.getMarket(marketId);
    const assertionId = updatedMarket.p2pAssertionId;
    console.log("   Assertion ID:", assertionId);
    
    // Get assertion details
    const assertion = await oracle.getAssertion(assertionId);
    const assertionDeadline = Number(assertion[4]); // assertionDeadline
    const expirationTime = Number(assertion[5]); // expirationTime
    
    console.log("   Assertion deadline:", new Date(assertionDeadline * 1000).toLocaleTimeString());
    console.log("   Expiration time:", new Date(expirationTime * 1000).toLocaleTimeString());
    
    // ============================================
    // STEP 5: Wait for Dispute Window
    // ============================================
    console.log("\n⏳ Step 5: Waiting for dispute window (assertion window ends)...");
    console.log("   Assertion window: 3 minutes");
    await waitUntil(assertionDeadline, 300); // Max 5 minutes wait
    
    // ============================================
    // STEP 6: Dispute with KEY_ONE as NO
    // ============================================
    console.log("\n❌ Step 6: Disputing with KEY_ONE as NO...");
    
    // Check approval for KEY_ONE
    const keyOneAllowance = await p2pToken.allowance(walletKeyOne.address, MARKET_MANAGER_ADDRESS);
    console.log("   Current allowance:", ethers.formatEther(keyOneAllowance), "P2P");
    
    if (keyOneAllowance < minimumBond) {
        console.log("   Approving tokens for dispute...");
        const approveDisputeTx = await p2pToken.connect(walletKeyOne).approve(MARKET_MANAGER_ADDRESS, minimumBond * 2n);
        await approveDisputeTx.wait();
        console.log("   ✅ Approved");
    }
    
    // Dispute
    const disputeTx = await marketManager.connect(walletKeyOne).disputeOracle(marketId);
    await disputeTx.wait();
    console.log("   ✅ Dispute submitted");
    
    // Get request ID for voting (calculated same way as contract)
    const requestId = ethers.keccak256(
        ethers.solidityPacked(
            ["bytes32", "uint256", "bytes"],
            [assertion[10], assertion[3], assertion[11]] // identifier, assertionTime, ancillaryData
        )
    );
    console.log("   Vote Request ID:", requestId);
    
    // ============================================
    // STEP 7: Stake and Vote
    // ============================================
    console.log("\n🗳️  Step 7: Staking and Voting...");
    
    // Voting plan:
    // - PRIVATE_KEY: stake 12, vote YES (1)
    // - KEY_ONE: stake 10, vote NO (0)
    // - KEY_TWO: stake 10, vote NO (0)
    // Total: 32 tokens staked, NO should win (20 vs 12)
    
    const votingWallets = [
        { wallet: walletCreator, stake: ethers.parseEther("12"), vote: 1, name: "PRIVATE_KEY (YES)" },
        { wallet: walletKeyOne, stake: ethers.parseEther("10"), vote: 0, name: "KEY_ONE (NO)" },
        { wallet: walletKeyTwo, stake: ethers.parseEther("10"), vote: 0, name: "KEY_TWO (NO)" }
    ];
    
    for (const { wallet, stake, vote, name } of votingWallets) {
        try {
            console.log(`\n   ${name}:`);
            
            // Approve voting contract
            const approveVoteTx = await p2pToken.connect(wallet).approve(VOTING_ADDRESS, stake * 2n);
            await approveVoteTx.wait();
            console.log("      ✅ Approved");
            
            // Stake
            const stakeVoteTx = await voting.connect(wallet).stake(stake);
            await stakeVoteTx.wait();
            console.log(`      ✅ Staked ${ethers.formatEther(stake)} P2P`);
            
            // Vote
            const voteTx = await voting.connect(wallet).vote(requestId, vote);
            await voteTx.wait();
            console.log(`      ✅ Voted ${vote === 1 ? "YES" : "NO"}`);
        } catch (error) {
            console.error(`      ❌ Failed:`, error.message);
        }
    }
    
    // ============================================
    // STEP 8: Wait for Voting Deadline
    // ============================================
    console.log("\n⏳ Step 8: Waiting for voting deadline...");
    
    const voteRequest = await voting.requests(requestId);
    const votingDeadline = Number(voteRequest[3]);
    console.log("   Voting deadline:", new Date(votingDeadline * 1000).toLocaleTimeString());
    console.log("   Voting period: 2 minutes");
    
    await waitUntil(votingDeadline, 300); // Max 5 minutes wait (in case voting period is longer)
    
    // ============================================
    // STEP 9: Resolve Vote
    // ============================================
    console.log("\n📊 Step 9: Resolving vote...");
    
    try {
        const resolveVoteTx = await voting.connect(walletCreator).resolveVote(requestId);
        await resolveVoteTx.wait();
        console.log("   ✅ Vote resolved");
        
        // Get result
        const price = await voting.getPrice(assertion[10], assertion[3], assertion[11]);
        console.log("   Voting result:", price.toString(), price > 0 ? "(YES)" : "(NO)");
    } catch (error) {
        console.error("   ❌ Vote resolution error:", error.message);
    }
    
    // ============================================
    // STEP 10: Wait for Oracle Expiration and Settle
    // ============================================
    console.log("\n⏳ Step 10: Waiting for oracle expiration...");
    console.log("   Dispute window: 2 minutes");
    await waitUntil(expirationTime, 300); // Max 5 minutes wait
    
    console.log("\n✅ Step 11: Settling oracle...");
    try {
        const settleTx = await oracle.connect(walletCreator).settleAssertion(assertionId);
        await settleTx.wait();
        console.log("   ✅ Oracle settled");
        
        const [result, optionId] = await oracle.getAssertionResult(assertionId);
        console.log("   Final result:", result ? "TRUE (YES won)" : "FALSE (NO won)");
        console.log("   Option ID:", optionId.toString());
    } catch (error) {
        console.error("   ❌ Settlement error:", error.message);
    }
    
    // ============================================
    // STEP 11: Resolve Market
    // ============================================
    console.log("\n🎯 Step 12: Resolving market...");
    try {
        const resolveMarketTx = await marketManager.connect(walletCreator).resolveP2PMarket(marketId);
        await resolveMarketTx.wait();
        console.log("   ✅ Market resolved");
        
        const finalMarket = await marketManager.getMarket(marketId);
        console.log("   Winning option:", finalMarket.winningOption.toString());
    } catch (error) {
        console.error("   ❌ Market resolution error:", error.message);
    }
    
    console.log("\n🎉 Automated test complete!");
    console.log("Market ID:", marketId);
    console.log("View market: /market/" + marketId);
}

main().catch(console.error);
