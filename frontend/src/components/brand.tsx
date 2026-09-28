import Link from "next/link";
import { MapPin } from "lucide-react";
export function Brand() {
  return <Link href="/" className="brand" aria-label="Neba home"><span className="brand-mark"><MapPin size={23} strokeWidth={2.5} /></span><span>neba<span className="brand-dot">.</span></span></Link>;
}
