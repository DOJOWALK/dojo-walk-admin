import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyAdminSession, getAdminCookieName } from "@/lib/auth";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { Activity, CalendarDays, ChartNoAxesCombined, CircleDollarSign, ClipboardList, Dog, House, MessageCircle, Settings, Users, Wallet } from "lucide-react";

const navigation = [
  { label: "Overview", href: "/", key: "overview", icon: House },
  { label: "Customers", href: "/customers", key: "customers", icon: Users },
  { label: "Dogs", href: "/dogs", key: "dogs", icon: Dog },
  { label: "Bookings", href: "/bookings", key: "bookings", icon: ClipboardList },
  { label: "Walk Schedule", href: "/schedule", key: "schedule", icon: CalendarDays },
  { label: "Attendance", href: "/attendance", key: "attendance", icon: Activity },
  { label: "Payments", href: "/payments", key: "payments", icon: CircleDollarSign },
  { label: "Expenses", href: "/expenses", key: "expenses", icon: Wallet },
  { label: "Reports", href: "/reports", key: "reports", icon: ChartNoAxesCombined },
  { label: "WhatsApp", href: "/whatsapp", key: "whatsapp", icon: MessageCircle, comingSoon: true },
  { label: "Settings", href: "/settings", key: "settings", icon: Settings, comingSoon: true }
];

export default async function AppShell({ children, active }: { children: React.ReactNode; active: string }) {
  const cookieStore = await cookies();
  const env = getCloudflareContext().env as { SESSION_SECRET?: string };
  const isAdmin = await verifyAdminSession(cookieStore.get(getAdminCookieName())?.value, env.SESSION_SECRET);
  if (!isAdmin) redirect("/login");

  return (
    <div className="shell">
      <aside className="sidebar">
        <a className="brand" href="/">
          <div className="brand-mark">DW</div>
          <div><div className="brand-name">Dojo Walk</div><div className="brand-sub">ADMIN WORKSPACE</div></div>
        </a>
        <div><p className="nav-label">WORKSPACE</p><nav className="nav-list" aria-label="Main navigation">
          {navigation.map(({ label, href, key, icon: Icon, comingSoon }) => comingSoon ? <span key={key} className="nav-link disabled" aria-disabled="true"><Icon size={16}/>{label}<small>Soon</small></span> : <a key={key} href={href} aria-current={active === key ? "page" : undefined} className={`nav-link ${active === key ? "active" : ""}`}><Icon size={16}/>{label}</a>)}
        </nav></div>
        <div className="sidebar-foot">Gaur City · Crossings Republik<br/>Ghaziabad, Uttar Pradesh<br/><strong>Single-admin system</strong></div>
      </aside>
      <div className="content-area">{children}</div>
    </div>
  );
}
