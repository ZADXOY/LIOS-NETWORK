import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Last Island — Survivor Comms Network",
  description:
    "Real-time survival comms for Last Island of Survival. Find legions, trade loot, plan raids, assign tasks, and survive the island together.",
  keywords: [
    "Last Island of Survival",
    "survival game",
    "game chat",
    "legion recruitment",
    "PvP",
    "trading",
    "raids",
    "survivor comms",
  ],
  authors: [{ name: "Island Comms" }],
  icons: {
    icon: "/island-logo.png",
    apple: "/island-logo.png",
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Last Island",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
