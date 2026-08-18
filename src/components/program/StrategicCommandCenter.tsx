import Link from "next/link";
import { CognitionPanel } from "../cognition/CognitionPanel";
import type { Program } from "../../domain/program";
import { HierarchyBreadcrumb } from "./HierarchyBreadcrumb";
import { ProgramTree } from "./ProgramTree";
import { ProgressIndicator } from "./ProgressIndicator";

export function StrategicCommandCenter({ program }: { program: Program }) {
  const goalCount = program.goals.length;
  const objectiveCount = program.goals.reduce((total, goal) => total + goal.objectives.length, 0);
  const actionCount = program.goals.reduce((total, goal) => total + goal.objectives.reduce((inner, objective) => total + objective.activities.reduce((activityTotal, activity) => total + activity.actions.length, 0), 0), 0);

  return (
    <div className="page strategic-command-center">
      <div className="page-heading strategic-heading">
        <div>
          <div className="eyebrow">مرکز فرمان راهبردی / چرخه ۱۴۰۵</div>
          <h1>معماری برنامه سازمانی <span>✦</span></h1>
          <p>از نیت راهبردی تا اقدام قابل سنجش؛ همه‌چیز در یک زنجیره هم‌راستا</p>
          <HierarchyBreadcrumb nodes={[program]} />
        </div>
        <div className="strategic-heading-actions">
          <Link href="/reports" className="secondary-button">گزارش برنامه</Link>
          <Link href="/actions" className="primary-button">＋ اقدام جدید</Link>
        </div>
      </div>
      <div className="strategic-summary">
        <div className="strategic-summary-main"><div><span className="program-panel-kicker">برنامه فعال</span><h2>{program.title}</h2><p>{program.description}</p></div><ProgressIndicator value={program.progress} /></div>
        <SummaryMetric label="اهداف راهبردی" value={goalCount} detail="در سطح برنامه" tone="cyan" />
        <SummaryMetric label="اهداف جزئی" value={objectiveCount} detail="در مسیر اجرا" tone="amber" />
        <SummaryMetric label="اقدامات متصل" value={actionCount} detail="قابل پیگیری" tone="green" />
      </div>
      <CognitionPanel />
      {program.goals.length === 0 ? <EmptyProgramState /> : <ProgramTree program={program} />}
    </div>
  );
}

function EmptyProgramState() {
  return <section className="panel program-empty-state"><span className="program-panel-kicker">داده زنده برنامه</span><h2>هنوز هدفی برای این برنامه ثبت نشده است</h2><p>پس از افزودن نخستین هدف، زنجیره هم‌راستایی در اینجا نمایش داده می‌شود.</p></section>;
}

function SummaryMetric({ label, value, detail, tone }: { label: string; value: number; detail: string; tone: string }) {
  return <div className={`strategic-metric ${tone}`}><span>{label}</span><strong>{value}</strong><small>{detail}</small></div>;
}
