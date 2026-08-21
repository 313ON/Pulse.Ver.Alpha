import { requirePagePermission } from "../api/_lib";

export default async function ProgramLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  await requirePagePermission("goals.view");
  return children;
}
