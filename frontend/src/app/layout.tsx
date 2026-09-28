import type { Metadata } from "next";
import { Header } from "@/components/header";
import "./globals.css";

export const metadata: Metadata = {
  title: "Nearwork  good help is closer than you think",
  description: "Find local help and paid tasks in your city.",
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><Header />{children}<footer className="site-footer"><div className="container footer-inner"><span>nearwork<span className="brand-dot">.</span></span><p>Local help, wherever you are.</p><small> {new Date().getFullYear()} Nearwork</small></div></footer></body></html>;
}

