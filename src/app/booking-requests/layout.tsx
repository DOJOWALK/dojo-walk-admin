import AppShell from "@/components/app-shell";

export default function BookingRequestsLayout({ children }: { children: React.ReactNode }) {
  return <AppShell active="booking-requests">{children}</AppShell>;
}
