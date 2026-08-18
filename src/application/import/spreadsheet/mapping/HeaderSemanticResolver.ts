import { normalizeSpreadsheetHeader } from "../ColumnMappingResolver";
import type { CellContract, RowContract } from "../contracts";
import type { ColumnSemanticType } from "./ColumnSemanticType";

const HEADER_ALIASES: Record<ColumnSemanticType, string[]> = {
  GOAL: ["هدف", "هدف کل", "هدف اصلی", "goal", "main goal", "strategic goal"],
  OBJECTIVE: ["هدف جزئی", "هدف عملیاتی", "objective", "sub goal", "sub-goal"],
  ACTIVITY: ["فعالیت", "activity"],
  ACTION: ["اقدام", "اقدامات", "action", "actions"],
  KPI: ["شاخص", "شاخص کلیدی", "kpi", "key performance indicator"],
  KPI_TARGET: ["هدف شاخص", "مقدار هدف", "kpi target", "target"],
  KPI_VALUE: ["مقدار شاخص", "مقدار", "kpi value", "value", "actual"],
  KPI_UNIT: ["واحد شاخص", "واحد اندازه‌گیری", "kpi unit", "measurement unit"],
  OWNER: ["مالک", "صاحب", "owner"],
  EXECUTOR: ["مسئول", "مسئول اجرا", "مجری", "executor", "responsible"],
  COLLABORATOR: ["همکار", "همکاران", "collaborator", "collaborators"],
  UNIT: ["واحد", "واحد سازمانی", "unit", "department", "organizational unit"],
  PERSON: ["شخص", "فرد", "person"],
  START_DATE: ["تاریخ شروع", "زمان شروع", "شروع", "start date", "start", "planned start"],
  END_DATE: ["تاریخ پایان", "زمان پایان", "پایان", "end date", "end", "deadline", "planned end"],
  DURATION: ["مدت", "duration"],
  WORKING_DAYS: ["روز کاری", "روزهای کاری", "working days", "work days"],
  PERSON_HOURS: ["نفر ساعت", "نفرساعت", "person hours", "person-hours"],
  PROGRESS: ["پیشرفت", "درصد پیشرفت", "progress", "completion", "completion percent"]
};

const NORMALIZED_ALIASES = new Map<string, ColumnSemanticType>(
  Object.entries(HEADER_ALIASES).flatMap(([semanticType, aliases]) =>
    aliases.map((alias) => [normalizeSpreadsheetHeader(alias), semanticType as ColumnSemanticType])
  )
);

export type ResolvedSemanticColumn = {
  column: string;
  semanticType: ColumnSemanticType;
  header: string;
};

export class HeaderSemanticResolver {
  resolve(header: unknown): ColumnSemanticType | undefined {
    return NORMALIZED_ALIASES.get(normalizeSpreadsheetHeader(header));
  }

  resolveRow(row: RowContract): ResolvedSemanticColumn[] {
    return row.cells.flatMap((cell) => {
      const semanticType = this.resolve(cell.rawValue);
      return semanticType
        ? [{ column: cell.column, semanticType, header: String(cell.rawValue ?? "") }]
        : [];
    });
  }

  resolveCell(cell: CellContract): ResolvedSemanticColumn | undefined {
    const semanticType = this.resolve(cell.rawValue);
    return semanticType
      ? { column: cell.column, semanticType, header: String(cell.rawValue ?? "") }
      : undefined;
  }
}
