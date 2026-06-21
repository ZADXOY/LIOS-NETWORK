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
  title: "Last Island of Survival — Survivor Chat",
  description:
    "Real-time chat hub for Last Island of Survival players. Find guilds, trade loot, plan raids, and survive together.",
  keywords: [
    "Last Island of Survival",
    "survival game",
    "game chat",
    "guild recruitment",
    "PvP",
    "trading",
    "raids",
  ],
  authors: [{ name: "Survivor Comms" }],
  icons: {
    icon: "/app-logo.webp",
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
