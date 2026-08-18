import { ManagementPage } from "../../components/ManagementPage";

export default async function SectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  if (section === "reports" || section === "settings") {
    return <ManagementPage section={section === "reports" ? "actions" : "departments"} />;
  }
  return <ManagementPage section={section} />;
}
