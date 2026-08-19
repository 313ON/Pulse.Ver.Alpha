import * as XLSX from "xlsx";
import PDFDocument from "pdfkit/js/pdfkit.standalone.js";
import fs from "node:fs";
import type { buildReport } from "./reporting";
import type { GovernedOperationalReport } from "../application/reporting";

type Report = ReturnType<typeof buildReport>;

function governedRows(report: GovernedOperationalReport) {
  return report.rows.map((row) => ({
    "شناسه": row.id,
    "عنوان": row.title,
    "نوع": row.type,
    "وضعیت": row.status,
    "پیشرفت": row.progress,
    "هدف": row.goalId ?? "",
    "والد": row.parentId ?? "",
    "تخصیص‌های مجاز": row.eligibleAssignmentIds.join(", ")
  }));
}

export function createXlsxBuffer(report: Report): Buffer {
  const worksheet = XLSX.utils.json_to_sheet(report.actions.map((action) => ({
    "شناسه اقدام": action.public_id,
    "عنوان": action.title,
    "هدف": action.goal_title,
    "زیرهدف": action.sub_goal_title,
    "فعالیت": action.activity_title,
    "واحد": action.department,
    "مسئول": action.owner,
    "وضعیت": action.status,
    "پیشرفت": action.progress,
    "شروع": action.planned_start,
    "موعد": action.planned_end
  })));
  worksheet["!sheetViews"] = [{ rightToLeft: true }];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "گزارش برنامه");
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

export function createPdfBuffer(report: Report): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 36 });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    const fontPath = "C:\\Windows\\Fonts\\tahoma.ttf";
    doc.font(fs.readFileSync(fontPath));
    doc.fontSize(18).text(report.title, { align: "right" });
    doc.fontSize(9).text(`تاریخ تولید: ${report.generatedAt}`, { align: "right" });
    doc.moveDown();
    doc.fontSize(11).text(`تعداد اهداف: ${report.summary.totalGoals}`, { align: "right" });
    doc.text(`تعداد اقدامات: ${report.summary.totalActions}`, { align: "right" });
    doc.text(`درصد تکمیل: ${report.summary.completionPercentage}%`, { align: "right" });
    doc.text(`اقدامات معوق: ${report.summary.overdueActions}`, { align: "right" });
    doc.text(`ریسک‌های مهم: ${report.summary.highRisks}`, { align: "right" });
    doc.text(`وابستگی‌های حل‌نشده: ${report.summary.unresolvedDependencies}`, { align: "right" });
    doc.moveDown();
    report.actions.slice(0, 35).forEach((action) => {
      doc.fontSize(8).text(`${action.public_id} | ${action.title} | ${action.status} | ${action.progress}%`, { align: "right" });
    });
    doc.end();
  });
}

export function createGovernedXlsxBuffer(report: GovernedOperationalReport): Buffer {
  const worksheet = XLSX.utils.json_to_sheet(governedRows(report));
  const findingsWorksheet = XLSX.utils.json_to_sheet(report.findings.map((finding) => ({
    "قاعده": finding.ruleId,
    "شدت": finding.severity,
    "موضوع": `${finding.subject.type}:${finding.subject.id ?? ""}`,
    "توضیح": finding.reason,
    "سال برنامه": finding.planYear
  })));
  worksheet["!sheetViews"] = [{ rightToLeft: true }];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "گزارش حاکمیتی");
  XLSX.utils.book_append_sheet(workbook, findingsWorksheet, "یافته‌های حاکمیتی");
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

export function createGovernedPdfBuffer(report: GovernedOperationalReport): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 36 });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    const fontPath = "C:\\Windows\\Fonts\\tahoma.ttf";
    doc.font(fs.readFileSync(fontPath));
    doc.fontSize(18).text("گزارش عملیاتی حاکمیتی", { align: "right" });
    doc.fontSize(9).text(`تاریخ تولید: ${report.generatedAt}`, { align: "right" });
    doc.fontSize(10).text(`وضعیت ارزیابی: ${report.evaluationState}`, { align: "right" });
    doc.text(`امتیاز کیفیت: ${report.summary.qualityScore}`, { align: "right" });
    doc.text(`تعداد یافته‌ها: ${report.summary.governedFindings}`, { align: "right" });
    doc.moveDown();
    report.rows.slice(0, 35).forEach((row) => {
      doc.fontSize(8).text(
        `${row.id} | ${row.title} | ${row.status} | ${row.progress}%`,
        { align: "right" }
      );
    });
    report.findings.slice(0, 20).forEach((finding) => {
      doc.fontSize(7).text(`${finding.ruleId} | ${finding.severity} | ${finding.reason}`, { align: "right" });
    });
    doc.end();
  });
}
