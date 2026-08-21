import { requirePagePermission } from "../api/_lib";

export default async function ReportsLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  await requirePagePermission("reports.view");
  return children;
}
