import { redirect } from "next/navigation";

// Compatibility redirect for bookmarks and old campaign links. This is not an active product route.
export default function LocalHelpPage() {
  redirect("/opportunities");
}
