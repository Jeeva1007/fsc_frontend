import { statuses, type Shipment } from "./fsc";
import type { ShipperAccountStatementResponse } from "@/types/api";

/**
 * The Shipper dashboard's figures (user request, 2026-11-16), worked out from the shipper's own shipment
 * rows and their account statement. Pure, so the screen only draws what this returns.
 */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAY = 86_400_000;
/** Money to the cent, so float leftovers (1e-10) never read as a balance or flip its sign. */
const cents = (n: number) => Math.round(n * 100) / 100;

/** A date as a UTC day: "2026-11-26" (the server) or "29/May/26" (older rows). Shared by the dashboards. */
export function parseDay(value: string | undefined): number | undefined {
  const text = (value ?? "").trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(text);
  if (iso) return Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  const short = /^(\d{1,2})\/([A-Za-z]{3})\/(\d{2,4})$/.exec(text);
  if (!short) return undefined;
  const month = MONTHS.findIndex((m) => m.toLowerCase() === short[2]!.toLowerCase());
  if (month < 0) return undefined;
  const year = Number(short[3]) < 100 ? 2000 + Number(short[3]) : Number(short[3]);
  return Date.UTC(year, month, Number(short[1]));
}

const isDelivered = (s: Shipment) => s.status === "Delivered";
const isReady = (s: Shipment) => s.status.toLowerCase() === "ready for delivery";

export type MonthBar = { key: string; label: string; delivered: number; inProgress: number };
export type StatusCount = { status: string; count: number };
export type Arrival = { shipment: Shipment; day: number; inDays: number };
export type AccountSplit = {
  /** AGV charged on the shipper's containers. */
  charges: number;
  gsm: number;
  tpt: number;
  ox: number;
  /** Still to be paid to the shipper; below 0 when more was paid than charged. */
  balance: number;
  /** True when the figures came from the server's statement, not from the shipment rows. */
  fromStatement: boolean;
};

/**
 * Shipments per ETA month, `months` long, ending `ahead` months after today's month so arrivals still to
 * come are shown. Rows without a readable ETA are left out of the chart only.
 */
export function monthlyShipments(rows: Shipment[], today: number, months: number, ahead = 2) {
  const now = new Date(today);
  const bars: MonthBar[] = [];
  for (let i = months - 1 - ahead; i >= -ahead; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const year = d.getUTCFullYear();
    const month = d.getUTCMonth();
    bars.push({
      key: `${year}-${month}`,
      label: `${MONTHS[month]} ${String(year).slice(2)}`,
      delivered: 0,
      inProgress: 0,
    });
  }
  for (const s of rows) {
    const day = parseDay(s.eta);
    if (day === undefined) continue;
    const d = new Date(day);
    const bar = bars.find((b) => b.key === `${d.getUTCFullYear()}-${d.getUTCMonth()}`);
    if (!bar) continue;
    if (isDelivered(s)) bar.delivered++;
    else bar.inProgress++;
  }
  return bars;
}

/** Shipments per status in workflow order; statuses outside the list follow, and empty ones are dropped. */
export function statusCounts(rows: Shipment[]): StatusCount[] {
  const counts = new Map<string, number>();
  for (const s of rows) {
    const status = s.status || "Shipment created";
    counts.set(status, (counts.get(status) ?? 0) + 1);
  }
  const known = statuses
    .filter((st) => counts.has(st))
    .map((st) => ({ status: st, count: counts.get(st)! }));
  const other = [...counts.entries()]
    .filter(([st]) => !statuses.includes(st))
    .map(([status, count]) => ({ status, count }));
  return [...known, ...other];
}

/** Active shipments arriving from today on, soonest first. */
export function upcomingArrivals(rows: Shipment[], today: number, limit = 5): Arrival[] {
  return rows
    .filter((s) => !isDelivered(s))
    .map((shipment) => ({ shipment, day: parseDay(shipment.eta) }))
    .filter((a): a is { shipment: Shipment; day: number } => a.day !== undefined && a.day >= today)
    .sort((a, b) => a.day - b.day)
    .slice(0, limit)
    .map((a) => ({ ...a, inDays: Math.round((a.day - today) / DAY) }));
}

/** The four headline figures. */
export function shipperKpis(rows: Shipment[], today: number) {
  const active = rows.filter((s) => !isDelivered(s));
  return {
    active: active.length,
    total: rows.length,
    arrivingThisWeek: active.filter((s) => {
      const day = parseDay(s.eta);
      return day !== undefined && day >= today && day < today + 7 * DAY;
    }).length,
    ready: active.filter(isReady).length,
  };
}

/**
 * Where the shipper's money stands: AGV charged, split into what was paid (GSM, TPT, direct OX) and the
 * balance still to be paid. The server's statement is used when it has loaded; until then the shipment
 * rows give the same split.
 */
export function accountSplit(
  rows: Shipment[],
  statement: ShipperAccountStatementResponse | undefined,
): AccountSplit {
  const sum = statement?.summary;
  if (sum && (sum.totalCharges !== undefined || sum.totalPaid !== undefined)) {
    const charges = sum.totalCharges ?? 0;
    const gsm = sum.totalGsm ?? 0;
    const tpt = sum.totalTpt ?? 0;
    const ox = sum.totalOxDirect ?? 0;
    const balance = statement?.closingBalance?.amount ?? sum.balance ?? charges - (gsm + tpt + ox);
    return { charges, gsm, tpt, ox, balance: cents(balance), fromStatement: true };
  }
  const n = (v: string | undefined) => Number(v) || 0;
  const charges = rows.reduce((t, s) => t + n(s.agv), 0);
  const gsm = rows.reduce((t, s) => t + n(s.gsm), 0);
  const tpt = rows.reduce((t, s) => t + n(s.tptReserved ?? s.tp), 0);
  const ox = rows.reduce((t, s) => t + n(s.oxDirectPaid), 0);
  return {
    charges: cents(charges),
    gsm: cents(gsm),
    tpt: cents(tpt),
    ox: cents(ox),
    balance: cents(charges - (gsm + tpt + ox)),
    fromStatement: false,
  };
}
