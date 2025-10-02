require('dotenv').config();
require('@nomicfoundation/hardhat-toolbox');

module.exports = {
  solidity: {
    version: '0.8.20',
    settings: {
      optimizer: {
        enabled: true,
        runs: 1  // Very low runs value for smallest bytecode
      },
      viaIR: true  // Enable viaIR to fix stack too deep errors
    }
  },
  networks: {
    base_sepolia: {
      url: 'https://sepolia.base.org',
      chainId: 84532,
      accounts: [process.env.PRIVATE_KEY],
    },
    pepe_unchained_v2_testnet: {
      url: 'https://rpc-pepu-v2-testnet-vn4qxxp9og.t.conduit.xyz',
      chainId: 97740,
      accounts: [process.env.PRIVATE_KEY],
    },
    pepe_unchained_v2: {
      url: 'https://rpc-pepu-v2-mainnet-0.t.conduit.xyz',
      chainId: 97741,
      accounts: [process.env.PRIVATE_KEY],
    },
  },
  etherscan: {
    apiKey: {
      'base_sepolia': process.env.ETHERSCAN_API_KEY || 'empty',
      'pepe_unchained_v2': 'empty',
      'pepe_unchained_v2_testnet': 'empty'
    },
    customChains: [
      {
        network: "base_sepolia",
        chainId: 84532,
        urls: {
          apiURL: "https://api-sepolia.basescan.org/api",
          browserURL: "https://sepolia.basescan.org"
        }
      },
      {
        network: "pepe_unchained_v2",
        chainId: 97741,
        urls: {
          apiURL: "https://explorer-pepu-v2-mainnet-0.t.conduit.xyz/api",
          browserURL: "https://explorer-pepu-v2-mainnet-0.t.conduit.xyz:443"
        }
      },
      {
        network: "pepe_unchained_v2_testnet",
        chainId: 97740,
        urls: {
          apiURL: "https://explorer-pepu-v2-testnet-vn4qxxp9og.t.conduit.xyz/api",
          browserURL: "https://explorer-pepu-v2-testnet-vn4qxxp9og.t.conduit.xyz"
        }
      }
    ]
  }
};
