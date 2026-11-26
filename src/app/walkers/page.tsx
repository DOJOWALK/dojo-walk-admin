import AppShell from "@/components/app-shell";
import WalkersClient from "./walkers-client";

export default function WalkersPage() {
  return <AppShell active="walkers"><WalkersClient /></AppShell>;
}
