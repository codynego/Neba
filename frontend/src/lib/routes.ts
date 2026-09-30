export const publicRoutes = ["/", "/local-help", "/login", "/register", "/about", "/stories", "/help", "/community-guidelines", "/privacy", "/terms"];
export const isPublicPath = (path: string) => publicRoutes.includes(path) || path.startsWith("/u/");
