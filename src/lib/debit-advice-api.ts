import { uid } from "@/lib/id";
import type {
  GsmOxLedgerLineRequest,
  GsmOxLedgerLineResponse,
  GsmOxLedgerRequest,
  GsmOxLedgerResponse,
} from "@/types/api";
import { isUuid } from "./shipment-create";
import {
  blankBeLine,
  blankDebitAdvice,
  CONTAINER_TEXT_MAX,
  containerListText,
  parseContainerList,
  shownOrmBe,
  shownPaymentStatus,
  type BeLine,
  type DebitAdvice,
} from "./debit-advice";

/**
 * Maps the Debit Advice model (the client's GSM-OX sheet) to the backend's `GsmOxLedgerRequest`
 * (POST /gsmOxLedger/createLedger, PUT /gsmOxLedger/updateLedger). Amounts are parsed from the typed
 * strings (commas stripped); blank/invalid values are left out so the server keeps its own defaults.
 * `id` is sent only when it is a real server UUID, so a hardcoded sheet row saves as a new entry.
 */

const num = (s?: string) => {
  const v = (s ?? "").replace(/,/g, "").trim();
  const n = Number(v);
  return v !== "" && Number.isFinite(n) ? n : undefined;
};
const intg = (s?: string) => {
  const n = num(s);
  return n === undefined ? undefined : Math.trunc(n);
};
const str = (s: string | undefined, max: number) => {
  const v = (s ?? "").trim();
  return v ? v.slice(0, max) : undefined;
};
const date = (s?: string) => {
  const v = (s ?? "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined;
};
const prune = <T>(o: Record<string, unknown>): T =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;

function toLine(l: BeLine, forUpdate: boolean): GsmOxLedgerLineRequest {
  return prune<GsmOxLedgerLineRequest>({
    // On create the backend generates every id, so send none; on update keep the server's id + rowVersion.
    ...(forUpdate && isUuid(l.id) ? { id: l.id } : {}),
    ...(forUpdate && typeof l.rowVersion === "number" ? { rowVersion: l.rowVersion } : {}),
    blNo: str(l.blNo, 40),
    customsPortCode: str(l.portCode, 10),
    // One number per line in the app; the backend keeps "A : B" (validated to fit 300 characters).
    containerNumbers: str(containerListText(l.containerNo), CONTAINER_TEXT_MAX),
    beNo: str(l.beNo, 30),
    beDate: date(l.beDate),
    beCurrencyCode: str(l.beCurr, 3),
    beValue: num(l.beValue),
    ref: str(l.ref, 150),
    invoiceNo: str(l.invNo, 40),
    party: str(l.party, 150),
    fruit: str(l.fruit, 80),
    noOfCartons: intg(l.cartons),
    netWeight: num(l.netWeight),
    noOfContainers: intg(l.ctrCount),
    beClosureStatus: str(l.closure, 40),
    shipperName: str(l.tpt, 150),
    fwToTptPaidOn: date(l.paidOn),
    fwToTptCurrencyCode: str(l.paidCurr, 3),
    fwToTptCurrencyValue: num(l.paidValue),
    dutyPaidBe: num(l.dutyPaid),
  });
}

export function toGsmOxLedgerRequest(a: DebitAdvice, forUpdate = false): GsmOxLedgerRequest {
  const first = a.tranches[0];
  // The header carries one set of currency figures: the typed Reconciliation value wins, else the first
  // tranche; the INR amount is the typed Reconciliation amount, else the sum of all tranche amounts.
  const amountInr =
    num(a.reconciliation?.amount) ??
    (a.tranches.reduce((s, t) => s + (num(t.amount) ?? 0), 0) || undefined);
  const ormBe = shownOrmBe(a);
  return prune<GsmOxLedgerRequest>({
    // Create: no id (the backend auto-generates it). Update: send the server UUID + rowVersion so it edits
    // in place and the optimistic lock holds.
    ...(forUpdate && isUuid(a.id) ? { id: a.id } : {}),
    ...(forUpdate && typeof a.rowVersion === "number" ? { rowVersion: a.rowVersion } : {}),
    entryDate: date(a.date),
    partyName: str(a.partyName, 150),
    currencyCode: str(a.curr, 3),
    tolRefNo: str(a.tolRef, 40),
    billOrOrmNo: str(a.billNo, 40),
    containerReference: str(a.reference, 500),
    currencyValue: num(a.reconciliation?.value) ?? num(first?.value),
    inrRate: num(first?.rate),
    amountInr,
    ormMinusBe: ormBe ?? undefined,
    paymentStatus: str(shownPaymentStatus(a), 300),
    matchedTo: str(a.matchedTo, 60),
    lines: a.lines.map((l) => toLine(l, forUpdate)),
  });
}

// ---------------------------------------------------------------------------
// GET /gsmOxLedger/ledgerList item -> the Debit Advice model the register shows.
// Carries the server id + rowVersion so a later edit updates in place and keeps the optimistic lock.
// ---------------------------------------------------------------------------
const s = (v: unknown) => (v === null || v === undefined ? "" : String(v));

function fromLine(r: GsmOxLedgerLineResponse): BeLine {
  return {
    ...blankBeLine(),
    ...(r.id ? { id: r.id } : {}),
    ...(typeof r.rowVersion === "number" ? { rowVersion: r.rowVersion } : {}),
    blNo: s(r.blNo),
    portCode: s(r.customsPortCode),
    containerNo: parseContainerList(s(r.containerNumbers)),
    beNo: s(r.beNo),
    beDate: s(r.beDate),
    beCurr: s(r.beCurrencyCode),
    beValue: s(r.beValue),
    ref: s(r.ref),
    invNo: s(r.invoiceNo),
    party: s(r.party),
    tpt: s(r.shipperName),
    cartons: s(r.noOfCartons),
    netWeight: s(r.netWeight),
    paidValue: s(r.fwToTptCurrencyValue),
    paidCurr: s(r.fwToTptCurrencyCode),
    paidOn: s(r.fwToTptPaidOn),
    ctrCount: s(r.noOfContainers),
    fruit: s(r.fruit),
    closure: s(r.beClosureStatus),
    dutyPaid: s(r.dutyPaidBe),
  };
}

export function fromGsmOxLedgerResponse(r: GsmOxLedgerResponse): DebitAdvice {
  const base = blankDebitAdvice();
  return {
    ...base,
    ...(r.id ? { id: r.id } : {}),
    ...(typeof r.rowVersion === "number" ? { rowVersion: r.rowVersion } : {}),
    date: s(r.entryDate),
    partyName: s(r.partyName),
    reference: s(r.containerReference),
    tolRef: s(r.tolRefNo),
    billNo: s(r.billOrOrmNo),
    curr: s(r.currencyCode),
    matchedTo: s(r.matchedTo),
    tranches: [
      {
        id: uid(),
        value: s(r.currencyValue),
        rate: s(r.inrRate),
        amount: s(r.amountInr),
      },
    ],
    lines: (r.lines ?? []).map(fromLine),
    reconciliation: {
      value: s(r.currencyValue),
      amount: s(r.amountInr),
      beValue: "",
      ormBe: s(r.ormMinusBe),
      status: s(r.paymentStatus),
    },
  };
}
