import { DetailPage } from "../../../components/DetailPage";

export default async function GoalDetail({ params }: { params: Promise<{ id: string }> }) {
  return <DetailPage type="goals" id={(await params).id} />;
}
