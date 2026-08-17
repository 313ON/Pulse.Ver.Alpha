import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PULSE | سامانه برنامه‌ریزی و عملکرد چرب شیمی",
  description: "سامانه مدیریت برنامه، اجرا و عملکرد شرکت چرب شیمی"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fa" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
