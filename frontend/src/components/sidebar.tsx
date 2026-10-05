"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { useCity } from "@/lib/city-context";
import { 
  LayoutDashboard, 
  LineChart, 
  Layers, 
  Activity, 
  Route, 
  Video,
  Settings,
  Globe
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
  const { city, setCity, cityConfig } = useCity();

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-56 border-r border-border bg-background flex flex-col justify-between">
      <div>
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between">
            <h1 className="text-sm font-semibold tracking-wide text-foreground flex items-center gap-1.5">
              <Globe className="h-4 w-4 text-primary" />
              UrbanPulse
            </h1>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
              {cityConfig.sensorCount} nodes
            </span>
          </div>

          {/* Segmented City Switcher */}
          <div className="mt-3 grid grid-cols-2 gap-1 rounded-lg bg-muted p-1 border border-border">
            <button
              type="button"
              onClick={() => setCity("la")}
              className={cn(
                "flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-all",
                city === "la"
                  ? "bg-background text-foreground shadow-sm font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <span>🇺🇸 LA</span>
            </button>
            <button
              type="button"
              onClick={() => setCity("mumbai")}
              className={cn(
                "flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-all",
                city === "mumbai"
                  ? "bg-background text-foreground shadow-sm font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <span>🇮🇳 Mumbai</span>
            </button>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1.5 truncate">
            {cityConfig.subtitle}
          </p>
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
