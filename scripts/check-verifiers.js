require('dotenv').config();
const { ethers } = require('ethers');

// Config
const RPC_URL = 'https://rpc-pepu-v2-mainnet-0.t.conduit.xyz';
const VERIFICATION_ADDRESS = process.env.NEXT_PUBLIC_P2P_VERIFICATION_ADDRESS;

if (!VERIFICATION_ADDRESS) {
  console.error('❌ Missing NEXT_PUBLIC_P2P_VERIFICATION_ADDRESS in .env');
  process.exit(1);
}

// Minimal ABI for ValidationCore (P2PVerification)
const VERIFICATION_ABI = [
  { "inputs": [], "name": "getVerifiers", "outputs": [{ "name": "", "type": "address[]" }], "stateMutability": "view", "type": "function" },
  { "inputs": [{ "name": "", "type": "address" }], "name": "isVerifier", "outputs": [{ "name": "", "type": "bool" }], "stateMutability": "view", "type": "function" },
  { "inputs": [], "name": "REQUIRED_QUORUM", "outputs": [{ "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" }
];

async function main() {
  try {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const verification = new ethers.Contract(VERIFICATION_ADDRESS, VERIFICATION_ABI, provider);

    // Optional CLI arg: address to check
    const addressToCheck = process.argv[2];

    // Fetch data
    const [verifiers, quorum] = await Promise.all([
      verification.getVerifiers(),
      verification.REQUIRED_QUORUM().catch(() => 0)
    ]);

    console.log('🧾 Verification Contract:', VERIFICATION_ADDRESS);
    console.log('👥 Verifiers Count:', verifiers.length);
    console.log('🔢 Required Quorum:', Number(quorum));
    console.log('👥 Verifiers List:');
    verifiers.forEach((v, i) => console.log(`  ${i + 1}. ${v}`));

    if (addressToCheck) {
      const isVer = await verification.isVerifier(addressToCheck);
      console.log('\n🔎 Address Check:', addressToCheck);
      console.log(isVer ? '✅ This address IS a verifier' : '❌ This address is NOT a verifier');
    } else {
      console.log('\nTip: pass an address to check verifier status');
      console.log('Usage: node scripts/check-verifiers.js 0xYourAddress');
    }
  } catch (err) {
    console.error('❌ Error:', err.message || err);
    process.exit(1);
  }
}

main();