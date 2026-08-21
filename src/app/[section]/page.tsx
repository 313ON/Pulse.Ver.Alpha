import { ManagementPage } from "../../components/ManagementPage";
import { SettingsPage } from "../../components/SettingsPage";
import { ImportPage } from "../../components/ImportPage";
import { requirePagePermission, requirePageSession } from "../api/_lib";
import { pagePermissions } from "../pageAuthorization";

export default async function SectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  const permission = pagePermissions[section];
  if (permission) await requirePagePermission(permission);
  else await requirePageSession();
  if (section === "settings") return <SettingsPage />;
  if (section === "imports") return <ImportPage />;
  if (section === "reports") return <ManagementPage section="actions" />;
  return <ManagementPage section={section} />;
}
