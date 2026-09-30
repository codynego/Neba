"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Download, Share } from "lucide-react";
import { hasInstallPrompt, rememberInstallHandled, requestInstall, subscribeToInstallPrompt } from "@/lib/pwa";

export function InstallAppControl() {
  const [available, setAvailable] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [ios, setIos] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)");
    const navigatorStandalone = navigator as Navigator & { standalone?: boolean };
    const syncInstalled = () => setInstalled(standalone.matches || navigatorStandalone.standalone === true);
    const syncAvailable = () => setAvailable(hasInstallPrompt());
    const complete = () => { setInstalled(true); setFeedback("GetNeba is installed and ready from your home screen."); };
    syncInstalled();
    syncAvailable();
    setIos(/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));
    const unsubscribe = subscribeToInstallPrompt(syncAvailable);
    window.addEventListener("appinstalled", complete);
    standalone.addEventListener("change", syncInstalled);
    return () => {
      unsubscribe();
      window.removeEventListener("appinstalled", complete);
      standalone.removeEventListener("change", syncInstalled);
    };
  }, []);

  async function install() {
    if (busy || installed) return;
    setFeedback("");
    if (!available) {
      setShowHelp(true);
      return;
    }
    setBusy(true);
    try {
      const outcome = await requestInstall();
      setAvailable(hasInstallPrompt());
      if (outcome === "accepted") { rememberInstallHandled(); setFeedback("Installation started. GetNeba will be available from your home screen."); }
      else if (outcome === "dismissed") { rememberInstallHandled(); setFeedback("Installation was cancelled. You can still install from your browser menu whenever you’re ready."); setShowHelp(true); }
      else setShowHelp(true);
    } catch {
      setFeedback("The browser installer could not open. Use the steps below instead.");
      setShowHelp(true);
    } finally {
      setBusy(false);
    }
  }

  if (installed) return <div className="install-status" role="status"><CheckCircle2 size={22} /><div><strong>GetNeba is installed</strong><span>Open it from your home screen or apps list.</span></div></div>;

  return <div className="install-control">
    <button className="button button-dark install-page-button" type="button" onClick={install} disabled={busy}><Download size={19} />{busy ? "Opening installer…" : "Install GetNeba"}</button>
    {!available && <span className="install-control-note">Your browser may use its menu instead of an automatic installer.</span>}
    {feedback && <p className="install-feedback" role="status">{feedback}</p>}
    {showHelp && <div className="install-inline-help"><strong>{ios ? "Install with Safari" : "Install from your browser"}</strong>{ios ? <p>Tap <Share size={15} aria-hidden="true" /> <b>Share</b>, choose <b>Add to Home Screen</b>, then tap <b>Add</b>.</p> : <p>Open the browser menu and choose <b>Install GetNeba</b>, <b>Install app</b>, or <b>Add to Home Screen</b>.</p>}</div>}
  </div>;
}
