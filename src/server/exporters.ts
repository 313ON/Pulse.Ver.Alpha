import * as XLSX from "xlsx";
import PDFDocument from "pdfkit/js/pdfkit.standalone.js";
import fs from "node:fs";
import type { buildReport } from "./reporting";

type Report = ReturnType<typeof buildReport>;

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
