import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Neba",
    short_name: "Neba",
    description: "Intelligence for education: connected tools for schools, educators, and learners.",
    start_url: "/workspace",
    scope: "/",
    display: "standalone",
    background_color: "#edf8f2",
    theme_color: "#edf8f2",
    icons: [
      { src: "/icons/getneba-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/getneba-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/getneba-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
