import type { Metadata, Viewport } from "next";
import { Geist, Manrope } from "next/font/google";
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
import "./homepage-network.css";
import "./homepage-schools.css";
import "./schools.css";
import "./schools-dashboard.css";
import "./schools-dashboard-empty.css";
import "./schools-attendance.css";
import "./schools-intelligence.css";
import "./schools-question-evidence.css";
import "./schools-setup.css";
import "./schools-pricing.css";
import "./post-opportunity.css";
import "./post-opportunity-enhancements.css";
import "./dashboard-command.css";
import "./credits-page.css";
import "./credits-topup.css";
import "./auth-focus.css";
import "./opportunity-apply.css";
import "./opportunity-messages.css";
import "./application-updates.css";
import "./operations/operations.css";
import "./verification-badges.css";
import "./opportunity-check.css";
import "./pricing-billing.css";
import "./neba-design.css";
import "./neba-corporate.css";
import "./learn.css";
import "./learn-dashboard.css";
import "./learn-extra.css";
import "./learn-sidebar.css";
import "./exam-buddy.css";
import "./workspace.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });
const manrope = Manrope({ subsets: ["latin"], variable: "--font-manrope", display: "swap" });
export const metadata: Metadata = {
  metadataBase: siteUrl,
  applicationName: "Neba",
  title: { default: "Neba — Intelligence for education", template: "%s | Neba" },
  description: siteDescription,
  robots: { index: false, follow: false },
  verification: { google: process.env.GOOGLE_SITE_VERIFICATION },
  openGraph: { title: "Neba — Intelligence for education", description: siteDescription, url: siteUrl, siteName: "Neba", locale: "en_NG", type: "website", images: [{ url: "/brand/getneba-social-preview-1200x630.png", width: 1200, height: 630, alt: "Neba — Intelligence for education" }] },
  twitter: { card: "summary_large_image", title: "Neba — Intelligence for education", description: siteDescription, images: ["/brand/getneba-social-preview-1200x630.png"] },
  appleWebApp: { capable: true, title: "Neba", statusBarStyle: "default" },
  icons: { icon: [{ url: "/icons/getneba-32.png", sizes: "32x32", type: "image/png" }, { url: "/icons/getneba-192.png", sizes: "192x192", type: "image/png" }], shortcut: "/icons/getneba-32.png", apple: [{ url: "/icons/getneba-apple-180.png", sizes: "180x180", type: "image/png" }] },
};
export const viewport: Viewport = { themeColor: "#edf8f2", width: "device-width", initialScale: 1, viewportFit: "cover" };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en-NG" data-scroll-behavior="smooth"><body className={`${geist.variable} ${manrope.variable}`}><a className="skip-link" href="#main-content">Skip to content</a><Header /><AppShell>{children}</AppShell><PushNotifications /><PwaInstall /></body></html>;
}
