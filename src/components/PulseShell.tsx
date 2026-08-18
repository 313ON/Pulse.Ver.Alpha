"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CommandHeader } from "./CommandHeader";
import { CommandSidebar } from "./CommandSidebar";
import { SystemFooter } from "./SystemFooter";
import { WorkspaceLayout } from "./WorkspaceLayout";

export function PulseShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<{ username: string; role: string } | null>(null);

  useEffect(() => {
    fetch("/api/auth/me").then((response) => response.json()).then((body) => {
      if (!body.user) router.replace("/login");
      else setUser(body.user);
    }).catch(() => router.replace("/login"));
  }, [router]);

  async function logout() {
    const csrf = await fetch("/api/auth/csrf").then((response) => response.json());
    await fetch("/api/auth/logout", { method: "POST", headers: { "x-csrf-token": csrf.token } });
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="app-shell pulse-shell">
      <CommandSidebar user={user} onLogout={logout} />
      <section className="content">
        <CommandHeader />
        <WorkspaceLayout>{children}</WorkspaceLayout>
        <SystemFooter />
      </section>
    </div>
  );
}
