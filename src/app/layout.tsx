import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Dojo Walk Admin",
  description: "Private operations dashboard for Dojo Walk"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}