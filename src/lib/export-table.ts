import { saveFile } from "./download";
import { buildXlsx, XLSX_MIME, type XlsxCell, type XlsxColumn, type XlsxColumnType } from "./xlsx";

/**
 * The one entry point for every Export button: downloads the rows as a styled Excel file named
 * `<fileName>-<yyyy-mm-dd>.xlsx`. When the backend starts producing these files, swap the call for
 * `downloadResponse` from ./download; the buttons stay the same.
 */

export type ExportColumnType = XlsxColumnType;
/** A plain header is a text column; give a type for numbers, money and dates, and `total` to sum it. */
export type ExportColumn = string | XlsxColumn;
export type ExportCell = XlsxCell;

export type ExportTableOptions = {
  /** File name without date or extension, e.g. "shipments". */
  fileName: string;
  /** Shown in bold above the table. */
  title: string;
  /** Excel tab name; defaults to the title. */
  sheetName?: string;
  columns: ExportColumn[];
  rows: ExportCell[][];
  totalsLabel?: string;
  /** For tests: the moment written in the export note and file name. */
  now?: Date;
};

const pad = (n: number) => String(n).padStart(2, "0");
const day = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const toColumns = (columns: ExportColumn[]): XlsxColumn[] =>
  columns.map((c) => (typeof c === "string" ? { header: c } : c));

export function exportTableBytes({
  title,
  sheetName,
  columns,
  rows,
  totalsLabel,
  now = new Date(),
}: Omit<ExportTableOptions, "fileName">): Uint8Array {
  const stamp = now.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  return buildXlsx([
    {
      name: sheetName ?? title,
      title,
      subtitle: `Exported ${stamp} · ${rows.length} ${rows.length === 1 ? "row" : "rows"}`,
      columns: toColumns(columns),
      rows,
      ...(totalsLabel ? { totalsLabel } : {}),
    },
  ]);
}

export function exportTable(options: ExportTableOptions): void {
  const now = options.now ?? new Date();
  const bytes = exportTableBytes({ ...options, now });
  saveFile(
    new Blob([bytes as BlobPart], { type: XLSX_MIME }),
    `${options.fileName}-${day(now)}.xlsx`,
  );
}
