import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Hide server information
  poweredByHeader: false,
  // Compress responses
  compress: true,
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
