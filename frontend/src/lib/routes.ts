export const publicRoutes = ["/", "/local-help", "/install", "/login", "/register", "/forgot-password", "/reset-password", "/verify-email", "/about", "/stories", "/help", "/community-guidelines", "/privacy", "/terms"];
export const isPublicPath = (path: string) => publicRoutes.includes(path) || path.startsWith("/u/");
