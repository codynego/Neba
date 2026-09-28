"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Download, Share, X } from "lucide-react";
import { isPublicPath } from "@/lib/routes";

type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function PwaInstall() {
  const path = usePathname();
  const [visible, setVisible] = useState(false);
  const [instructions, setInstructions] = useState(false);
  const [ios, setIos] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const prompt = useRef<InstallEvent | null>(null);
  const dismissed = useRef(false);
  const installButton = useRef<HTMLButtonElement>(null);
  const helpPanel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)");
    const navigatorStandalone = navigator as Navigator & { standalone?: boolean };
    try { dismissed.current = sessionStorage.getItem("neba_install_dismissed") === "1"; } catch {}
    const installed = () => standalone.matches || navigatorStandalone.standalone === true;
    setVisible(!installed() && !dismissed.current);
    setIos(/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));
    const ready = (event: Event) => { event.preventDefault(); prompt.current = event as InstallEvent; if (!installed() && !dismissed.current) setVisible(true); };
    const complete = () => { prompt.current = null; setVisible(false); setInstructions(false); };
    const displayChanged = () => { if (installed()) complete(); };
    window.addEventListener("beforeinstallprompt", ready);
    window.addEventListener("appinstalled", complete);
    standalone.addEventListener("change", displayChanged);
    if ("serviceWorker" in navigator && window.isSecureContext) {
      navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {});
    }
    return () => {
      window.removeEventListener("beforeinstallprompt", ready);
      window.removeEventListener("appinstalled", complete);
      standalone.removeEventListener("change", displayChanged);
    };
  }, []);
  useEffect(() => { if (instructions) helpPanel.current?.focus(); }, [instructions]);
  function closeHelp() { setInstructions(false); installButton.current?.focus(); }
  async function install() {
    if (busy) return;
    setError("");
    if (!prompt.current) { setInstructions(!instructions); return; }
    const event = prompt.current;
    prompt.current = null;
    setBusy(true);
    try {
      await event.prompt();
      const result = await event.userChoice;
      if (result.outcome === "accepted") { setVisible(false); setInstructions(false); }
    } catch { setError("The install prompt could not open. Try your browser’s install menu."); setInstructions(true); }
    finally { setBusy(false); }
  }
  if (!visible) return null;
  return <aside className={`pwa-install ${isPublicPath(path) ? "pwa-public" : "pwa-app"}`} aria-label="Install GetNeba">
    {instructions && <div className="pwa-install-help" id="neba-install-help" role="region" aria-label="Installation instructions" tabIndex={-1} ref={helpPanel} onKeyDown={(event) => { if (event.key === "Escape") closeHelp(); }}><div className="pwa-help-heading"><strong>Keep GetNeba close by</strong><button type="button" aria-label="Close installation instructions" onClick={closeHelp}><X size={17} /></button></div>{ios ? <p>Open GetNeba in Safari, tap <Share size={15} aria-hidden="true" /> <strong>Share</strong>, then choose <strong>Add to Home Screen</strong> and tap <strong>Add</strong>.</p> : <p>Open your browser’s menu and look for <strong>Install GetNeba</strong>, <strong>Install app</strong> or <strong>Add to Home Screen</strong>. If you’re using an in-app browser, open GetNeba in Chrome, Edge or Safari first.</p>}<small>Once installed, GetNeba opens from your home screen. An internet connection is needed for tasks and messages.</small>{error && <p role="alert">{error}</p>}</div>}
    <div className="pwa-install-pill"><button type="button" className="pwa-install-button" ref={installButton} onClick={install} disabled={busy} aria-expanded={instructions} aria-controls={instructions ? "neba-install-help" : undefined}><Download size={18} /><span>{busy ? "Opening installer…" : "Install GetNeba"}</span></button><button type="button" className="pwa-dismiss" aria-label="Dismiss install suggestion" onClick={() => { dismissed.current = true; setVisible(false); setInstructions(false); try { sessionStorage.setItem("neba_install_dismissed", "1"); } catch {} }}><X size={15} /></button></div>
  </aside>;
}
