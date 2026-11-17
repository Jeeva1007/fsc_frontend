import {
  CLOSURE_STATUSES,
  PAYMENT_STATUSES,
  adviceValue,
  shownPaymentStatus,
} from "./debit-advice";
import type { DebitAdvice } from "./debit-advice";
import { parseDay } from "./shipper-dashboard";

/**
 * The Accountant dashboard's figures (user request, 2026-11-16), worked out from the GSM - OX Deal
 * Ledger entries (debit advices). Pure, so the screen only draws what this returns. The headline totals
 * come from the server's ledger cards instead; these cover the entries the dashboard has loaded.
 */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const num = (v: string | undefined) => Number(v) || 0;
const cents = (n: number) => Math.round(n * 100) / 100;

export type PaidMonth = { key: string; label: string; paid: number; lines: number };
export type Ranked = { name: string; amount: number };
export type Count = { label: string; count: number };

/** The currency most paid amounts are in (USD on the client's sheet); the chart and totals use it. */
export function mainCurrency(advices: DebitAdvice[]): string {
  const counts = new Map<string, number>();
  for (const a of advices)
    for (const l of a.lines) {
      const c = (l.paidCurr || a.curr || "").trim().toUpperCase();
      if (c && num(l.paidValue)) counts.set(c, (counts.get(c) ?? 0) + 1);
    }
  return [...counts.entries()].sort((x, y) => y[1] - x[1])[0]?.[0] ?? "USD";
}

/** Each BE line's paid amount in `currency`, with the day it was paid (the advice date if none). */
function paidLines(advices: DebitAdvice[], currency: string) {
  return advices.flatMap((a) =>
    a.lines
      .filter(
        (l) => num(l.paidValue) && (l.paidCurr || a.curr || currency).toUpperCase() === currency,
      )
      .map((l) => ({
        line: l,
        amount: num(l.paidValue),
        day: parseDay(l.paidOn) ?? parseDay(a.date),
      })),
  );
}

/** Paid to shippers per month, `months` long, ending with today's month. */
export function paidByMonth(
  advices: DebitAdvice[],
  currency: string,
  today: number,
  months: number,
) {
  const now = new Date(today);
  const bars: PaidMonth[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    bars.push({
      key: `${d.getUTCFullYear()}-${d.getUTCMonth()}`,
      label: `${MONTHS[d.getUTCMonth()]} ${String(d.getUTCFullYear()).slice(2)}`,
      paid: 0,
      lines: 0,
    });
  }
  for (const p of paidLines(advices, currency)) {
    if (p.day === undefined) continue;
    const d = new Date(p.day);
    const bar = bars.find((b) => b.key === `${d.getUTCFullYear()}-${d.getUTCMonth()}`);
    if (!bar) continue;
    bar.paid = cents(bar.paid + p.amount);
    bar.lines++;
  }
  return bars;
}

/** Paid per shipper (a BE line's Shipper), largest first; past `top`, the rest fold into "Other". */
export function paidByShipper(advices: DebitAdvice[], currency: string, top = 6): Ranked[] {
  const totals = new Map<string, number>();
  for (const p of paidLines(advices, currency)) {
    const name = p.line.tpt.trim() || "Not set";
    totals.set(name, (totals.get(name) ?? 0) + p.amount);
  }
  const ranked = [...totals.entries()]
    .map(([name, amount]) => ({ name, amount: cents(amount) }))
    .sort((a, b) => b.amount - a.amount);
  if (ranked.length <= top) return ranked;
  const rest = ranked.slice(top - 1);
  return [
    ...ranked.slice(0, top - 1),
    { name: `Other (${rest.length})`, amount: cents(rest.reduce((t, r) => t + r.amount, 0)) },
  ];
}

/** Entries per Payment Status, in the form's order; entries with none show as "Not worked out". */
export function paymentStatusCounts(advices: DebitAdvice[]): Count[] {
  const counts = new Map<string, number>();
  for (const a of advices) {
    const s = shownPaymentStatus(a) || "Not worked out";
    counts.set(s, (counts.get(s) ?? 0) + 1);
  }
  const order = [...PAYMENT_STATUSES, "Not worked out"];
  return [
    ...order.filter((s) => counts.has(s)).map((label) => ({ label, count: counts.get(label)! })),
    ...[...counts.entries()]
      .filter(([s]) => !order.includes(s))
      .map(([label, count]) => ({ label, count })),
  ];
}

/** BE lines per closure stage: Submitted, Settled, and those not closed yet ("Open"). */
export function closureCounts(advices: DebitAdvice[]): Count[] {
  const lines = advices.flatMap((a) => a.lines).filter((l) => l.beNo.trim() || l.blNo.trim());
  const of = (s: string) => lines.filter((l) => l.closure === s).length;
  return [
    { label: "Open", count: lines.filter((l) => !CLOSURE_STATUSES.includes(l.closure)).length },
    ...CLOSURE_STATUSES.map((s) => ({ label: s, count: of(s) })),
  ];
}

/** The latest entries by date (undated ones last). */
export function recentAdvices(advices: DebitAdvice[], limit = 5) {
  return [...advices]
    .map((a) => ({ advice: a, day: parseDay(a.date), value: cents(adviceValue(a)) }))
    .sort((x, y) => (y.day ?? -Infinity) - (x.day ?? -Infinity))
    .slice(0, limit);
}

/**
 * The strip above the monthly chart: the period's total and BE lines, this month, and the change from
 * last month as a percentage (null when last month had nothing to compare with).
 */
export function paidSummary(bars: PaidMonth[]) {
  const total = cents(bars.reduce((t, b) => t + b.paid, 0));
  const lines = bars.reduce((t, b) => t + b.lines, 0);
  const current = bars[bars.length - 1]?.paid ?? 0;
  const previous = bars[bars.length - 2]?.paid ?? 0;
  const change = previous > 0 ? Math.round(((current - previous) / previous) * 100) : null;
  return { total, lines, current, previous, change };
}
