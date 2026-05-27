import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Finosuke — Personal Finance",
    short_name: "Finosuke",
    description:
      "A modern, intelligent personal finance app built with precision and clarity.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#0f0f11",
    theme_color: "#0f0f11",
    orientation: "portrait",
    scope: "/",
    categories: ["finance", "productivity"],
    icons: [
      {
        src: "/api/pwa-icon?size=192",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/api/pwa-icon?size=512",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/api/pwa-icon?size=512",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "Dashboard",
        short_name: "Dashboard",
        url: "/dashboard",
        description: "View your financial overview",
      },
      {
        name: "Expenses",
        short_name: "Expenses",
        url: "/expenses",
        description: "Track your expenses",
      },
    ],
  };
}
