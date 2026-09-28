import Link from "next/link";
import Image from "next/image";

export function Brand() {
  return <Link href="/" className="brand" aria-label="GetNeba home"><Image className="brand-logo" src="/brand/getneba-wordmark.svg" alt="" width={190} height={44} priority unoptimized /></Link>;
}
