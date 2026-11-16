import { zip } from "./zip";

/**
 * Builds a styled .xlsx workbook: a title and export note above a filterable, frozen header row, columns
 * sized to their content, typed number and date cells, banded rows and an optional totals row.
 * Cells are written as values only (never formulas), so text such as "=SUM(...)" stays text.
 */

export type XlsxColumnType = "text" | "number" | "integer" | "money" | "date";
export type XlsxColumn = { header: string; type?: XlsxColumnType; total?: boolean };
export type XlsxCell = string | number | null | undefined;
export type XlsxSheet = {
  name: string;
  title?: string;
  subtitle?: string;
  columns: XlsxColumn[];
  rows: XlsxCell[][];
  /** Label for the totals row; the row is added when a column has `total`. */
  totalsLabel?: string;
};

export const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const MIN_WIDTH = 8;
const MAX_WIDTH = 60;

// Style ids in cellXfs below. Body styles come in pairs: plain, then banded.
const S = {
  title: 1,
  subtitle: 2,
  header: 3,
  body: { text: 4, number: 6, integer: 8, money: 10, date: 12 } as Record<XlsxColumnType, number>,
  wrap: 14,
  totalLabel: 16,
  totalMoney: 17,
  totalNumber: 18,
  totalInteger: 19,
};

/** XML 1.0 cannot carry most control characters or U+FFFE / U+FFFF at all, so they are dropped. */
const xmlSafe = (s: string) =>
  [...s]
    .filter((ch) => {
      const c = ch.codePointAt(0)!;
      return (c >= 0x20 || c === 0x09 || c === 0x0a || c === 0x0d) && c !== 0xfffe && c !== 0xffff;
    })
    .join("");
const xml = (s: string) =>
  xmlSafe(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

export function columnLetter(index: number): string {
  let n = index + 1;
  let s = "";
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

const NUMERIC = /^-?\d+(\.\d+)?$/;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function excelDate(iso: string): number | null {
  const m = ISO_DATE.exec(iso);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const t = Date.UTC(y, mo - 1, d);
  const back = new Date(t);
  if (back.getUTCMonth() !== mo - 1 || back.getUTCDate() !== d) return null;
  return (t - Date.UTC(1899, 11, 30)) / 86_400_000;
}

type Typed = { kind: "empty" } | { kind: "text"; text: string } | { kind: "num"; value: number };

/** A cell as written: numbers and ISO dates in typed columns become real numbers; anything else is text. */
function typed(value: XlsxCell, type: XlsxColumnType): Typed {
  if (value === null || value === undefined || value === "") return { kind: "empty" };
  if (type === "number" || type === "integer" || type === "money") {
    if (typeof value === "number" && Number.isFinite(value)) return { kind: "num", value };
    const s = String(value).trim().replace(/,/g, "");
    if (NUMERIC.test(s)) return { kind: "num", value: Number(s) };
  }
  if (type === "date") {
    const serial = excelDate(String(value).trim());
    if (serial !== null) return { kind: "num", value: serial };
  }
  return { kind: "text", text: String(value) };
}

/** Roughly what Excel will display, to size the column. */
function shownLength(cell: Typed, type: XlsxColumnType): number {
  if (cell.kind === "empty") return 0;
  if (cell.kind === "text") return Math.max(...cell.text.split("\n").map((l) => l.length));
  if (type === "date") return 11; // 11-Jun-2026
  const digits = cell.value.toLocaleString("en-US", {
    minimumFractionDigits: type === "money" ? 2 : 0,
    maximumFractionDigits: type === "money" ? 2 : type === "integer" ? 0 : 4,
  });
  return digits.length;
}

function sheetXml(sheet: XlsxSheet): { xml: string; filterRef: string } {
  const cols = sheet.columns.map((c) => ({ ...c, type: c.type ?? "text" }));
  const lines: string[] = [];
  let r = 0;
  const textCell = (ref: string, text: string, style: number) =>
    `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${xml(text)}</t></is></c>`;

  if (sheet.title) {
    r++;
    lines.push(
      `<row r="${r}" ht="24" customHeight="1">${textCell(`A${r}`, sheet.title, S.title)}</row>`,
    );
  }
  if (sheet.subtitle) {
    r++;
    lines.push(`<row r="${r}">${textCell(`A${r}`, sheet.subtitle, S.subtitle)}</row>`);
  }
  if (sheet.title || sheet.subtitle) r++; // a blank spacer row

  r++;
  const headerRow = r;
  lines.push(
    `<row r="${r}" ht="22" customHeight="1">${cols
      .map((c, i) => textCell(`${columnLetter(i)}${r}`, c.header, S.header))
      .join("")}</row>`,
  );

  const widths = cols.map((c) => Math.ceil(c.header.length * 1.15) + 2);
  const totals = cols.map(() => 0);
  sheet.rows.forEach((row, rowIndex) => {
    r++;
    const band = rowIndex % 2;
    const cells = cols.map((c, i) => {
      const ref = `${columnLetter(i)}${r}`;
      const cell = typed(row[i], c.type);
      widths[i] = Math.max(widths[i]!, shownLength(cell, c.type) + 2);
      if (cell.kind === "num" && c.total) totals[i]! += cell.value;
      if (cell.kind === "empty") return `<c r="${ref}" s="${S.body[c.type] + band}"/>`;
      if (cell.kind === "num")
        return `<c r="${ref}" s="${S.body[c.type] + band}"><v>${cell.value}</v></c>`;
      const long = cell.text.length > MAX_WIDTH || cell.text.includes("\n");
      return textCell(ref, cell.text, long ? S.wrap + band : S.body.text + band);
    });
    lines.push(`<row r="${r}">${cells.join("")}</row>`);
  });
  const lastDataRow = r;

  if (cols.some((c) => c.total)) {
    r++;
    const cells = cols.map((c, i) => {
      const ref = `${columnLetter(i)}${r}`;
      if (c.total) {
        const style =
          c.type === "money" ? S.totalMoney : c.type === "integer" ? S.totalInteger : S.totalNumber;
        return `<c r="${ref}" s="${style}"><v>${Math.round(totals[i]! * 100) / 100}</v></c>`;
      }
      return i === 0
        ? textCell(ref, sheet.totalsLabel ?? "Total", S.totalLabel)
        : `<c r="${ref}" s="${S.totalLabel}"/>`;
    });
    lines.push(`<row r="${r}" ht="20" customHeight="1">${cells.join("")}</row>`);
  }

  const lastCol = columnLetter(cols.length - 1);
  const filterRef = `A${headerRow}:${lastCol}${Math.max(lastDataRow, headerRow)}`;
  const colXml = widths
    .map((w, i) => {
      const width = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, w));
      return `<col min="${i + 1}" max="${i + 1}" width="${width}" customWidth="1"/>`;
    })
    .join("");
  return {
    filterRef,
    xml:
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
      `<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>` +
      `<dimension ref="A1:${lastCol}${Math.max(r, 1)}"/>` +
      `<sheetViews><sheetView workbookViewId="0" zoomScale="100">` +
      `<pane ySplit="${headerRow}" topLeftCell="A${headerRow + 1}" activePane="bottomLeft" state="frozen"/>` +
      `<selection pane="bottomLeft" activeCell="A${headerRow + 1}" sqref="A${headerRow + 1}"/>` +
      `</sheetView></sheetViews>` +
      `<sheetFormatPr defaultRowHeight="18" customHeight="1"/>` +
      `<cols>${colXml}</cols>` +
      `<sheetData>${lines.join("")}</sheetData>` +
      `<autoFilter ref="${filterRef}"/>` +
      `<pageMargins left="0.4" right="0.4" top="0.5" bottom="0.5" header="0.3" footer="0.3"/>` +
      `<pageSetup orientation="landscape" fitToWidth="1" fitToHeight="0"/>` +
      `</worksheet>`,
  };
}

const STYLES =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
  `<numFmts count="2"><numFmt numFmtId="164" formatCode="dd\\-mmm\\-yyyy"/><numFmt numFmtId="165" formatCode="#,##0.####"/></numFmts>` +
  `<fonts count="5">` +
  `<font><sz val="11"/><color rgb="FF1F2937"/><name val="Calibri"/><family val="2"/></font>` +
  `<font><b/><sz val="15"/><color rgb="FF111827"/><name val="Calibri"/><family val="2"/></font>` +
  `<font><i/><sz val="10"/><color rgb="FF6B7280"/><name val="Calibri"/><family val="2"/></font>` +
  `<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/><family val="2"/></font>` +
  `<font><b/><sz val="11"/><color rgb="FF111827"/><name val="Calibri"/><family val="2"/></font>` +
  `</fonts>` +
  `<fills count="5">` +
  `<fill><patternFill patternType="none"/></fill>` +
  `<fill><patternFill patternType="gray125"/></fill>` +
  `<fill><patternFill patternType="solid"><fgColor rgb="FF1D4ED8"/><bgColor indexed="64"/></patternFill></fill>` +
  `<fill><patternFill patternType="solid"><fgColor rgb="FFF3F6FA"/><bgColor indexed="64"/></patternFill></fill>` +
  `<fill><patternFill patternType="solid"><fgColor rgb="FFE5ECF6"/><bgColor indexed="64"/></patternFill></fill>` +
  `</fills>` +
  `<borders count="3">` +
  `<border><left/><right/><top/><bottom/><diagonal/></border>` +
  `<border><left style="thin"><color rgb="FFDCE1E8"/></left><right style="thin"><color rgb="FFDCE1E8"/></right><top style="thin"><color rgb="FFDCE1E8"/></top><bottom style="thin"><color rgb="FFDCE1E8"/></bottom><diagonal/></border>` +
  `<border><left style="thin"><color rgb="FFDCE1E8"/></left><right style="thin"><color rgb="FFDCE1E8"/></right><top style="medium"><color rgb="FF1D4ED8"/></top><bottom style="thin"><color rgb="FFDCE1E8"/></bottom><diagonal/></border>` +
  `</borders>` +
  `<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>` +
  `<cellXfs count="20">` +
  // 0 default
  `<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>` +
  // 1 title, 2 subtitle
  `<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment vertical="center"/></xf>` +
  `<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>` +
  // 3 header
  `<xf numFmtId="0" fontId="3" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>` +
  // 4-5 text, 6-7 number, 8-9 integer, 10-11 money, 12-13 date (plain, banded)
  `<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf>` +
  `<xf numFmtId="0" fontId="0" fillId="3" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf>` +
  `<xf numFmtId="165" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf>` +
  `<xf numFmtId="165" fontId="0" fillId="3" borderId="1" xfId="0" applyNumberFormat="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf>` +
  `<xf numFmtId="3" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf>` +
  `<xf numFmtId="3" fontId="0" fillId="3" borderId="1" xfId="0" applyNumberFormat="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf>` +
  `<xf numFmtId="4" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf>` +
  `<xf numFmtId="4" fontId="0" fillId="3" borderId="1" xfId="0" applyNumberFormat="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf>` +
  `<xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>` +
  `<xf numFmtId="164" fontId="0" fillId="3" borderId="1" xfId="0" applyNumberFormat="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>` +
  // 14-15 long text, wrapped
  `<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>` +
  `<xf numFmtId="0" fontId="0" fillId="3" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>` +
  // 16 totals label, 17 money, 18 number, 19 integer
  `<xf numFmtId="0" fontId="4" fillId="4" borderId="2" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf>` +
  `<xf numFmtId="4" fontId="4" fillId="4" borderId="2" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf>` +
  `<xf numFmtId="165" fontId="4" fillId="4" borderId="2" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf>` +
  `<xf numFmtId="3" fontId="4" fillId="4" borderId="2" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf>` +
  `</cellXfs>` +
  `<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>` +
  `</styleSheet>`;

/** Excel's sheet-name rules: at most 31 characters, none of : \ / ? * [ ], unique within the workbook. */
export function sheetName(name: string, taken: Set<string> = new Set()): string {
  const base =
    name
      .replace(/[:\\/?*[\]]/g, " ")
      .trim()
      .slice(0, 31) || "Sheet";
  let out = base;
  for (let n = 2; taken.has(out.toLowerCase()); n++)
    out = `${base.slice(0, 31 - `${n}`.length - 1)} ${n}`;
  taken.add(out.toLowerCase());
  return out;
}

export function buildXlsx(sheets: XlsxSheet[]): Uint8Array {
  if (!sheets.length) throw new Error("A workbook needs at least one sheet");
  const encode = (s: string) => new TextEncoder().encode(s);
  const taken = new Set<string>();
  const built = sheets.map((sheet) => ({ ...sheetXml(sheet), name: sheetName(sheet.name, taken) }));
  const workbook =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
    `<bookViews><workbookView/></bookViews><sheets>` +
    built
      .map((s, i) => `<sheet name="${xml(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
      .join("") +
    `</sheets><definedNames>` +
    built
      .map((s, i) => {
        const [from, to] = s.filterRef.split(":");
        const abs = (ref: string) => ref.replace(/^([A-Z]+)(\d+)$/, "$$$1$$$2");
        return `<definedName name="_xlnm._FilterDatabase" localSheetId="${i}" hidden="1">'${xml(s.name).replace(/'/g, "''")}'!${abs(from!)}:${abs(to!)}</definedName>`;
      })
      .join("") +
    `</definedNames></workbook>`;
  const workbookRels =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    built
      .map(
        (_, i) =>
          `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`,
      )
      .join("") +
    `<Relationship Id="rId${built.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
    `</Relationships>`;
  const contentTypes =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
    `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
    `<Default Extension="xml" ContentType="application/xml"/>` +
    `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
    built
      .map(
        (_, i) =>
          `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
      )
      .join("") +
    `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>` +
    `</Types>`;
  const rootRels =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>` +
    `</Relationships>`;
  return zip([
    { name: "[Content_Types].xml", data: encode(contentTypes) },
    { name: "_rels/.rels", data: encode(rootRels) },
    { name: "xl/workbook.xml", data: encode(workbook) },
    { name: "xl/_rels/workbook.xml.rels", data: encode(workbookRels) },
    { name: "xl/styles.xml", data: encode(STYLES) },
    ...built.map((s, i) => ({ name: `xl/worksheets/sheet${i + 1}.xml`, data: encode(s.xml) })),
  ]);
}
