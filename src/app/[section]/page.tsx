import { ManagementPage } from "../../components/ManagementPage";
import { SettingsPage } from "../../components/SettingsPage";

export default async function SectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  if (section === "settings") return <SettingsPage />;
  if (section === "reports") return <ManagementPage section="actions" />;
  return <ManagementPage section={section} />;
}
