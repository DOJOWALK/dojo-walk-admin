import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dojo Walk Walker",
  description: "Dojo Walk walker application",
  applicationName: "Dojo Walk Walker",
  manifest: "/walker/manifest.webmanifest",
  icons: { icon: "/walker-icon.svg", apple: "/walker-icon.svg" }
};

export default function WalkerLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
