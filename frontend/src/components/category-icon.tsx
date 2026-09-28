import { Package, ShoppingBag, PartyPopper, BookOpen, Laptop, HandHeart } from "lucide-react";
import { Category } from "@/lib/types";
const icons = { moving: Package, errands: ShoppingBag, events: PartyPopper, tutoring: BookOpen, tech: Laptop, other: HandHeart };
export function CategoryIcon({ category, size = 22 }: { category: Category; size?: number }) {
  const Icon = icons[category] || HandHeart;
  return <span className={`category-icon category-${category}`}><Icon size={size} strokeWidth={1.7} /></span>;
}
