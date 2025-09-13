# Market Data Scripts

This directory contains JavaScript scripts to interact with the P2P Market Manager contract and fetch market information.

## Scripts

### 1. `get-markets.js`
A comprehensive script that uses Hardhat to connect to the contract and fetch all market information.

**Usage:**
```bash
npm run get-markets
```

**Features:**
- Fetches all market IDs
- Gets detailed information for each market
- Shows option pools, bettor counts, supporter counts
- Displays market states and timing information
- Lists supported tokens
- Shows market creation fee

### 2. `get-markets-simple.js`
A standalone script that uses only ethers.js (no Hardhat dependency) to fetch market information.

**Usage:**
```bash
npm run get-markets-simple
```

**Features:**
- Same functionality as `get-markets.js`
- Can be run independently without Hardhat
- Uses public RPC endpoint
- Requires only ethers.js dependency

## Prerequisites

1. **Environment Variables**: Make sure you have a `.env` file with the required contract addresses:
   ```
   NEXT_PUBLIC_P2P_MARKETMANAGER_ADDRESS=0xAC0817BdB7375f396CB0943565eD1854935DEafa
   NEXT_PUBLIC_P2P_ANALYTICS_ADDRESS=0xA08D7FF6C4F40C516ae108825DEFBb5F807c4a81
   NEXT_PUBLIC_P2P_TREASURY_ADDRESS=0x01Bdd05467d190B0767879160dCecc6E775D54FD
   NEXT_PUBLIC_P2P_VERIFICATION_ADDRESS=0xE7BF506bA9B88017819ADba3c8298E6C0AcD135E
   NEXT_PUBLIC_P2P_TOKEN_ADDRESS=0x28dD14D951cc1b9fF32bDc27DCC7dA04FbfE3aF6
   ```

2. **Dependencies**: Install required packages:
   ```bash
   npm install
   ```

## Network Configuration

The scripts are configured to use the Pepe Unchained V2 Mainnet:
- **RPC URL**: `https://rpc-pepu-v2-mainnet-0.t.conduit.xyz`
- **Chain ID**: 97741

## Output Information

Both scripts provide comprehensive market information including:

- **Market Basics**: ID, creator, IPFS hash, type (linear/multi-option)
- **Configuration**: Max options, payment token, minimum stake
- **Timing**: Start time, end time, resolution end time
- **State**: Current state, winning option, resolution status
- **Pools**: Total pool, support pool, option-specific pools
- **Participants**: Bettor count, supporter count
- **Tokens**: Supported tokens and their symbols
- **Fees**: Market creation fee

## Error Handling

The scripts include error handling for:
- Missing environment variables
- Network connection issues
- Contract call failures
- Invalid market data

## Customization

You can modify the scripts to:
- Filter markets by specific criteria
- Export data to JSON/CSV format
- Add additional market metrics
- Change the RPC endpoint
- Modify output formatting

## Troubleshooting

1. **"Contract not found"**: Check that the contract address in `.env` is correct
2. **"Network error"**: Verify the RPC URL is accessible
3. **"Invalid market data"**: Some markets may be corrupted or deleted
4. **"Missing dependencies"**: Run `npm install` to install required packages
