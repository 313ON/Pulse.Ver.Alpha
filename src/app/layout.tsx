import type { Metadata } from "next";
import { Inter, Vazirmatn } from "next/font/google";
import "./globals.css";

const vazirmatn = Vazirmatn({
  subsets: ["arabic", "latin"],
  display: "swap",
  variable: "--font-vazirmatn",
  preload: true
});
const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
  preload: true
});

export const metadata: Metadata = {
  title: "PULSE | سامانه برنامه‌ریزی و عملکرد چرب شیمی",
  description: "سامانه مدیریت برنامه، اجرا و عملکرد شرکت چرب شیمی"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fa" dir="rtl">
      <body className={`${vazirmatn.variable} ${inter.variable}`}>{children}</body>
    </html>
  );
}
