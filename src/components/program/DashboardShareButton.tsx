"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import type { DashboardContext } from "./dashboard-context";
import { dashboardContextToSearchParams } from "./dashboard-context";

type ClipboardWriter = Pick<Clipboard, "writeText">;

export function dashboardShareUrl(pathname: string, context: DashboardContext, origin = ""): string {
  const base = origin.replace(/\/$/, "");
  return `${base}${pathname}?${dashboardContextToSearchParams(context).toString()}`;
}

export async function copyDashboardLink(url: string, clipboard: ClipboardWriter): Promise<void> {
  await clipboard.writeText(url);
}

export function DashboardShareButton({ context }: { context: DashboardContext }) {
  const pathname = usePathname() || "/program";
  const [feedback, setFeedback] = useState<"idle" | "success" | "failure">("idle");

  async function share() {
    const url = dashboardShareUrl(pathname, context, window.location.origin);
    try {
      if (!navigator.clipboard) throw new Error("Clipboard unavailable");
      await copyDashboardLink(url, navigator.clipboard);
      setFeedback("success");
    } catch {
      setFeedback("failure");
    }
  }

  return <div className="dashboard-share-control">
    <button className="secondary-button" type="button" onClick={() => void share()} aria-label="کپی لینک داشبورد">اشتراک‌گذاری</button>
    <span className="dashboard-share-feedback" role="status" aria-live="polite">{feedback === "success" ? "لینک داشبورد کپی شد." : feedback === "failure" ? "کپی لینک انجام نشد." : ""}</span>
  </div>;
}
