"use client";
import { usePathname } from "next/navigation";
import { Footer } from "./footer";
import { RequireAuth } from "./require-auth";
import { isPublicPath } from "@/lib/routes";
export function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const publicRoute = isPublicPath(path);
  const authRoute = path === "/login" || path === "/register" || path === "/forgot-password" || path === "/reset-password" || path === "/verify-email";
  return <div className={publicRoute ? "public-content" : "app-content"} id="main-content">{publicRoute ? children : <RequireAuth key={path}>{children}</RequireAuth>}{publicRoute && !authRoute && <Footer />}</div>;
}
