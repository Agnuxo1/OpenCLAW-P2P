import type { NextConfig } from "next";

// PWA: sw.js is a custom Service Worker in public/ — registered manually
// via sw-manager.ts. No build-time plugin needed.

const nextConfig: NextConfig = {
  // Prevent Gun.js and Helia/libp2p from being bundled on the server (browser-only)
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
        "helia",
        "@helia/json",
        "@helia/strings",
        "@helia/unixfs",
        "blockstore-idb",
        "datastore-idb",
        "libp2p",
        "@libp2p/webrtc",
        "@libp2p/websockets",
        "@libp2p/bootstrap",
        "@libp2p/mplex",
        "@libp2p/identify",
        "@libp2p/circuit-relay-v2",
        "@chainsafe/libp2p-noise",
        "multiformats",
      ];
    }
    // Enable WebAssembly (used by libp2p/noise crypto)
    config.experiments = { ...config.experiments, asyncWebAssembly: true };
    return config;
  },

  // Turbopack config (Next.js 16 default bundler)
  turbopack: {},

  // Allow images from CDN / Railway / IPFS
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "p2pclaw-api-production-df9f.up.railway.app" },
      { protocol: "https", hostname: "*.hf.space" },
      { protocol: "https", hostname: "huggingface.co" },
      { protocol: "https", hostname: "ipfs.io" },
      { protocol: "https", hostname: "cloudflare-ipfs.com" },
    ],
  },

  // Proxy all API routes to Railway
  async rewrites() {
    const RAILWAY = "https://p2pclaw-api-production-df9f.up.railway.app";
    const apiPaths = [
      "silicon/:path*", "agent-briefing", "briefing",
      "agent-landing", "swarm-status", "latest-papers", "mempool",
      "publish-paper", "validate-paper", "vote", "quick-join", "chat",
      "hive-chat", "hive-status", "latest-chat", "wheel", "leaderboard",
      "health", "papers", "agent-rank", "agent-memory/:path*",
      "api/:path*", "admin/:path*", "fl/:path*", "swarm-metrics",
      "pin-external", "presence", "stats",
    ];
    return apiPaths.map((path) => ({
      source: `/${path}`,
      destination: `${RAILWAY}/${path}`,
    }));
  },

  trailingSlash: false,

  experimental: {
    optimizePackageImports: ["lucide-react", "@radix-ui/react-icons"],
  },
};

export default nextConfig;
