import Link from "next/link";
import { CognitionPanel } from "../cognition/CognitionPanel";
import { sampleProgram } from "../../domain/program";
import { HierarchyBreadcrumb } from "./HierarchyBreadcrumb";
import { ProgramTree } from "./ProgramTree";
import { ProgressIndicator } from "./ProgressIndicator";

export function StrategicCommandCenter() {
  const goalCount = sampleProgram.goals.length;
  const objectiveCount = sampleProgram.goals.reduce((total, goal) => total + goal.objectives.length, 0);
  const actionCount = sampleProgram.goals.reduce((total, goal) => total + goal.objectives.reduce((inner, objective) => total + objective.activities.reduce((activityTotal, activity) => total + activity.actions.length, 0), 0), 0);

  return (
    <div className="page strategic-command-center">
      <div className="page-heading strategic-heading">
        <div>
          <div className="eyebrow">مرکز فرمان راهبردی / چرخه ۱۴۰۵</div>
          <h1>معماری برنامه سازمانی <span>✦</span></h1>
          <p>از نیت راهبردی تا اقدام قابل سنجش؛ همه‌چیز در یک زنجیره هم‌راستا</p>
          <HierarchyBreadcrumb nodes={[sampleProgram]} />
        </div>
        <div className="strategic-heading-actions">
          <Link href="/reports" className="secondary-button">گزارش برنامه</Link>
          <Link href="/actions" className="primary-button">＋ اقدام جدید</Link>
        </div>
      </div>
      <div className="strategic-summary">
        <div className="strategic-summary-main"><div><span className="program-panel-kicker">برنامه فعال</span><h2>{sampleProgram.title}</h2><p>{sampleProgram.description}</p></div><ProgressIndicator value={sampleProgram.progress} /></div>
        <SummaryMetric label="اهداف راهبردی" value={goalCount} detail="در سطح برنامه" tone="cyan" />
        <SummaryMetric label="اهداف جزئی" value={objectiveCount} detail="در مسیر اجرا" tone="amber" />
        <SummaryMetric label="اقدامات متصل" value={actionCount} detail="قابل پیگیری" tone="green" />
      </div>
      <CognitionPanel />
      <ProgramTree />
    </div>
  );
}

function SummaryMetric({ label, value, detail, tone }: { label: string; value: number; detail: string; tone: string }) {
  return <div className={`strategic-metric ${tone}`}><span>{label}</span><strong>{value}</strong><small>{detail}</small></div>;
}
