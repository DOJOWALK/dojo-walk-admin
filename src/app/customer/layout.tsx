import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dojo Walk Customer",
  description: "Dojo Walk customer application",
  applicationName: "Dojo Walk Customer",
  manifest: "/customer/manifest.webmanifest",
  icons: { icon: "/customer-icon.svg", apple: "/customer-icon.svg" }
};

export default function CustomerLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
