export const publicRoutes = ["/", "/login", "/register", "/about", "/help", "/community-guidelines", "/privacy", "/terms"];
export const isPublicPath = (path: string) => publicRoutes.includes(path);
