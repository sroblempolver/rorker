import type { Metadata, Viewport } from "next";
import { Barlow, Chakra_Petch } from "next/font/google";
import "./globals.css";

const chakra = Chakra_Petch({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-chakra" });
const barlow = Barlow({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-barlow" });

export const metadata: Metadata = {
  title: "Rorker",
  description: "Every job, every room, one live map of the building.",
};
export const viewport: Viewport = { themeColor: "#0e1217", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${chakra.variable} ${barlow.variable}`}>
      <body>{children}</body>
    </html>
  );
}
