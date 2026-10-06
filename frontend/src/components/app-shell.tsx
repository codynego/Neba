"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Footer } from "./footer";
import { RequireAuth } from "./require-auth";
import { isPublicPath } from "@/lib/routes";
import { getToken } from "@/lib/api";
export function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    const sync = () => setSignedIn(Boolean(getToken()));
    sync();
    window.addEventListener("nearwork_auth", sync);
    return () => window.removeEventListener("nearwork_auth", sync);
  }, []);
  const publicRoute = isPublicPath(path);
  const authenticatedOpportunity = signedIn && (path === "/opportunities" || path.startsWith("/opportunities/"));
  const authRoute = path === "/login" || path === "/register" || path === "/forgot-password" || path === "/reset-password" || path === "/verify-email";
  const appRoute = !publicRoute || authenticatedOpportunity;
  return <div className={appRoute ? "app-content" : "public-content"} id="main-content">{publicRoute ? children : <RequireAuth key={path}>{children}</RequireAuth>}{!appRoute && !authRoute && <Footer />}</div>;
}
