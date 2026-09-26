import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Komunitas",
    short_name: "Komunitas",
    description: "Discover activities. Meet people. Join your community.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#FFF8ED",
    theme_color: "#F97316",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
