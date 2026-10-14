import Link from "next/link";
import { Brand } from "./brand";
const groups = [
  { title: "Products", links: [["/schools", "Neba for Schools"], ["/learn", "Neba Learn — coming soon"], ["/opportunities", "Neba Opportunities"]] },
  { title: "Company", links: [["/about", "About Neba"], ["/help", "Contact"], ["/privacy", "Privacy policy"], ["/terms", "Terms of service"]] },
];
export function Footer() {
  return <footer className="landing-footer"><div className="landing-container footer-grid"><div className="footer-brand"><Brand /><p>Intelligence for education.</p><small>Connected tools that help schools, educators, and learners move forward.</small></div>{groups.map((group) => <nav key={group.title} aria-label={`${group.title} footer links`}><h2>{group.title}</h2>{group.links.map(([href, label]) => <Link key={`${href}-${label}`} href={href}>{label}</Link>)}</nav>)}</div><div className="landing-container footer-bottom"><small>© {new Date().getFullYear()} Neba. All rights reserved.</small><span>Education works better together.</span></div></footer>;
}
