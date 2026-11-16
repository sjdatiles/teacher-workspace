import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";

// Self-hosted variable font (no runtime request to Google).
const nunito = localFont({
  src: "./fonts/nunito-latin-wght-normal.woff2",
  weight: "200 1000",
  variable: "--font-nunito",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Teacher Workspace", template: "%s · Teacher Workspace" },
  description:
    "A single workspace for teachers to plan classes, track teaching sessions, manage tasks and save resources.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f47b20",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={nunito.variable}>
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
