export const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";
const SESSION_MARKER = "getneba_session";
const publicAuthPaths = new Set(["/auth/login/", "/auth/register/", "/auth/token/refresh/", "/auth/password-reset/", "/auth/password-reset/confirm/", "/auth/email/verify/", "/billing/plans/"]);
let accessToken: string | null = null;
let refreshPromise: Promise<string | null> | null = null;

export class ApiError extends Error {
  constructor(message: string, public status: number) { super(message); this.name = "ApiError"; }
}

export function getToken() {
  if (typeof window === "undefined") return null;
  return accessToken || (localStorage.getItem(SESSION_MARKER) === "1" ? "__cookie_session__" : null);
}

export function setToken(token: string) {
  accessToken = token;
  localStorage.setItem(SESSION_MARKER, "1");
  window.dispatchEvent(new Event("nearwork_auth"));
}

async function refreshAccessToken() {
  if (refreshPromise) return refreshPromise;
  refreshPromise = fetch(`${BASE}/auth/token/refresh/`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" } })
    .then(async (response) => {
      if (!response.ok) throw new Error("Refresh session expired.");
      const data = await response.json() as { access: string };
      accessToken = data.access;
      localStorage.setItem(SESSION_MARKER, "1");
      return accessToken;
    })
    .catch(() => {
      accessToken = null;
      localStorage.removeItem(SESSION_MARKER);
      return null;
    })
    .finally(() => { refreshPromise = null; });
  return refreshPromise;
}

export function clearToken() {
  const token = accessToken;
  if (typeof window !== "undefined") {
    if (token) {
      fetch(`${BASE}/notifications/push-subscription/`, { method: "DELETE", credentials: "include", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, keepalive: true }).catch(() => {});
    }
    fetch(`${BASE}/auth/logout/`, { method: "POST", credentials: "include", headers: token ? { Authorization: `Bearer ${token}` } : {} }).catch(() => {});
    accessToken = null;
    localStorage.removeItem(SESSION_MARKER);
    window.dispatchEvent(new Event("nearwork_auth"));
  }
}

async function send<T>(path: string, options: RequestInit, token: string | null): Promise<{ response: Response; data?: T }> {
  const response = await fetch(BASE + path, {
    ...options,
    credentials: "include",
    headers: {
      ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
    cache: "no-store",
  });
  if (response.status === 204) return { response };
  const data = await response.json().catch(() => undefined) as T | undefined;
  return { response, data };
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  let token = publicAuthPaths.has(path) ? null : accessToken || await refreshAccessToken();
  let result = await send<T>(path, options, token);
  if (result.response.status === 401 && !publicAuthPaths.has(path)) {
    token = await refreshAccessToken();
    if (token) result = await send<T>(path, options, token);
  }
  if (!result.response.ok) {
    const data = result.data as Record<string, unknown> | undefined;
    const detail = data?.detail || (data ? Object.values(data).flat().join(" ") : undefined) || "Request failed";
    throw new ApiError(String(detail), result.response.status);
  }
  return result.data as T;
}
