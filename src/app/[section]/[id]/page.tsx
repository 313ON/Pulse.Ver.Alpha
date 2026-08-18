import { RecordDetailPage } from "../../../components/RecordDetailPage";

export default async function RecordPage({ params }: { params: Promise<{ section: string; id: string }> }) {
  const value = await params;
  return <RecordDetailPage section={value.section} id={value.id} />;
}
