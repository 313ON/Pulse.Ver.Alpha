import type { Metadata } from "next";
import { Vazirmatn } from "next/font/google";
import "./globals.css";
import { getPlanningContext } from "../domain/planning";

const vazirmatn = Vazirmatn({
  subsets: ["arabic", "latin"],
  display: "swap",
  variable: "--font-vazirmatn",
  preload: true
});
export const metadata: Metadata = {
  title: "PULSE | سامانه برنامه‌ریزی و عملکرد چرب شیمی",
  description: "سامانه مدیریت برنامه، اجرا و عملکرد شرکت چرب شیمی"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const planning = getPlanningContext();
  return (
    <html lang="fa" dir="rtl" className={vazirmatn.variable} data-plan-year={planning.planYear}>
      <body>{children}</body>
    </html>
  );
}
