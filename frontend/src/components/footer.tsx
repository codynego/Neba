import Link from "next/link";
import { Brand } from "./brand";
const groups = [
  { title: "Discover", links: [["/register", "Build my radar"], ["/#opportunities", "Explore categories"], ["/#how-it-works", "How it works"], ["/register", "Create an account"]] },
  { title: "GetNeba", links: [["/about", "Why GetNeba"], ["/pricing", "Pricing"], ["/help", "Opportunity guide"], ["/stories", "Stories"], ["/install", "Install the app"], ["/register", "Get started free"]] },
  { title: "Trust & clarity", links: [["/community-guidelines", "Community guidelines"], ["/privacy", "Privacy notice"], ["/terms", "Terms of service"], ["/safety", "Safety center"]] },
];
export function Footer() {
  return <footer className="landing-footer"><div className="landing-container footer-grid"><div className="footer-brand"><Brand /><p>Your personal opportunity radar.</p><small>Discover less. Qualify faster. Apply smarter.</small></div>{groups.map((group) => <nav key={group.title} aria-label={`${group.title} footer links`}><h2>{group.title}</h2>{group.links.map(([href, label]) => <Link key={`${href}-${label}`} href={href}>{label}</Link>)}</nav>)}</div><div className="landing-container footer-bottom"><small>© {new Date().getFullYear()} GetNeba</small><span>More doors. Better direction.</span></div></footer>;
}
