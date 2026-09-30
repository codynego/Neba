import { Download, Laptop, RefreshCw, Share, Smartphone, Wifi } from "lucide-react";
import { InstallAppControl } from "@/components/install-app-control";
import { publicPageMetadata } from "@/lib/seo";

export const metadata = publicPageMetadata(
  "Install the GetNeba app",
  "Install GetNeba on your phone or computer for quick access to local tasks, helpers, activity and messages.",
  "/install",
);

export default function InstallPage() {
  return <main className="install-page">
    <section className="install-hero landing-container">
      <div className="install-hero-copy"><span className="landing-eyebrow"><Download size={15} /> GETNEBA, ONE TAP AWAY</span><h1>Install the app.<br /><em>Keep help close.</em></h1><p>Add GetNeba to your home screen or computer. It opens in its own window, stays easy to find, and updates automatically—no app store needed.</p><InstallAppControl /><small><Wifi size={14} /> An internet connection is still needed for live tasks, activity and messages.</small></div>
      <div className="install-device" aria-hidden="true"><div className="install-device-screen"><span className="install-app-mark">N</span><strong>GetNeba</strong><p>Good help.<br />Close by.</p><span className="install-device-action"><Download size={16} /> Installed</span></div></div>
    </section>

    <section className="install-benefits landing-container" aria-labelledby="install-benefits-title"><div className="install-section-heading"><span className="landing-eyebrow">WHY INSTALL IT?</span><h2 id="install-benefits-title">The website, with a shortcut home.</h2></div><div className="install-benefit-grid"><article><Smartphone size={24} /><h3>One-tap access</h3><p>Open GetNeba directly from your home screen instead of finding the website again.</p></article><article><Laptop size={24} /><h3>App-like window</h3><p>On supported devices, GetNeba opens cleanly in its own window.</p></article><article><RefreshCw size={24} /><h3>Always current</h3><p>The installed app uses the latest GetNeba experience without app-store updates.</p></article></div></section>

    <section className="install-steps"><div className="landing-container"><div className="install-section-heading"><span className="landing-eyebrow">MANUAL INSTALL</span><h2>Choose your device.</h2><p>If the install button does not open a prompt, follow the matching browser steps.</p></div><div className="install-step-grid"><article><span><Smartphone size={21} /> Android</span><ol><li>Open GetNeba in Chrome.</li><li>Tap the three-dot browser menu.</li><li>Choose <b>Install app</b> or <b>Add to Home screen</b>.</li></ol></article><article><span><Share size={21} /> iPhone or iPad</span><ol><li>Open GetNeba in Safari.</li><li>Tap the <b>Share</b> button.</li><li>Choose <b>Add to Home Screen</b>, then tap <b>Add</b>.</li></ol></article><article><span><Laptop size={21} /> Computer</span><ol><li>Open GetNeba in Chrome or Edge.</li><li>Use the install icon in the address bar or open the browser menu.</li><li>Choose <b>Install GetNeba</b> or <b>Install app</b>.</li></ol></article></div></div></section>
  </main>;
}
