"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { 
  LayoutDashboard, 
  LineChart, 
  Layers, 
  Activity, 
  Route, 
  Video,
  Settings
} from "lucide-react";

const links = [
  { href: "/", label: "System Overview", icon: LayoutDashboard },
  { href: "/route-planner", label: "Route Planner", icon: Route },
  { href: "/cctv-analytics", label: "CCTV Analytics", icon: Video },
  { href: "/prediction-analysis", label: "Prediction Analysis", icon: LineChart },
  { href: "/feature-attribution", label: "Feature Attribution", icon: Layers },
  { href: "/model-performance", label: "Model Performance", icon: Activity },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-56 border-r border-border bg-background flex flex-col justify-between">
      <div>
        <div className="p-5 border-b border-border">
          <h1 className="text-sm font-semibold tracking-wide text-foreground">
            UrbanPulse
          </h1>
          <p className="text-[11px] text-muted-foreground mt-0.5">METR-LA · 207 sensors</p>
        </div>
        <nav className="p-3 space-y-0.5">
          {links.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
                pathname === href
                  ? "bg-accent text-accent-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
        </nav>
      </div>

      {user && (
        <div className="border-t border-border p-3.5 space-y-3 bg-muted/20">
          <div>
            <p className="truncate text-xs font-semibold text-foreground">
              {user.username}
            </p>
            <p className="truncate text-[11px] text-muted-foreground mt-0.5">
              Role: {user.role}
            </p>
          </div>

          {user.role === "Administrator" && (
            <Link
              href="/user-management"
              className={cn(
                "flex items-center gap-2 rounded border px-2.5 py-1.5 text-xs transition-colors w-full",
                pathname === "/user-management"
                  ? "border-zinc-500 bg-zinc-800 text-zinc-100 font-medium"
                  : "border-zinc-700 bg-zinc-900/50 text-zinc-300 hover:bg-zinc-800"
              )}
            >
              <Settings className="h-3.5 w-3.5 text-zinc-400" />
              <span>Access Control</span>
            </Link>
          )}

          <button
            onClick={logout}
            className="flex w-full items-center justify-center rounded border border-zinc-700 bg-zinc-800 px-2.5 py-1.5 text-[11px] text-zinc-300 hover:bg-zinc-700 focus:outline-none"
          >
            Sign out
          </button>
        </div>
      )}
    </aside>
  );
}
