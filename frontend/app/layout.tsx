import type { Metadata } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import "./globals.css";

const sans = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

const mono = Geist_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "FourCast — Four.meme DeFi Intelligence",
  description:
    "Real-time bonding curve oracle, capital router, and locked LP yield tracker for Four.meme on BNB Chain.",
  openGraph: {
    title: "FourCast",
    description: "Live DeFi intelligence for Four.meme on BNB Chain",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${sans.variable} ${mono.variable} antialiased min-h-screen`}>
        {children}
      </body>
    </html>
  );
}
