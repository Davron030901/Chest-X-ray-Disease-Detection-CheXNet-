import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";

import "./globals.css";

const sans = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap" });

// Vercel injects VERCEL_URL at build time; without a metadataBase the OG image
// resolves against localhost and social previews break.
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
  ? process.env.NEXT_PUBLIC_SITE_URL
  : process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Radiograph AI — Explainable chest X-ray screening",
  description:
    "Educational CheXNet reproduction: DenseNet-121 predicts 14 thoracic pathologies from a chest X-ray and shows a Grad-CAM heatmap. Not a medical device.",
  keywords: ["CheXNet", "chest x-ray", "DenseNet-121", "Grad-CAM", "multi-label classification"],
  openGraph: {
    title: "Radiograph AI — Explainable chest X-ray screening",
    description:
      "14 thoracic pathologies, per-disease AUC, Grad-CAM localisation. Educational project, not a medical device.",
    type: "website",
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0A0E14" },
    { media: "(prefers-color-scheme: light)", color: "#F5F8FB" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <body className={`${sans.variable} ${mono.variable} font-sans antialiased`}>{children}</body>
    </html>
  );
}
