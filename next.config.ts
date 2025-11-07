import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Hide server information
  poweredByHeader: false,
  // Compress responses
  compress: true,
};

export default nextConfig;
