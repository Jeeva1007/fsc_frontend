// Dates travel through the app as "yyyy-mm-dd" strings (same as <input type="date">).
const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Parses "yyyy-mm-dd" as a local calendar date; returns undefined for blank or impossible dates. */
export function parseIsoDate(value: string | undefined): Date | undefined {
  const m = ISO.exec(value ?? "");
  if (!m) return undefined;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(y, mo - 1, d);
  return date.getFullYear() === y && date.getMonth() === mo - 1 && date.getDate() === d
    ? date
    : undefined;
}

export function toIsoDate(date: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
}

/** "30 Oct 2026" */
export function displayDate(date: Date): string {
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}
