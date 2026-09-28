import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "GetNeba — good help, close by",
    short_name: "GetNeba",
    description: "Find local help, offer your skills, and coordinate neighborhood tasks.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    background_color: "#f8faf8",
    theme_color: "#087f5b",
    icons: [
      { src: "/icons/getneba-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/getneba-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/getneba-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
