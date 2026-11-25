import AppShell from "@/components/app-shell";

export default function BookingsLayout({ children }: { children: React.ReactNode }) {
  return <AppShell active="bookings">{children}</AppShell>;
}
