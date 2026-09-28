import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
export function Brand() {
  return <Link href="/" className="brand" aria-label="Nearwork home"><span className="brand-mark"><ArrowUpRight size={20} strokeWidth={3} /></span><span>nearwork<span className="brand-dot">.</span></span></Link>;
}
