import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Trading Card Studio",
    short_name: "CardStudio",
    description:
      "Private, local-first trading cards from your images, GIFs, and video frames.",
    start_url: "/",
    display: "standalone",
    background_color: "#0c0a09",
    theme_color: "#0c0a09",
    orientation: "portrait-primary",
    icons: [
      {
        src: "/favicon.ico",
        sizes: "any",
        type: "image/x-icon",
      },
    ],
  };
}
