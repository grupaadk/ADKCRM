import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ADK Ekipy Montażowe",
    short_name: "ADK Ekipy",
    description: "Kalendarz i harmonogram dla ekip montażowych ADK Okna",
    start_url: "/ekipa",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f8fafc",
    theme_color: "#0f172a",
    icons: [
      {
        src: "/convex.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
  };
}
