export type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export type InstallOutcome = "accepted" | "dismissed" | "unavailable";

const INSTALL_HANDLED_KEY = "neba_install_handled";
const listeners = new Set<() => void>();
let deferredPrompt: InstallPromptEvent | null = null;

function notify() {
  listeners.forEach((listener) => listener());
}

export function captureInstallPrompt(event: Event) {
  event.preventDefault();
  deferredPrompt = event as InstallPromptEvent;
  notify();
}

export function hasInstallPrompt() {
  return deferredPrompt !== null;
}

export function subscribeToInstallPrompt(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function installSuggestionHandled() {
  if (typeof window === "undefined") return false;
  try { return localStorage.getItem(INSTALL_HANDLED_KEY) === "1" || sessionStorage.getItem("neba_install_dismissed") === "1"; }
  catch { return false; }
}

export function rememberInstallHandled() {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(INSTALL_HANDLED_KEY, "1"); } catch {}
  window.dispatchEvent(new Event("neba_install_handled"));
}

export async function requestInstall(): Promise<InstallOutcome> {
  if (!deferredPrompt) return "unavailable";
  const event = deferredPrompt;
  deferredPrompt = null;
  notify();
  await event.prompt();
  return (await event.userChoice).outcome;
}
