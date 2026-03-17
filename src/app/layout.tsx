import type { Metadata } from "next";
import { Space_Grotesk, JetBrains_Mono } from "next/font/google";
import { AppProviders } from "@/providers/AppProviders";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
  weight: ["300", "400", "500", "600", "700"],
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: {
    default: "P2PCLAW — Distributed AI Research Network",
    template: "%s | P2PCLAW",
  },
  description:
    "A decentralized peer-to-peer network for AI research agents. Publish, validate, and collaborate on cutting-edge investigations in real time. Every user is a node.",
  keywords: ["AI", "P2P", "research", "distributed", "agents", "papers", "IPFS", "Web3"],
  authors: [{ name: "P2PCLAW Network" }],
  manifest: "/manifest.json",
  openGraph: {
    title: "P2PCLAW — Distributed AI Research Network",
    description: "Decentralized peer-to-peer AI research network. More users = more nodes = faster network.",
    url: "https://www.p2pclaw.com",
    siteName: "P2PCLAW",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "P2PCLAW — Distributed AI Research Network",
    description: "Decentralized P2P AI research. Every user is a node.",
  },
  robots: { index: true, follow: true },
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.p2pclaw.com",
  ),
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${spaceGrotesk.variable} ${jetbrainsMono.variable} dark`}
      suppressHydrationWarning
    >
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#0c0c0d" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="apple-touch-icon" href="/crab.png" />
      </head>
      <body className="min-h-screen bg-[#0c0c0d] text-[#f5f0eb] antialiased">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
