import type { Metadata, Viewport } from "next";
import { Big_Shoulders, Big_Shoulders_Stencil, IBM_Plex_Mono, Instrument_Sans } from "next/font/google";
import "./globals.css";

// Site-signage display face, a stencil cut for the wordmark, a plain body face, and a mono for element IDs.
const display = Big_Shoulders({ subsets: ["latin"], weight: ["600", "700", "800"], variable: "--font-signage" });
const stencil = Big_Shoulders_Stencil({ subsets: ["latin"], weight: ["800"], variable: "--font-stencil" });
const body = Instrument_Sans({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-body" });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["500", "600"], variable: "--font-tag" });

export const metadata: Metadata = {
  title: "Rorker",
  description: "Every job, every room, one live map of the building.",
};
export const viewport: Viewport = { themeColor: "#17181b", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${stencil.variable} ${body.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
