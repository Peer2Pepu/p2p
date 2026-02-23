import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Hide server information
  poweredByHeader: false,
  // Compress responses
  compress: true,
  // Headers - CSP must be set here for production (Vercel)
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline' https:; style-src 'self' 'unsafe-inline'; img-src 'self' data: https: ipfs:; font-src 'self' data:; connect-src 'self' https: wss: https://*.ipfs.* https://gateway.lighthouse.storage https://*.supabase.*; frame-ancestors 'none';",
          },
        ],
      },
    ];
  },
  // Webpack config for web3 libraries
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
    }
    return config;
  },
};

export default nextConfig;
