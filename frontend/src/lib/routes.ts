export const publicRoutes = ["/", "/local-help", "/install", "/login", "/register", "/forgot-password", "/reset-password", "/verify-email", "/about", "/stories", "/help", "/community-guidelines", "/privacy", "/terms"];
export const isPublicPath = (path: string) => publicRoutes.includes(path) || path === "/opportunities" || path.startsWith("/opportunities/") || path.startsWith("/u/");
export const isOpportunityPath = (path: string) => path === "/opportunities" || path.startsWith("/opportunities/");
export function opportunitySlug(title: string) {
  return title.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 90) || "opportunity";
}
export function opportunityPath(title: string, publicId: string) { return `/opportunities/${opportunitySlug(title)}-${publicId}`; }
export function opportunityIdFromRoute(routeId: string) { return routeId.match(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)?.[0] || routeId; }
