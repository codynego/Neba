import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import { Header } from "@/components/header";
import { AppShell } from "@/components/app-shell";
import { PwaInstall } from "@/components/pwa-install";
import { PushNotifications } from "@/components/push-notifications";
import { siteUrl, siteDescription } from "@/lib/seo";
import "./globals.css";
import "./opportunity-flow.css";
import "./opportunity-dashboard.css";
import "./onboarding-flow.css";
import "./opportunity-discover.css";
import "./homepage-rebrand.css";
import "./post-opportunity.css";
import "./post-opportunity-enhancements.css";
import "./dashboard-command.css";
import "./dashboard-credits.css";
import "./auth-focus.css";
import "./opportunity-apply.css";
import "./opportunity-messages.css";
import "./application-updates.css";
import "./operations/operations.css";
import "./verification-badges.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });
export const metadata: Metadata = {
  metadataBase: siteUrl,
  applicationName: "GetNeba",
  title: { default: "GetNeba — your personal opportunity radar", template: "%s | GetNeba" },
  description: siteDescription,
  robots: { index: false, follow: false },
  verification: { google: process.env.GOOGLE_SITE_VERIFICATION },
  openGraph: { title: "GetNeba — your personal opportunity radar", description: siteDescription, url: siteUrl, siteName: "GetNeba", locale: "en_NG", type: "website", images: [{ url: "/brand/getneba-social-preview-1200x630.png", width: 1200, height: 630, alt: "GetNeba — your personal opportunity radar" }] },
  twitter: { card: "summary_large_image", title: "GetNeba — your personal opportunity radar", description: siteDescription, images: ["/brand/getneba-social-preview-1200x630.png"] },
  appleWebApp: { capable: true, title: "GetNeba", statusBarStyle: "default" },
  icons: { icon: [{ url: "/icons/getneba-32.png", sizes: "32x32", type: "image/png" }, { url: "/icons/getneba-192.png", sizes: "192x192", type: "image/png" }], shortcut: "/icons/getneba-32.png", apple: [{ url: "/icons/getneba-apple-180.png", sizes: "180x180", type: "image/png" }] },
};
export const viewport: Viewport = { themeColor: "#edf8f2", width: "device-width", initialScale: 1, viewportFit: "cover" };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en-NG" data-scroll-behavior="smooth"><body className={geist.variable}><a className="skip-link" href="#main-content">Skip to content</a><Header /><AppShell>{children}</AppShell><PushNotifications /><PwaInstall /></body></html>;
}
