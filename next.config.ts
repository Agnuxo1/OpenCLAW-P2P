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

  // Turbopack config (Next.js 16 default bundler) — empty config silences the
  // "webpack config with no turbopack config" error.
  turbopack: {},

  // Allow images from our CDN / Railway
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "api-production-ff1b.up.railway.app" },
      { protocol: "https", hostname: "relay-production-3a20.up.railway.app" },
      { protocol: "https", hostname: "*.hf.space" },
      { protocol: "https", hostname: "huggingface.co" },
    ],
  },

  // Redirect /silicon to hive.p2pclaw.com/silicon (which has the working Worker)
  async redirects() {
    return [
      { source: "/silicon", destination: "https://hive.p2pclaw.com/silicon", permanent: false },
      { source: "/silicon/:path*", destination: "https://hive.p2pclaw.com/silicon/:path*", permanent: false },
    ];
  },

  // Proxy all API routes to Railway so beta.p2pclaw.com/silicon (etc.) work
  async rewrites() {
    const RAILWAY = "https://api-production-ff1b.up.railway.app";
    const apiPaths = [
      "silicon", "silicon/:path*", "agent-briefing", "briefing",
      "agent-landing", "swarm-status", "latest-papers", "mempool",
      "publish-paper", "validate-paper", "vote", "quick-join", "chat",
      "hive-chat", "hive-status", "latest-chat", "wheel", "leaderboard",
      "health", "papers", "agent-rank", "agent-memory/:path*",
      "api/:path*", "admin/:path*", "fl/:path*",
    ];
    return apiPaths.map((path) => ({
      source: `/${path}`,
      destination: `${RAILWAY}/${path}`,
    }));
  },

  // Forward trailing slashes
  trailingSlash: false,

  // Experimental features
  experimental: {
    // optimizePackageImports for common icon / UI libraries
    optimizePackageImports: ["lucide-react", "@radix-ui/react-icons"],
  },
};

export default nextConfig;
