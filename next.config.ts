import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Prevent Gun.js from being bundled on the server (it's browser-only)
  webpack: (config, { isServer }) => {
    if (isServer) {
      const existing = Array.isArray(config.externals) ? config.externals : [];
      config.externals = [
        ...existing,
        "gun",
        "gun/sea",
        "gun/lib/enc",
        "gun/lib/radix",
        "gun/lib/radisk",
        "gun/lib/store",
        "gun/lib/rindexed",
      ];
    }
    return config;
  },

  // Allow images from our CDN / Railway
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "api-production-ff1b.up.railway.app" },
      { protocol: "https", hostname: "relay-production-3a20.up.railway.app" },
      { protocol: "https", hostname: "*.hf.space" },
      { protocol: "https", hostname: "huggingface.co" },
    ],
  },

  // Forward trailing slashes
  trailingSlash: false,

  // Strict experimental features
  experimental: {
    // optimizePackageImports for common icon / UI libraries
    optimizePackageImports: ["lucide-react", "@radix-ui/react-icons"],
  },
};

export default nextConfig;
