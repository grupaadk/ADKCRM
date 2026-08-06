import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ADK Ekipy Montażowe",
    short_name: "ADK Ekipy",
    description: "Mobilna aplikacja i harmonogram dla ekip montażowych ADK Okna",
    start_url: "/ekipa",
    scope: "/ekipa",
    display: "fullscreen",
    display_override: ["fullscreen", "standalone"],
    orientation: "portrait",
    background_color: "#f6f7f9",
    theme_color: "#f6f7f9",
    icons: [
      {
        src: "/convex.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any maskable",
      },
    ],
  };
}
