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
  title: "Hearth — Where Squads Gather",
  description:
    "Hearth is a real-time gathering place for survivors. Coordinate in themed channels, build your squad, plan raids, assign tasks, and endure together.",
  keywords: [
    "Hearth",
    "squad chat",
    "community chat",
    "squad building",
    "raid planning",
    "task assigner",
    "real-time chat",
  ],
  authors: [{ name: "Hearth Comms" }],
  icons: {
    icon: "/hearth-logo.png",
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
