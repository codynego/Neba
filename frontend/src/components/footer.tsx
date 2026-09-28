import Link from "next/link";
const groups = [
  { title: "Explore", links: [["/tasks", "Find tasks"], ["/offers", "Find people"], ["/tasks/new", "Post a task"], ["/offers/new", "Offer your skills"]] },
  { title: "Neba", links: [["/about", "About Neba"], ["/local-help", "Local help in Nigeria"], ["/#how-it-works", "How it works"], ["/help", "Help center"], ["/register", "Join the neighborhood"]] },
  { title: "Trust & safety", links: [["/community-guidelines", "Community guidelines"], ["/verify", "Manage verification"], ["/safety", "Report & block"], ["/privacy", "Privacy"], ["/terms", "Pilot terms"]] },
];
export function Footer() {
  return <footer className="landing-footer"><div className="landing-container footer-grid"><div className="footer-brand"><Link href="/" aria-label="Neba home"><strong>neba<span className="brand-dot">.</span></strong></Link><p>Good help. Close by.</p></div>{groups.map((group) => <nav key={group.title} aria-label={`${group.title} footer links`}><h2>{group.title}</h2>{group.links.map(([href, label]) => <Link key={href} href={href}>{label}</Link>)}</nav>)}</div><div className="landing-container footer-bottom"><small>© {new Date().getFullYear()} Neba</small><span>A little help. A better neighborhood.</span></div></footer>;
}
