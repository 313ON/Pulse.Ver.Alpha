import { RecordDetailPage } from "../../../components/RecordDetailPage";
import { requirePagePermission } from "../../api/_lib";
import { permissionForPage } from "../../pageAuthorization";

export default async function RecordPage({ params }: { params: Promise<{ section: string; id: string }> }) {
  const value = await params;
  await requirePagePermission(permissionForPage(value.section));
  return <RecordDetailPage section={value.section} id={value.id} />;
}
