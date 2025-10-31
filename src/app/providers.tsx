'use client';

import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider } from 'wagmi';
import { config, pepuMainnet } from './chains';
import { RainbowKitProvider } from '@rainbow-me/rainbowkit';
import '@rainbow-me/rainbowkit/styles.css';
import { ThemeProvider } from './context/ThemeContext';

// Create QueryClient outside component to prevent recreation, but use state to ensure single instance
function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000 * 60 * 5, // 5 minutes
        gcTime: 1000 * 60 * 10, // 10 minutes
      },
    },
  });
}

export function Providers({ children }: { children: React.ReactNode }) {
  // Use useState with lazy initialization to ensure QueryClient is only created once
  const [queryClient] = useState(() => createQueryClient());

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          initialChain={pepuMainnet}
          showRecentTransactions={true}
        >
          <ThemeProvider>
            {children}
          </ThemeProvider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
