# Token Deployment Guide

This project contains two ERC20 token contracts: **P2P Token** and **PENK Token**.

## Contracts

- **P2PToken.sol** - P2P Token with symbol "P2P"
- **PENKToken.sol** - PENK Token with symbol "PENK"

Both tokens include:
- Standard ERC20 functionality
- Mint function (owner only)
- Burn function (anyone can burn their own tokens)
- Initial supply of 1,000,000 tokens

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Create .env file:**
   ```bash
   cp env.example .env
   ```
   
   Add your private key to the `.env` file:
   ```
   PRIVATE_KEY=your_private_key_here
   ```

## Deployment

### Compile Contracts
```bash
npx hardhat compile
```

### Deploy to Local Network
```bash
npx hardhat node
npx hardhat run scripts/deploy.js --network localhost
```

### Deploy to Base Sepolia Testnet
```bash
npx hardhat run scripts/deploy.js --network base_sepolia
```

### Deploy to Pepe Unchained V2 Testnet
```bash
npx hardhat run scripts/deploy.js --network pepe_unchained_v2_testnet
```

### Deploy to Pepe Unchained V2 Mainnet
```bash
npx hardhat run scripts/deploy.js --network pepe_unchained_v2
```

## Testing

Run the test suite:
```bash
npx hardhat test
```

## Network Configuration

The project is configured for the following networks:

- **base_sepolia**: Base Sepolia testnet
- **pepe_unchained_v2_testnet**: Pepe Unchained V2 testnet (Chain ID: 97740)
- **pepe_unchained_v2**: Pepe Unchained V2 mainnet (Chain ID: 97741)

## Gas Optimization

The contracts are compiled with:
- Solidity version: 0.8.20
- Optimizer enabled: true
- Optimizer runs: 200 (optimized for smaller bytecode)

## Contract Addresses

After deployment, the script will output the deployed contract addresses. Save these for future reference.
