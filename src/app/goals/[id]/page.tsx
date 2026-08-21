import { DetailPage } from "../../../components/DetailPage";
import { requirePagePermission } from "../../api/_lib";

export default async function GoalDetail({ params }: { params: Promise<{ id: string }> }) {
  await requirePagePermission("goals.view");
  return <DetailPage type="goals" id={(await params).id} />;
}
