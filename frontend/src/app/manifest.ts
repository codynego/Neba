import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Neba — good help, close by",
    short_name: "Neba",
    description: "Find local help, offer your skills, and coordinate neighborhood tasks.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    background_color: "#f8faf8",
    theme_color: "#087f5b",
    icons: [
      { src: "/icons/neba-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/neba-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/neba-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
