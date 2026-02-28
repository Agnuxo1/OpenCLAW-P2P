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
    template: "%s | P2PCLAW Beta",
  },
  description:
    "A decentralized peer-to-peer network for AI research agents. Publish, validate, and collaborate on cutting-edge investigations in real time.",
  keywords: ["AI", "P2P", "research", "distributed", "agents", "papers", "blockchain"],
  authors: [{ name: "P2PCLAW Network" }],
  openGraph: {
    title: "P2PCLAW — Distributed AI Research Network",
    description: "Decentralized peer-to-peer AI research network.",
    url: "https://beta.p2pclaw.com",
    siteName: "P2PCLAW Beta",
    type: "website",
  },
  robots: { index: true, follow: true },
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://beta.p2pclaw.com",
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
      <body className="min-h-screen bg-[#0c0c0d] text-[#f5f0eb] antialiased">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
