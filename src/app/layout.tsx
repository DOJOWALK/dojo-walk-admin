import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./login/login.css";

export const metadata: Metadata = {
  title: "Dojo Walk Admin",
  description: "Private operations dashboard for Dojo Walk"
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en-IN"><body>{children}</body></html>;
}
