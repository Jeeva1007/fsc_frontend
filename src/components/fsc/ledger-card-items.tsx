import type { ReactNode } from "react";
import {
  ArrowDownLeft,
  ArrowLeftRight,
  Container,
  HandCoins,
  Hourglass,
  Receipt,
  Scale,
  Ship,
  ShoppingCart,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { money } from "@/lib/fsc";
import type { GsmOxLedgerCardsResponse } from "@/types/api";
import type { LedgerCardItem, LedgerCardTone } from "./ledger-cards";

/** The icon for a ledger card, chosen by its label; a wallet for anything not listed. */
const ICONS: [RegExp, ReactNode][] = [
  [/total purchase/i, <ShoppingCart key="i" />],
  [/paid to shippers/i, <HandCoins key="i" />],
  [/due to shippers/i, <Hourglass key="i" />],
  [/due from ox/i, <ArrowDownLeft key="i" />],
  [/margin/i, <TrendingUp key="i" />],
  [/containers charged|agv/i, <Receipt key="i" />],
  [/shipments|containers/i, <Ship key="i" />],
  [/transfer|tpt/i, <ArrowLeftRight key="i" />],
  [/closing balance|balance/i, <Scale key="i" />],
  [/gsm/i, <Wallet key="i" />],
];
const iconFor = (label: string): ReactNode =>
  ICONS.find(([re]) => re.test(label))?.[1] ?? <Container />;

/** An existing stat's tone ("", "primary", "warning", "success", "destructive") as a card tone. */
const toneFor = (tone: string | undefined): LedgerCardTone =>
  tone === "warning"
    ? "warning"
    : tone === "success"
      ? "success"
      : tone === "destructive"
        ? "danger"
        : "primary";

/** The deal / Rob ledger stats ({ label, value (money), sub, tone }) as cards. */
export const statCards = (
  stats: {
    label: string;
    value: number | null;
    sub?: string | undefined;
    tone?: string | undefined;
  }[],
): LedgerCardItem[] =>
  stats.map((s) => ({
    label: s.label,
    // null = the figure has not loaded (or could not): a dash, never a made-up number.
    value: s.value === null ? "—" : money(s.value),
    ...(s.sub ? { sub: s.sub } : {}),
    icon: iconFor(s.label),
    tone: toneFor(s.tone),
  }));

const plural = (n: number, one: string) => `${n} ${n === 1 ? one : `${one}s`}`;

/**
 * The GSM - OX Deal Ledger's four cards from GET /gsmOxLedger/cards (the GSM margin card and the notes
 * under Paid to / Due to shippers and Due from OX were removed at the user's request, 2026-11-13), for both the Owner's and the
 * Accountant's screen. Until the reply has loaded (or if it failed) each figure shows a dash.
 */
export function dealLedgerStats(cards: GsmOxLedgerCardsResponse | undefined) {
  const n = (v: number | undefined) => (typeof v === "number" && Number.isFinite(v) ? v : null);
  const deals = cards?.dealCount;
  const containers = cards?.containerCount;
  return [
    {
      label: "Total purchase",
      value: n(cards?.totalPurchase),
      sub:
        deals !== undefined || containers !== undefined
          ? `${plural(deals ?? 0, "deal")} · ${plural(containers ?? 0, "container")}`
          : "Deals and containers",
      tone: "",
    },
    {
      label: "Paid to shippers",
      value: n(cards?.paidToShippers),
      tone: "warning",
    },
    {
      label: "Due to shippers",
      value: n(cards?.dueToShippers),
      tone: "warning",
    },
    {
      label: "Due from OX",
      value: n(cards?.dueFromOx),
      tone: "primary",
    },
  ];
}
