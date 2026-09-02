import { ManagementPage } from "../../components/ManagementPage";
import { SettingsPage } from "../../components/SettingsPage";
import { ImportPage } from "../../components/ImportPage";
import { requirePagePermission, requirePageSession } from "../api/_lib";
import { pagePermissions } from "../pageAuthorization";
import { notFound } from "next/navigation";

const supportedSections = new Set([
  "goals", "sub-goals", "activities", "actions", "departments", "roles",
  "persons", "users", "kpis", "risks", "dependencies", "monthly-reviews",
  "imports", "settings"
]);

export default async function SectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  if (!supportedSections.has(section)) notFound();
  const permission = pagePermissions[section];
  if (permission) await requirePagePermission(permission);
  else await requirePageSession();
  if (section === "settings") return <SettingsPage />;
  if (section === "imports") return <ImportPage />;
  if (section === "reports") return <ManagementPage section="actions" />;
  return <ManagementPage section={section} />;
}
