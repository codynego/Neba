const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";
export function getToken() {
  return typeof window === "undefined" ? null : localStorage.getItem("nearwork_token");
}
export function setToken(token: string) {
  localStorage.setItem("nearwork_token", token);
  window.dispatchEvent(new Event("nearwork_auth"));
}
export function clearToken() {
  localStorage.removeItem("nearwork_token");
  window.dispatchEvent(new Event("nearwork_auth"));
}
export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const response = await fetch(BASE + path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Token ${token}` } : {}),
      ...options.headers,
    },
    cache: "no-store",
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    const detail = data.detail || Object.values(data).flat().join(" ") || "Request failed";
    throw new Error(String(detail));
  }
  if (response.status === 204) return undefined as T;
  return response.json();
}
