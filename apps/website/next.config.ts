import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,

  // Optimize images
  images: {
    unoptimized: true,
  },

  // Trailing slashes for cleaner URLs
  trailingSlash: true,
};

export default nextConfig;
