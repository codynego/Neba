export const publicRoutes = ["/", "/local-help", "/login", "/register", "/about", "/help", "/community-guidelines", "/privacy", "/terms"];
export const isPublicPath = (path: string) => publicRoutes.includes(path);
