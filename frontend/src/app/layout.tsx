import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { Header } from "@/components/header";
import { AppShell } from "@/components/app-shell";
import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });
export const metadata: Metadata = {
  title: "Neba — good help, close by",
  description: "Find local help and paid tasks in your city.",
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" data-scroll-behavior="smooth"><body className={geist.variable}><a className="skip-link" href="#main-content">Skip to content</a><Header /><AppShell>{children}</AppShell></body></html>;
}
