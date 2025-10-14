const { ethers } = require("hardhat");
require("dotenv").config();

async function main() {
    console.log('🔍 Checking supported tokens...');

    // Contract addresses
    const ADMIN_MANAGER_ADDRESS = process.env.NEXT_PUBLIC_P2P_ADMIN_ADDRESS;
    const RPC_URL = 'https://rpc-pepu-v2-mainnet-0.t.conduit.xyz';

    if (!ADMIN_MANAGER_ADDRESS) {
        throw new Error('Missing NEXT_PUBLIC_P2P_ADMIN_ADDRESS in .env');
    }

    // Create provider
    const provider = new ethers.JsonRpcProvider(RPC_URL);

    // AdminManager ABI
    const ADMIN_MANAGER_ABI = [
        {
            "inputs": [],
            "name": "getSupportedTokens",
            "outputs": [
                {"name": "tokens", "type": "address[]"},
                {"name": "symbols", "type": "string[]"}
            ],
            "stateMutability": "view",
            "type": "function"
        },
        {
            "inputs": [{"name": "token", "type": "address"}],
            "name": "isTokenSupported",
            "outputs": [{"name": "", "type": "bool"}],
            "stateMutability": "view",
            "type": "function"
        },
        {
            "inputs": [{"name": "token", "type": "address"}],
            "name": "getTokenSymbol",
            "outputs": [{"name": "", "type": "string"}],
            "stateMutability": "view",
            "type": "function"
        }
    ];

    const adminContract = new ethers.Contract(ADMIN_MANAGER_ADDRESS, ADMIN_MANAGER_ABI, provider);

    try {
        console.log(`📋 AdminManager: ${ADMIN_MANAGER_ADDRESS}`);
        console.log(`🌐 Network: Pepe Unchained Mainnet`);
        console.log('');

        // Get all supported tokens
        const [tokens, symbols] = await adminContract.getSupportedTokens();
        
        console.log(`✅ Found ${tokens.length} supported tokens:`);
        console.log('');

        for (let i = 0; i < tokens.length; i++) {
            const token = tokens[i];
            const symbol = symbols[i];
            
            // Check if it's native PEPU
            const isNative = token === '0x0000000000000000000000000000000000000000';
            
            console.log(`${i + 1}. ${symbol}`);
            console.log(`   Address: ${token}`);
            console.log(`   Type: ${isNative ? 'Native PEPU' : 'ERC20 Token'}`);
            console.log('');
        }

        // Check specific tokens
        const P2P_TOKEN_ADDRESS = process.env.NEXT_PUBLIC_P2P_TOKEN_ADDRESS;
        
        if (P2P_TOKEN_ADDRESS) {
            console.log(`🔍 Checking P2P Token: ${P2P_TOKEN_ADDRESS}`);
            const isSupported = await adminContract.isTokenSupported(P2P_TOKEN_ADDRESS);
            const tokenSymbol = await adminContract.getTokenSymbol(P2P_TOKEN_ADDRESS);
            
            console.log(`   Supported: ${isSupported ? '✅ Yes' : '❌ No'}`);
            console.log(`   Symbol: ${tokenSymbol}`);
            console.log('');
        }

        console.log('🎉 Token check complete!');

    } catch (error) {
        console.error('❌ Error checking supported tokens:', error.message);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });