import Link from "next/link";

export default function ManagementTabs({ active }: { active: "bookings" | "customers" | "dogs" }) {
  const items = [
    { key: "bookings", label: "Booking List", href: "/bookings" },
    { key: "customers", label: "Customer List", href: "/customers" },
  ] as const;
  return <nav className="management-tabs" aria-label="Bookings, customers and dogs">
    {items.map(item => <Link key={item.key} href={item.href} className={`management-tab ${active === item.key ? "active" : ""}`} aria-current={active === item.key ? "page" : undefined}>{item.label}</Link>)}
  </nav>;
}
