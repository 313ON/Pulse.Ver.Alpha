import type { SheetContract } from "./contracts";
import {
  importTemplateGroupProperties,
  type ImportColumnDefinition,
  type ImportColumnGroup,
  type ImportTemplateDefinition
} from "./ImportTemplateDefinition";

export type ResolvedColumnMapping = {
  key: string;
  group: ImportColumnGroup;
  column: string;
  header: string;
};

export type MappingError = {
  code: "MISSING_REQUIRED_COLUMN" | "AMBIGUOUS_COLUMN";
  message: string;
  group: ImportColumnGroup;
  key: string;
  expectedHeaders: string[];
};

export type ColumnMappingResult = {
  valid: boolean;
  mappings: ResolvedColumnMapping[];
  errors: MappingError[];
  normalizedHeaders: Record<string, string>;
};

const GROUPS = Object.keys(importTemplateGroupProperties) as ImportColumnGroup[];

export function normalizeSpreadsheetHeader(value: unknown): string {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/[\u200c\u200d]/g, " ")
    .replace(/[يى]/g, "ی")
    .replace(/[ك]/g, "ک")
    .replace(/[ۀة]/g, "ه")
    .replace(/[إأآ]/g, "ا")
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/[ـ]/g, "")
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export class ColumnMappingResolver {
  constructor(private readonly template: ImportTemplateDefinition) {}

  resolve(input: string[] | SheetContract): ColumnMappingResult {
    const headers = Array.isArray(input)
      ? input
      : this.headersFromSheet(input);
    const normalizedHeaders: Record<string, string> = {};
    const columnsByHeader = new Map<string, string[]>();

    headers.forEach((header, index) => {
      const column = this.columnName(index);
      const normalized = normalizeSpreadsheetHeader(header);
      normalizedHeaders[column] = normalized;
      if (!normalized) return;
      const columns = columnsByHeader.get(normalized) ?? [];
      columns.push(column);
      columnsByHeader.set(normalized, columns);
    });

    const mappings: ResolvedColumnMapping[] = [];
    const errors: MappingError[] = [];
    for (const group of GROUPS) {
      const property = importTemplateGroupProperties[group];
      for (const definition of this.template[property] ?? []) {
        const matches = this.matchDefinition(definition, columnsByHeader);
        if (matches.length === 1) {
          mappings.push({
            key: definition.key,
            group,
            column: matches[0].column,
            header: matches[0].header
          });
        } else if (matches.length > 1) {
          errors.push({
            code: "AMBIGUOUS_COLUMN",
            message: `Column mapping for "${definition.key}" is ambiguous.`,
            group,
            key: definition.key,
            expectedHeaders: definition.headers
          });
        } else if (definition.required) {
          errors.push({
            code: "MISSING_REQUIRED_COLUMN",
            message: `Required column "${definition.key}" is missing.`,
            group,
            key: definition.key,
            expectedHeaders: definition.headers
          });
        }
      }
    }

    return { valid: errors.length === 0, mappings, errors, normalizedHeaders };
  }

  private headersFromSheet(sheet: SheetContract): string[] {
    const headerRowIndex = sheet.metadata.headerRowIndex ?? 0;
    const row = sheet.rows.find((candidate) => candidate.index === headerRowIndex)
      ?? sheet.rows[headerRowIndex];
    return row?.cells.map((cell) => cell.rawValue == null ? "" : String(cell.rawValue)) ?? [];
  }

  private matchDefinition(
    definition: ImportColumnDefinition,
    columnsByHeader: Map<string, string[]>
  ): Array<{ column: string; header: string }> {
    const matches: Array<{ column: string; header: string }> = [];
    for (const header of definition.headers) {
      const normalized = normalizeSpreadsheetHeader(header);
      for (const column of columnsByHeader.get(normalized) ?? []) {
        matches.push({ column, header });
      }
    }
    return matches.filter((match, index) =>
      matches.findIndex((candidate) => candidate.column === match.column) === index
    );
  }

  private columnName(index: number): string {
    let value = index + 1;
    let name = "";
    while (value > 0) {
      const remainder = (value - 1) % 26;
      name = String.fromCharCode(65 + remainder) + name;
      value = Math.floor((value - 1) / 26);
    }
    return name;
  }
}
