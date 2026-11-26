import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/customer/",
    name: "Dojo Walk Customer",
    short_name: "DW Customer",
    description: "Manage your dogs, bookings and walks",
    start_url: "/customer/dashboard",
    scope: "/customer/",
    display: "standalone",
    background_color: "#fff7ed",
    theme_color: "#f97316",
    icons: [{ src: "/customer-icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }]
  };
}
