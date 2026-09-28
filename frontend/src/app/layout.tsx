import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import { Header } from "@/components/header";
import { AppShell } from "@/components/app-shell";
import { PwaInstall } from "@/components/pwa-install";
import { siteUrl, siteDescription } from "@/lib/seo";
import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });
export const metadata: Metadata = {
  metadataBase: siteUrl,
  title: { default: "Neba — local help and paid tasks in Nigeria", template: "%s | Neba" },
  description: siteDescription,
  robots: { index: false, follow: false },
  verification: { google: process.env.GOOGLE_SITE_VERIFICATION },
  appleWebApp: { capable: true, title: "Neba", statusBarStyle: "default" },
  icons: { icon: "/icons/neba-192.png", apple: "/icons/neba-apple-180.png" },
};
export const viewport: Viewport = { themeColor: "#087f5b", width: "device-width", initialScale: 1, viewportFit: "cover" };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en-NG" data-scroll-behavior="smooth"><body className={geist.variable}><a className="skip-link" href="#main-content">Skip to content</a><Header /><AppShell>{children}</AppShell><PwaInstall /></body></html>;
}
