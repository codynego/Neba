# Neba installation

An Install Neba pill appears near the bottom-right of the website and above the mobile app navigation. It is dismissible for the browser session, hides in standalone mode or after installation, and hides while mobile text inputs are focused.

The button retains the browser's `beforeinstallprompt` event and opens its native prompt on user interaction. If that event is unavailable, it shows browser-menu instructions. iPhone/iPad instructions explain Safari's Share > Add to Home Screen flow. Native prompt support and eligibility depend on the browser. The Codex in-app browser verified the instructions path; installation on actual Chrome/Edge and Safari devices still needs testing. Production hosting needs HTTPS.

The manifest defines standalone display, dashboard start URL, Neba colors, PNG icons and a maskable icon. Apple home-screen metadata and a 180px icon are included. The service worker caches only a public offline explanation. Authenticated pages, identity data, conversations and API responses are not cached. Tasks and messages need a connection; this does not provide full offline app functionality. Worker updates use uncached requests.

Verification: frontend type checking and production build passed; HTTP checks verified manifest metadata, all manifest icons, service-worker headers and offline page. Worker simulation checked network-only private navigation, untouched API traffic and offline fallback. Browser checks verified opening/closing instructions, dismissal persistence, and a 23px gap above navigation at 390x844. The synthetic review account was removed. No native app installation was performed.

References: [Next.js PWA guide](https://nextjs.org/docs/app/guides/progressive-web-apps), [MDN installation prompts](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/How_to/Trigger_install_prompt).
