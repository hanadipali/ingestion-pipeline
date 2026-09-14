import { parse } from "csv-parse/sync";
import { createHash } from "crypto";
import { TransactionRow, RawCsvRow, transactionSchema } from "./schema";

export interface InvalidRow {
  rowNumber: number;
  raw: RawCsvRow;
  reasons: string[];
}

export interface ValidatedRow {
  rowNumber: number;
  data: TransactionRow;
  hash: string;
}

export interface ParseResult {
  validated: ValidatedRow[];
  invalid: InvalidRow[];
}

function hashRow(row: TransactionRow): string {
  const normalizedRow = [
    row.date.toISOString(),
    row.amount,
    row.currency,
    row.description,
    row.category,
  ].join("|");
  return createHash("sha256").update(normalizedRow).digest("hex");
}

export function processCSV(fileBuffer: Buffer): ParseResult {
  const rawRows: RawCsvRow[] = parse(fileBuffer, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  const validated: ValidatedRow[] = [];
  const invalid: InvalidRow[] = [];

  rawRows.forEach((raw, index) => {
    const rowNumber = index + 2;

    const result = transactionSchema.safeParse(raw);

    if (result.success) {
      validated.push({
        rowNumber,
        data: result.data,
        hash: hashRow(result.data),
      });
    } else {
      const reasons = result.error.issues.map(
        (issue) => `${issue.path.join(".")}: ${issue.message}`
      );
      invalid.push({ rowNumber, raw, reasons });
    }
  });

  return { validated, invalid };
}
