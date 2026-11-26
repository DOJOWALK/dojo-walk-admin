const APP_PATH = "/customer";
const ALLOWED_API = [
  "/api/portal-auth/request-otp",
  "/api/portal-auth/verify-otp",
  "/api/portal-auth/me",
  "/api/portal-auth/logout",
  "/api/portal-auth/change-password",
  "/api/portal-dashboard",
  "/api/customer/booking-requests",
  "/api/customer/saved-addresses",
];
function allowedApi(path) {
  return ALLOWED_API.includes(path) || path.startsWith("/api/portal-chat/conversations");
}
function allowedPage(path) {
  return path === APP_PATH || path.startsWith(APP_PATH + "/");
}
export default {
  async fetch(request, env) {
    const incoming = new URL(request.url);
    const path = incoming.pathname;
    if (path === "/" || path === "/login") {
      return Response.redirect(new URL(APP_PATH + "/login", request.url), 302);
    }
    if (path === "/customer/manifest.webmanifest") {
      return new Response(JSON.stringify({
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
      }), { headers: { "content-type": "application/manifest+json; charset=utf-8", "cache-control": "public, max-age=3600" } });
    }
    if (path === "/customer-icon.svg" || path === "/favicon.ico" || path.startsWith("/_next/")) {
      return env.BACKEND.fetch(request);
    }
    if (path.startsWith("/api/")) {
      if (!allowedApi(path)) return new Response("Not found", { status: 404 });
      if (request.method === "POST" &&
          (path === "/api/portal-auth/request-otp" || path === "/api/portal-auth/verify-otp")) {
        try {
          const body = await request.clone().json();
          const headers = new Headers(request.headers);
          headers.delete("content-length");
          const forwarded = new Request(request.url, {
            method: request.method,
            headers,
            body: JSON.stringify({ ...body, role: "customer" }),
          });
          return env.BACKEND.fetch(forwarded);
        } catch {
          return env.BACKEND.fetch(request);
        }
      }
      return env.BACKEND.fetch(request);
    }
    if (!allowedPage(path)) return new Response("Not found", { status: 404 });
    return env.BACKEND.fetch(request);
  },
};
