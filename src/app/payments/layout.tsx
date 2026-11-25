import AppShell from "@/components/app-shell";

export default function PaymentsLayout({ children }: { children: React.ReactNode }) {
  return <AppShell active="payments">{children}</AppShell>;
}
