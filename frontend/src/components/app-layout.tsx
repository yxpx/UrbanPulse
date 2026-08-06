"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { useAuth } from "@/lib/auth";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { loading, user } = useAuth();

  if (pathname === "/login") {
    return <main className="min-h-screen w-full bg-background">{children}</main>;
  }

  if (loading || !user) {
    return (
      <div className="flex min-h-screen w-full flex-col items-center justify-center bg-background p-6">
        <div className="flex items-center space-x-3 text-muted-foreground">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <span className="text-sm font-medium tracking-wide">Verifying security authorization session...</span>
        </div>
      </div>
    );
  }

  return (
    <>
      <Sidebar />
      <main className="ml-56 min-h-screen p-6 bg-background text-foreground">
        {children}
      </main>
    </>
  );
}
