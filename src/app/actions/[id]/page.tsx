import { DetailPage } from "../../../components/DetailPage";

export default async function ActionDetail({ params }: { params: Promise<{ id: string }> }) {
  return <DetailPage type="actions" id={(await params).id} />;
}
