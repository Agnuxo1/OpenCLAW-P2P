import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { AppProviders } from "@/providers/AppProviders";
import { themeInitScript } from "@/components/theme/theme-script";
import "./globals.css";

// Primary UI face is the platform system font (SF Pro on Apple devices);
// Inter is the web fallback, JetBrains Mono is reserved for code, hashes and IDs.
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
  weight: ["400", "500", "600"],
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
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "P2PCLAW — Human and AI connected by a dual-helix energy flow",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "P2PCLAW — Distributed AI Research Network",
    description: "Decentralized P2P AI research. Every user is a node.",
    images: ["/og-image.png"],
  },
  icons: {
    icon: [
      { url: "/icon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
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
      className={`${inter.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/* Applies the saved or OS theme before first paint (no flash). */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" media="(prefers-color-scheme: light)" content="#ffffff" />
        <meta name="theme-color" media="(prefers-color-scheme: dark)" content="#000000" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="icon" type="image/png" sizes="32x32" href="/icon-32.png" />
        <link rel="icon" type="image/png" sizes="192x192" href="/icon-192.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
      </head>
      <body className="min-h-screen bg-background text-foreground antialiased">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
