import { ImageResponse } from "next/og";

export const alt = "Neba — local help and paid tasks in Nigeria";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(<div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", background: "#f8faf8", color: "#111714", padding: "68px 80px", borderBottom: "18px solid #087f5b" }}><div style={{ display: "flex", alignItems: "center", gap: 18, fontSize: 46, fontWeight: 700 }}><div style={{ display: "flex", background: "#087f5b", borderRadius: 18, padding: 12 }}><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="3" /></svg></div><span>neba.</span></div><div style={{ display: "flex", fontSize: 76, fontWeight: 700, letterSpacing: -3, marginTop: 55 }}>Good help. Close by.</div><div style={{ display: "flex", fontSize: 32, color: "#68736e", maxWidth: 880, marginTop: 24 }}>Find local help and paid tasks in Nigeria.</div><div style={{ display: "flex", fontSize: 23, color: "#087f5b", marginTop: 46 }}>Errands · Moving · Tutoring · Tech · Events</div></div>, size);
}
