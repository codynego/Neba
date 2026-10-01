export const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";
export class ApiError extends Error {
  constructor(message: string, public status: number) { super(message); this.name = "ApiError"; }
}
const publicAuthPaths = new Set(["/auth/login/", "/auth/register/", "/auth/password-reset/", "/auth/password-reset/confirm/", "/auth/email/verify/"]);
export function getToken() {
  return typeof window === "undefined" ? null : localStorage.getItem("nearwork_token");
}
export function setToken(token: string) {
  localStorage.setItem("nearwork_token", token);
  window.dispatchEvent(new Event("nearwork_auth"));
}
export function clearToken() {
  const token = localStorage.getItem("nearwork_token");
  if (token && typeof navigator !== "undefined" && "serviceWorker" in navigator) {
    navigator.serviceWorker.ready.then((registration) => registration.pushManager.getSubscription()).then((subscription) => {
      if (!subscription) return;
      fetch(`${BASE}/notifications/push-subscription/`, { method: "DELETE", headers: { "Content-Type": "application/json", Authorization: `Token ${token}` }, body: JSON.stringify({ endpoint: subscription.endpoint }), keepalive: true }).catch(() => {});
      subscription.unsubscribe().catch(() => {});
    }).catch(() => {});
  }
  localStorage.removeItem("nearwork_token");
  window.dispatchEvent(new Event("nearwork_auth"));
}
export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = publicAuthPaths.has(path) ? null : getToken();
  const response = await fetch(BASE + path, {
    ...options,
    headers: {
      ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Token ${token}` } : {}),
      ...options.headers,
    },
    cache: "no-store",
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    const detail = data.detail || Object.values(data).flat().join(" ") || "Request failed";
    throw new ApiError(String(detail), response.status);
  }
  if (response.status === 204) return undefined as T;
  return response.json();
}
