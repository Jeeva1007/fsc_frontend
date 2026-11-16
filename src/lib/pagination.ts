/** Page numbers to show, with "gap" where pages are skipped: 1 … 4 5 [6] 7 8 … 20 */
export function pageWindow(page: number, pages: number, siblings = 1): (number | "gap")[] {
  if (pages <= 5 + siblings * 2) return Array.from({ length: pages }, (_, i) => i + 1);
  const from = Math.max(2, page - siblings);
  const to = Math.min(pages - 1, page + siblings);
  const out: (number | "gap")[] = [1];
  if (from > 2) out.push("gap");
  for (let p = from; p <= to; p++) out.push(p);
  if (to < pages - 1) out.push("gap");
  out.push(pages);
  return out;
}
