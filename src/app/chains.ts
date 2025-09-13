import { http } from 'wagmi';
import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import type { Chain } from 'wagmi/chains';

export const pepuMainnet: Chain = {
  id: 97741,
  name: 'Pepe Unchained V2',
  nativeCurrency: {
    name: 'PEPU',
    symbol: 'PEPU',
    decimals: 18,
  },
  rpcUrls: {
    default: { http: ['https://rpc-pepu-v2-mainnet-0.t.conduit.xyz'] },
    public: { http: ['https://rpc-pepu-v2-mainnet-0.t.conduit.xyz'] },
  },
  blockExplorers: {
    default: { 
      name: 'PEPU Explorer', 
      url: 'https://explorer-pepu-v2-mainnet-0.t.conduit.xyz'
    },
  },
  testnet: false,
};

export const config = getDefaultConfig({
  appName: 'Peer2Pepu',
  projectId: 'test123', // Temporary for testing
  chains: [pepuMainnet],
  ssr: true,
  transports: {
    [pepuMainnet.id]: http(),
  },
});
