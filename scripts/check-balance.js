const { createPublicClient, http, formatEther } = require('viem');
const { privateKeyToAccount } = require('viem/accounts');
require('dotenv').config();

async function checkBalance() {
  try {
    // Get private key from environment
    const privateKey = process.env.PRIVATE_KEY;
    
    if (!privateKey) {
      throw new Error('PRIVATE_KEY not found in .env file');
    }

    // Ensure private key has 0x prefix
    const privateKeyWithPrefix = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;

    // Create account from private key
    const account = privateKeyToAccount(privateKeyWithPrefix);
    
    console.log('🔍 Checking wallet balance...');
    console.log('Address:', account.address);
    console.log('');

    // Pepe Unchained V2 Mainnet configuration
    const chain = {
      id: 97741,
      name: 'Pepe Unchained V2',
      network: 'pepe_unchained_v2',
      nativeCurrency: {
        decimals: 18,
        name: 'PEPU',
        symbol: 'PEPU',
      },
      rpcUrls: {
        default: {
          http: ['https://rpc-pepu-v2-mainnet-0.t.conduit.xyz'],
        },
      },
    };

    // Create public client for reading balance
    const client = createPublicClient({
      chain,
      transport: http(),
    });

    // Get balance
    const balance = await client.getBalance({ address: account.address });
    const balanceInEther = formatEther(balance);

    console.log('💰 Balance:');
    console.log(`   ${balanceInEther} PEPU`);
    console.log(`   (${balance.toString()} wei)`);
    console.log('');

  } catch (error) {
    console.error('❌ Error checking balance:', error.message);
    process.exit(1);
  }
}

checkBalance();

