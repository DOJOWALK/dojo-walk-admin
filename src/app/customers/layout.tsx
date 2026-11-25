import AppShell from "@/components/app-shell";

export default function CustomersLayout({ children }: { children: React.ReactNode }) {
  return <AppShell active="customers">{children}</AppShell>;
}
