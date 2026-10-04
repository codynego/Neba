"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { api, getToken } from "@/lib/api";
export function NotificationBell() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    const refresh = () => { if (!getToken()) { setCount(0); return; } if (!document.hidden) api<{ count: number }>("/notifications/unread/", { signal: controller.signal }).then((result) => setCount(result.count)).catch(() => {}); };
    refresh(); const timer = setInterval(refresh, 20000);
    window.addEventListener("neba_notifications", refresh); document.addEventListener("visibilitychange", refresh);
    return () => { controller.abort(); clearInterval(timer); window.removeEventListener("neba_notifications", refresh); document.removeEventListener("visibilitychange", refresh); };
  }, []);
  return <Link className="notification-bell" href="/alerts" aria-label={`Notifications${count ? `, ${count} unread` : ""}`}><Bell size={21} />{count > 0 && <span>{count > 99 ? "99+" : count}</span>}</Link>;
}
