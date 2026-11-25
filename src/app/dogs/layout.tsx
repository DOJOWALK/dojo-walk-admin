import AppShell from "@/components/app-shell";

export default function DogsLayout({ children }: { children: React.ReactNode }) {
  return <AppShell active="dogs">{children}</AppShell>;
}
