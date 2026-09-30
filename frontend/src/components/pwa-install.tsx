"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Download, Share, X } from "lucide-react";
import { isPublicPath } from "@/lib/routes";
import { captureInstallPrompt, hasInstallPrompt, installSuggestionHandled, rememberInstallHandled, requestInstall } from "@/lib/pwa";

export function PwaInstall() {
  const path = usePathname();
  const [visible, setVisible] = useState(false);
  const [instructions, setInstructions] = useState(false);
  const [ios, setIos] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const handled = useRef(false);
  const installButton = useRef<HTMLButtonElement>(null);
  const helpPanel = useRef<HTMLDivElement>(null);
  function suppressInstallSuggestion(persist = true) {
    handled.current = true;
    setVisible(false);
    setInstructions(false);
    if (persist) rememberInstallHandled();
  }
  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)");
    const navigatorStandalone = navigator as Navigator & { standalone?: boolean };
    handled.current = installSuggestionHandled();
    const installed = () => standalone.matches || navigatorStandalone.standalone === true;
    if (installed()) suppressInstallSuggestion();
    else setVisible(!handled.current);
    setIos(/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));
    const ready = (event: Event) => { captureInstallPrompt(event); if (!installed() && !handled.current) setVisible(true); };
    const complete = () => suppressInstallSuggestion();
    const handledElsewhere = () => suppressInstallSuggestion(false);
    const displayChanged = () => { if (installed()) suppressInstallSuggestion(); };
    window.addEventListener("beforeinstallprompt", ready);
    window.addEventListener("appinstalled", complete);
    window.addEventListener("neba_install_handled", handledElsewhere);
    standalone.addEventListener("change", displayChanged);
    if ("serviceWorker" in navigator && window.isSecureContext) {
      navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {});
    }
    return () => {
      window.removeEventListener("beforeinstallprompt", ready);
      window.removeEventListener("appinstalled", complete);
      window.removeEventListener("neba_install_handled", handledElsewhere);
      standalone.removeEventListener("change", displayChanged);
    };
  }, []);
  useEffect(() => { if (instructions) helpPanel.current?.focus(); }, [instructions]);
  function closeHelp() { setInstructions(false); installButton.current?.focus(); }
  async function install() {
    if (busy) return;
    setError("");
    if (!hasInstallPrompt()) { setInstructions(!instructions); return; }
    setBusy(true);
    try {
      await requestInstall();
      suppressInstallSuggestion();
    } catch { setError("The install prompt could not open. Try your browser’s install menu."); setInstructions(true); }
    finally { setBusy(false); }
  }
  if (!visible || path === "/install") return null;
  return <aside className={`pwa-install ${isPublicPath(path) ? "pwa-public" : "pwa-app"}`} aria-label="Install GetNeba">
    {instructions && <div className="pwa-install-help" id="neba-install-help" role="region" aria-label="Installation instructions" tabIndex={-1} ref={helpPanel} onKeyDown={(event) => { if (event.key === "Escape") closeHelp(); }}><div className="pwa-help-heading"><strong>Keep GetNeba close by</strong><button type="button" aria-label="Close installation instructions" onClick={closeHelp}><X size={17} /></button></div>{ios ? <p>Open GetNeba in Safari, tap <Share size={15} aria-hidden="true" /> <strong>Share</strong>, then choose <strong>Add to Home Screen</strong> and tap <strong>Add</strong>.</p> : <p>Open your browser’s menu and look for <strong>Install GetNeba</strong>, <strong>Install app</strong> or <strong>Add to Home Screen</strong>. If you’re using an in-app browser, open GetNeba in Chrome, Edge or Safari first.</p>}<small>Once installed, GetNeba opens from your home screen. An internet connection is needed for tasks and messages.</small>{error && <p role="alert">{error}</p>}</div>}
    <div className="pwa-install-pill"><button type="button" className="pwa-install-button" ref={installButton} onClick={install} disabled={busy} aria-expanded={instructions} aria-controls={instructions ? "neba-install-help" : undefined}><Download size={18} /><span>{busy ? "Opening installer…" : "Install GetNeba"}</span></button><button type="button" className="pwa-dismiss" aria-label="Dismiss install suggestion" onClick={() => suppressInstallSuggestion()}><X size={15} /></button></div>
  </aside>;
}
