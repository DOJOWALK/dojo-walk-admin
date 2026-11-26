import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Dojo Walk Admin",
    short_name: "DW Admin",
    description: "Dojo Walk management application",
    start_url: "/login",
    scope: "/",
    display: "standalone",
    background_color: "#fff7ed",
    theme_color: "#f97316",
    icons: [{ src: "/admin-icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }]
  };
}
