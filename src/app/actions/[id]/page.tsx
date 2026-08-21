import { DetailPage } from "../../../components/DetailPage";
import { requirePagePermission } from "../../api/_lib";

export default async function ActionDetail({ params }: { params: Promise<{ id: string }> }) {
  await requirePagePermission("actions.view");
  return <DetailPage type="actions" id={(await params).id} />;
}
