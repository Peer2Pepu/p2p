# Wallet Integration Setup

## Overview
This project now integrates with real wallets using RainbowKit and Wagmi for the PEPU testnet.

## Network Configuration
- **Network Name**: PEPU Testnet
- **Chain ID**: 97740
- **RPC URL**: https://rpc-pepu-v2-testnet-vn4qxxp9og.t.conduit.xyz
- **Explorer**: https://explorer-pepu-v2-testnet-vn4qxxp9og.t.conduit.xyz
- **Currency**: PEPU

## Feature

## 1 Wallet Connection
- Click the "Connect" button in the header to connect your wallet
- Supports MetaMask, WalletConnect, and other popular wallets
- Shows wallet address and connection status

### 2. Network Detection
- Automatically detects if you're on the correct network
- Shows network status indicators throughout the UI
- Provides easy network switching for wrong networks

### 3. Balance Display
- Shows PEPU token balance when connected to the correct network
- Updates in real-time
- Displays in both header and sidebar

### 4. Enhanced UI Elements
- **Header**: Network status, balance, and wallet info
- **Sidebar**: Detailed wallet status with network and balance
- **Main Content**: Wallet connection prompts and network warnings
- **Market Rows**: Trading buttons only appear when properly connected

## Setup Requirements

### 1. Install Dependencies
```bash
npm install @rainbow-me/rainbowkit wagmi viem @tanstack/react-query
```

### 2. WalletConnect Project ID
You need to get a Project ID from [WalletConnect Cloud](https://cloud.walletconnect.com/):
1. Go to https://cloud.walletconnect.com/
2. Sign up and create a new project
3. Copy the Project ID
4. Replace `YOUR_PROJECT_ID` in `src/app/providers.tsx`

### 3. Add to MetaMask (Optional)
Users can manually add the PEPU testnet to MetaMask:
- **Network Name**: PEPU Testnet
- **RPC URL**: https://rpc-pepu-v2-testnet-vn4qxxp9og.t.conduit.xyz
- **Chain ID**: 97740
- **Currency Symbol**: PEPU
- **Block Explorer**: https://explorer-pepu-v2-testnet-vn4qxxp9og.t.conduit.xyz

## Usage Flow

1. **Connect Wallet**: User clicks connect and authorizes their wallet
2. **Network Check**: App checks if wallet is on PEPU testnet
3. **Network Switch**: If on wrong network, user can switch easily
4. **Trading**: Once connected and on correct network, trading buttons appear
5. **Balance Updates**: PEPU balance is displayed and updated in real-time

## Security Features

- Network validation before allowing interactions
- Wallet connection state management
- Proper error handling for network mismatches
- Secure RPC endpoint usage

## Troubleshooting

### Common Issues:
1. **Wrong Network**: Use the "Switch to PEPU" button
2. **Connection Failed**: Check if wallet is unlocked and try again
3. **Balance Not Showing**: Ensure you're on the correct network
4. **RPC Errors**: Check network connectivity and RPC endpoint status

### Development Notes:
- All wallet interactions are handled through Wagmi hooks
- RainbowKit provides the UI components
- Network switching is handled automatically
- Balance updates are reactive and real-time
