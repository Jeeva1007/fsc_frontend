import { uid } from "@/lib/id";
import type { XlsxColumn, XlsxColumnType } from "./xlsx";
import * as yup from "yup";
import { validateForm, type FieldErrors } from "./login-schema";
import { entryTypes } from "./fsc";
import type { LedgerEntry } from "./fsc-finance";

/**
 * The client's Debit Advice sheet as data. One advice (a bank debit) can arrive in several tranches at
 * different rates and settle several BEs, which the sheet shows with merged cells. Either side can be
 * missing: a balance payment has no BE, and a TPT payment can come before its advice.
 */
export type DebitTranche = { id: string; value: string; rate: string; amount: string };
export type BeLine = {
  id: string;
  /** The server's optimistic-lock version for this line, when it came from GET ledgerList. */
  rowVersion?: number;
  blNo: string;
  portCode: string;
  beNo: string;
  beDate: string;
  beCurr: string;
  beValue: string;
  /** Left blank, INR Value is Ass. Value + 50% Duty paid, as the sheet works it out. */
  inrValue: string;
  ref: string;
  invNo: string;
  party: string;
  tpt: string;
  cartons: string;
  netWeight: string;
  paidValue: string;
  paidCurr: string;
  paidOn: string;
  containerNo: string;
  ctrCount: string;
  fruit: string;
  closure: string;
  /** The date it was submitted or settled, and that step's reference. Both follow `closure`. */
  closureDate: string;
  closureRef: string;
  invValue: string;
  assValue: string;
  dutyPaid: string;
  /** Duty check's Enhancement amount checkbox, and the amount typed once it is ticked (2026-11-16). */
  hasEnhancement?: boolean;
  enhancementAmount: string;
  route: string;
  eta: string;
  agv: string;
  notes: string;
};
export type DebitAdvice = {
  id: string;
  /** The server's optimistic-lock version, when it came from GET ledgerList; sent back on update. */
  rowVersion?: number;
  date: string;
  partyName: string;
  reference: string;
  tolRef: string;
  billNo: string;
  curr: string;
  matchedTo: string;
  tranches: DebitTranche[];
  lines: BeLine[];
  /** Entered on this screen, not from the sheet. These list first in the table. */
  added?: boolean;
  /** Typed in the form's Reconciliation section; the sheet rows have none. See `shownOrmBe`. */
  reconciliation?: Reconciliation;
};

/** The Reconciliation section's figures, typed by the user rather than worked out (user request, 2026-11-10). */
export type Reconciliation = {
  value: string;
  amount: string;
  beValue: string;
  ormBe: string;
  status: string;
};
export const blankReconciliation = (): Reconciliation => ({
  value: "",
  amount: "",
  beValue: "",
  ormBe: "",
  status: "",
});

/** The values the client's sheet uses. Each list also accepts a new value. */
export const PARTY_NAMES = ["GSM", "Big Apple Farms"];
export const BE_PARTIES = ["GSM Sarl", "Big Apple Farms"];
export const PORT_CODES = ["INNSA1", "INMAA1", "INENR1", "INCCU1", "INPJN6"];
export const TPT_NAMES = [
  "The Fresh Connection",
  "Waipawa",
  "RD8",
  "Agrifood B.V",
  "Bostock",
  "Direct to Big Apple",
  "Abdullah Sekar Fruit",
  "Erikci Gida Ltd STI",
  "Ayco Global Tarim Ltd",
  "Anafruit Gida Sanayi ve Ticare",
  "IMPALA INTERNATIONAL FZCO",
];
/** The Fruit dropdown of a BE line (user request, 2026-11-16); an older typed fruit still shows on edit. */
export const FRUITS = ["Apples", "Grapes"];
export const CLOSURE_STATUSES = ["Submitted", "Settled"];
export const PAYMENT_STATUSES = ["Matched", "More paid from OX", "Less paid from OX"];

export const blankTranche = (): DebitTranche => ({
  id: uid(),
  value: "",
  rate: "",
  amount: "",
});
export const blankBeLine = (): BeLine => ({
  id: uid(),
  blNo: "",
  portCode: "",
  beNo: "",
  beDate: "",
  beCurr: "",
  beValue: "",
  inrValue: "",
  ref: "",
  invNo: "",
  party: "",
  tpt: "",
  cartons: "",
  netWeight: "",
  paidValue: "",
  paidCurr: "",
  paidOn: "",
  containerNo: "",
  ctrCount: "",
  fruit: "",
  closure: "",
  closureDate: "",
  closureRef: "",
  invValue: "",
  assValue: "",
  dutyPaid: "",
  enhancementAmount: "",
  route: "",
  eta: "",
  agv: "",
  notes: "",
});
export const blankDebitAdvice = (): DebitAdvice => ({
  id: uid(),
  date: "",
  partyName: "",
  reference: "",
  tolRef: "",
  billNo: "",
  curr: "",
  matchedTo: "",
  tranches: [blankTranche()],
  lines: [blankBeLine()],
  reconciliation: blankReconciliation(),
});
/** The Payment Status a new entry starts with (user request, 2026-11-13); the user can pick another. */
export const DEFAULT_PAYMENT_STATUS = "More paid from OX";
/** The currency new entries and new BE lines start with (user request, 2026-11-16); the user can pick another. */
export const DEFAULT_CURRENCY = "USD";
/** A new BE line: blank, with BE Currency and Paid Currency preset to USD. Server rows use blankBeLine. */
export const newBeLine = (): BeLine => ({
  ...blankBeLine(),
  beCurr: DEFAULT_CURRENCY,
  paidCurr: DEFAULT_CURRENCY,
});
/**
 * A new entry for the Add Ledger Entry form: blank, with Payment Status preset to "More paid from OX" and
 * every currency preset to USD. Only for new entries — server rows and edits keep their own values (they
 * start from blankDebitAdvice).
 */
export const newDebitAdvice = (): DebitAdvice => ({
  ...blankDebitAdvice(),
  curr: DEFAULT_CURRENCY,
  lines: [newBeLine()],
  reconciliation: { ...blankReconciliation(), status: DEFAULT_PAYMENT_STATUS },
});

const num = (v: string) => Number(v) || 0;
const round2 = (n: number) => Math.round(n * 100) / 100;
const sum = <T>(items: T[], pick: (item: T) => number) =>
  round2(items.reduce((total, item) => total + pick(item), 0));

/** AMOUNT is typed by the user (client request), not worked out from Currency Value and INR. */
export const trancheAmount = (t: DebitTranche) => num(t.amount);
export const adviceValue = (a: DebitAdvice) => sum(a.tranches, (t) => num(t.value));
export const adviceAmount = (a: DebitAdvice) => sum(a.tranches, trancheAmount);
export const adviceBeValue = (a: DebitAdvice) => sum(a.lines, (l) => num(l.beValue));
export const advicePaidToTpt = (a: DebitAdvice) => sum(a.lines, (l) => num(l.paidValue));

/** ORM - BE: what the advice brought in less the BEs it settles. Needs both sides, like the sheet. */
export function ormBe(a: DebitAdvice): number | null {
  const paid = a.tranches.some((t) => num(t.value) > 0);
  const billed = a.lines.some((l) => num(l.beValue) > 0);
  return paid && billed ? round2(adviceValue(a) - adviceBeValue(a)) : null;
}
/** Differences under 1 are rounding: the sheet leaves 0.01 and -0.02 unlabelled. */
export function paymentStatus(a: DebitAdvice): string {
  const diff = ormBe(a);
  if (diff === null) return "";
  if (Math.abs(diff) < 1) return "Matched";
  return diff > 0 ? "More paid from OX" : "Less paid from OX";
}

/** ORM - BE as the table shows it: the typed figure when one was entered, otherwise worked out. */
export function shownOrmBe(a: DebitAdvice): number | null {
  const typed = a.reconciliation?.ormBe.trim();
  return typed ? round2(num(typed)) : ormBe(a);
}
/** Payment Status as the table shows it: the chosen status when one was entered, otherwise worked out. */
export const shownPaymentStatus = (a: DebitAdvice) => a.reconciliation?.status || paymentStatus(a);

/** Every ORM/BE reference an advice carries, lower-cased, for matching one entry to another. */
const adviceRefs = (a: DebitAdvice): string[] =>
  [a.billNo, a.tolRef, a.reference, ...a.lines.flatMap((l) => [l.beNo, l.ref, l.invNo, l.blNo])]
    .map((s) => (s || "").trim().toLowerCase())
    .filter(Boolean);
// Split `matchedTo` only on list separators (comma/semicolon/pipe/newline), never on "/" or ":" which are
// part of ORM/invoice references like "OX/2026/023".
const matchTokens = (a: DebitAdvice): string[] =>
  (a.matchedTo || "")
    .split(/[,;|\n]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
// A token matches a reference on equality, or a substring match when both are long enough to be meaningful
// (so short fragments like "gj" can't link unrelated rows).
const refMatches = (t: string, r: string) =>
  t === r || (Math.min(t.length, r.length) >= 5 && (t.includes(r) || r.includes(t)));
/**
 * The other entries this one is matched with: those whose ORM/BE references appear in this entry's
 * `matchedTo`, or that name any of this entry's references in their own `matchedTo` (either direction).
 */
export function matchedAdvices(a: DebitAdvice, all: DebitAdvice[]): DebitAdvice[] {
  const myTokens = matchTokens(a);
  const myRefs = adviceRefs(a);
  const hit = (tokens: string[], refs: string[]) =>
    tokens.some((t) => refs.some((r) => refMatches(t, r)));
  return all.filter(
    (x) => x.id !== a.id && (hit(myTokens, adviceRefs(x)) || hit(matchTokens(x), myRefs)),
  );
}

/**
 * Reads the form's "Matched to (BE or ORM No.)" text into a matchedEntries search: `{ searchType, number }`,
 * where `number` is only the number ("BE No.9158743" -> BE / "9158743").
 * - A BE / B.E. / ORM keyword anywhere decides the type: "BE No.9158743", "B.E. No. 9158743", "BENo.9158743",
 *   "BE NO. :- 9158743", "Matched to BE No.9158743", "9158743 (BE)", "ORM No: OX/2026/023".
 * - BE: the digits right after the keyword (else the first run of digits in the text); BE Nos. are numeric,
 *   so trailing words/dates are dropped ("BE No.9158743 dt 12/03/2026" -> 9158743).
 * - ORM: the reference right after the keyword (letters, digits, "/", "-"), e.g. OX/2026/023.
 * - No keyword: a number that starts with digits is a BE No.; anything else is an ORM No.
 * Only the first item of a list ("A, B") is used. Returns null when no number is found.
 */
export function parseMatchedTo(text: string): { searchType: "BE" | "ORM"; number: string } | null {
  const first = (text || "").split(/[,;|\r\n]+/)[0]?.trim() ?? "";
  if (!first) return null;
  const ref = /^[A-Za-z0-9][A-Za-z0-9/-]*/;
  const digits = (s: string) => /\d+/.exec(s)?.[0] ?? "";
  // The keyword must stand alone: not inside a word like "BENIN" or "FORMAT".
  const kw = /(?:^|[^A-Za-z])(B\s?\.?\s?E|ORM)\.?(?=$|[^A-Za-z]|no\b|no\.|no\d|number)/i.exec(
    first,
  );
  if (kw) {
    const type: "BE" | "ORM" = /^b/i.test(kw[1] ?? "") ? "BE" : "ORM";
    const rest = first
      .slice(kw.index + kw[0].length)
      .replace(/^[\s.:#\-–—)(]*(?:no|number)?[\s.:#\-–—)(]*/i, "");
    const number =
      type === "BE"
        ? (/^\d+/.exec(rest)?.[0] ?? digits(first))
        : (ref.exec(rest)?.[0] ?? ref.exec(first)?.[0] ?? "");
    return number ? { searchType: type, number } : null;
  }
  const lead = /^\d+(?![A-Za-z\d])/.exec(first)?.[0];
  if (lead) return { searchType: "BE", number: lead };
  const orm = ref.exec(first)?.[0];
  return orm ? { searchType: "ORM", number: orm } : null;
}

/**
 * Placeholder rows for the matched-entries popup when nothing on the current page matches, so the user
 * still sees the layout. Built to resemble the clicked entry; clearly flagged as sample data on screen.
 */
export function sampleMatchedAdvices(a: DebitAdvice): DebitAdvice[] {
  const ref = (a.matchedTo || "OX/2026/000").trim();
  const party = a.partyName || "GSM";
  const build = (n: number, invNo: string, beNo: string): DebitAdvice => ({
    ...blankDebitAdvice(),
    id: `sample-${n}`,
    date: a.date || "2026-04-01",
    partyName: party,
    reference: ref,
    tolRef: `OR01${String(100000 + n * 137).slice(0, 6)}26`,
    billNo: `6027NSMI00${String(1000 + n).slice(-4)}27`,
    curr: "USD",
    matchedTo: a.billNo || a.tolRef || "",
    tranches: [{ id: `st${n}`, value: "22932", rate: "93.31", amount: "2139784.92" }],
    lines: [
      {
        ...blankBeLine(),
        id: `sl${n}`,
        blNo: `SAMPLE${100 + n}`,
        portCode: "INNSA1",
        beNo,
        beDate: "2026-03-31",
        beCurr: "USD",
        beValue: "22932",
        ref,
        invNo,
        party: `${party} Sarl`,
        fruit: "Apples",
        cartons: "2352",
        netWeight: "41160",
        paidValue: "21168",
        paidCurr: "USD",
        paidOn: "2026-03-13",
        containerNo: "SAMPLE0000001\nSAMPLE0000002",
        ctrCount: "2",
        closure: "Settled",
        tpt: party,
        dutyPaid: "1254763",
      },
    ],
  });
  return [build(1, "OX/2026/023", "8493810"), build(2, "OX/2026/020", "8401685")];
}

export const beInrValue = (l: BeLine) =>
  l.inrValue.trim() ? num(l.inrValue) : round2(num(l.assValue) + num(l.dutyPaid));
/** The sheet's duty check columns: expected 50% duty on each value, and the gap to what the BE paid. */
export const dutyCheck = (l: BeLine) => {
  const onAss = round2(num(l.assValue) / 2);
  const onInv = round2(num(l.invValue) / 2);
  return {
    onAss,
    assDiff: round2(num(l.dutyPaid) - onAss),
    onInv,
    invDiff: round2(num(l.dutyPaid) - onInv),
  };
};

/**
 * Table order: entries added here, newest first, then the sheet's rows. Only the display changes: Sl. No. comes
 * from the position in `advices`, so moving a new entry to the top does not renumber the sheet.
 */
export const debitAdviceDisplayOrder = (advices: DebitAdvice[]) => [
  ...advices.filter((a) => a.added).reverse(),
  ...advices.filter((a) => !a.added),
];

/**
 * Which worked-out figures a line can show. The form now takes only Duty paid (BE), so a new line has no
 * Ass. or Inv. Value: without them these figures would be a misleading 0 or the duty alone.
 */
export const dutyFigures = (l: BeLine) => ({
  inr: Boolean(l.inrValue.trim() || l.assValue.trim()),
  ass: Boolean(l.assValue.trim()),
  inv: Boolean(l.invValue.trim()),
});

export const debitAdviceTotals = (advices: DebitAdvice[]) => {
  const lines = advices.flatMap((a) => a.lines);
  return {
    value: sum(advices, adviceValue),
    amount: sum(advices, adviceAmount),
    beValue: sum(advices, adviceBeValue),
    cartons: sum(lines, (l) => num(l.cartons)),
    paidToTpt: sum(advices, advicePaidToTpt),
    containers: sum(lines, (l) => num(l.ctrCount)),
    ormBe: sum(advices, (a) => shownOrmBe(a) ?? 0),
  };
};
/** The sheet's ABSTRACT block: currency value and amount per party. */
export function debitAdviceAbstract(advices: DebitAdvice[]) {
  const parties = new Map<string, { party: string; value: number; amount: number }>();
  for (const a of advices) {
    if (!a.tranches.some((t) => num(t.value) > 0)) continue;
    const party = a.partyName || "(blank)";
    const row = parties.get(party) ?? { party, value: 0, amount: 0 };
    row.value = round2(row.value + adviceValue(a));
    row.amount = round2(row.amount + adviceAmount(a));
    parties.set(party, row);
  }
  return [...parties.values()];
}

/*
 * Container breakdown (user request, 2026-11-16): one BE line can cover several containers. In the app a
 * line keeps them in `containerNo`, one number per text line, and `ctrCount` says how many. The backend has
 * one text for them (containerNumbers, <= 300 characters), written the sheet's way: "MSKU1234567 : TGHU7654321".
 */
export const CONTAINER_SEPARATOR = " : ";
/** Most container boxes one BE line shows; it keeps a mistyped count from drawing thousands of boxes. */
export const MAX_CONTAINERS = 50;
export const CONTAINER_TEXT_MAX = 300;
// What the server's text may use between numbers (older records were typed freely); "and" as a word only.
const CONTAINER_LIST_SEPARATORS = /\s*(?:[:,;/&|\n]|\band\b)\s*/i;
/** Server text -> the app's one-per-line form. */
export const parseContainerList = (text: string) =>
  text
    .split(CONTAINER_LIST_SEPARATORS)
    .map((c) => c.trim())
    .filter(Boolean)
    .join("\n");
/** The container numbers a line lists, blanks dropped. */
export const containerNumbers = (containerNo: string) =>
  containerNo
    .split("\n")
    .map((c) => c.trim())
    .filter(Boolean);
/** The line's containers as the backend and the export write them. */
export const containerListText = (containerNo: string) =>
  containerNumbers(containerNo).join(CONTAINER_SEPARATOR);
const dropTrailingBlanks = (parts: string[]) => {
  const out = [...parts];
  while (out.length && !out[out.length - 1]?.trim()) out.pop();
  return out;
};
const wholeCount = (v: string) => {
  const n = Number(v.trim());
  return v.trim() && Number.isInteger(n) && n > 0 ? n : 0;
};
/**
 * One box per container for the form: as many as Number of Containers says (up to MAX_CONTAINERS), never
 * fewer than the numbers already listed, and at least one. A blank box between numbers keeps its place.
 */
export const containerSlots = (line: Pick<BeLine, "containerNo" | "ctrCount">) => {
  const parts = dropTrailingBlanks(line.containerNo ? line.containerNo.split("\n") : []);
  const length = Math.max(Math.min(wholeCount(line.ctrCount), MAX_CONTAINERS), parts.length, 1);
  return Array.from({ length }, (_, i) => parts[i] ?? "");
};
const joinSlots = (slots: string[]) => dropTrailingBlanks(slots).join("\n");
/** Typing in one box. */
export const setContainerSlot = (line: BeLine, index: number, value: string): BeLine => {
  const slots = containerSlots(line);
  slots[index] = value.replace(/[\r\n]+/g, " ");
  return { ...line, containerNo: joinSlots(slots) };
};
/** Add Container: one more box, and one more in Number of Containers. */
export const addContainerSlot = (line: BeLine): BeLine => ({
  ...line,
  ctrCount: String(Math.min(containerSlots(line).length + 1, MAX_CONTAINERS)),
});
/** Removing a box takes its number out and lowers Number of Containers to the boxes left. */
export const removeContainerSlot = (line: BeLine, index: number): BeLine => {
  const slots = containerSlots(line).filter((_, i) => i !== index);
  return { ...line, containerNo: joinSlots(slots), ctrCount: String(slots.length) };
};
/** Before saving: numbers without blank boxes, and a count filled in when only numbers were entered. */
const tidyContainers = (l: BeLine): BeLine => {
  const numbers = containerNumbers(l.containerNo);
  return {
    ...l,
    enhancementAmount: l.hasEnhancement ? l.enhancementAmount.trim() : "",
    containerNo: numbers.join("\n"),
    ctrCount: !l.ctrCount.trim() && numbers.length ? String(numbers.length) : l.ctrCount,
  };
};
/** The Number of Containers as a usable count, or null when it is blank or not a whole number 0-50. */
const validCount = (ctrCount: string) => {
  const t = ctrCount.trim();
  const n = Number(t);
  return t && Number.isInteger(n) && n >= 0 && n <= MAX_CONTAINERS ? n : null;
};
const boxIndex = (path: string | undefined) => Number(/\[(\d+)\]$/.exec(path ?? "")?.[1] ?? -1);
const sameNumber = (a: string, b: string) => a.trim().toUpperCase() === b.trim().toUpperCase();
type ContainerContext = { count: number | null };
/**
 * yup rules for one BE line's container breakdown (user request, 2026-11-16). `boxes` are the form's boxes
 * (containerSlots), so `boxes[2]` is the box labelled "Container 3". With Number of Containers = 3, all three
 * boxes are required, and `missing` sums up how many are blank.
 */
export const containerBreakdownSchema = yup.object({
  ctrCount: yup
    .string()
    .default("")
    .test("whole", "Number of Containers must be a whole number.", (v = "") => {
      const n = Number(v.trim());
      return !v.trim() || (Number.isInteger(n) && n >= 0);
    })
    .test("max", `Number of Containers can be at most ${MAX_CONTAINERS}.`, (v = "") => {
      const n = Number(v.trim());
      return !Number.isInteger(n) || n <= MAX_CONTAINERS;
    })
    .test("not-below-listed", function (v = "") {
      const n = validCount(v);
      const listed = ((this.parent as { boxes?: string[] }).boxes ?? []).filter((b) => b.trim());
      return n === null || listed.length <= n
        ? true
        : this.createError({
            message: `${listed.length} container numbers are entered, more than the Number of Containers (${n}).`,
          });
    }),
  boxes: yup
    .array(
      yup
        .string()
        .default("")
        // The server keeps one text, so anything that reads as a separator would split the number on reload.
        .test(
          "one-per-box",
          "Enter one container number per box.",
          (v = "") => !CONTAINER_LIST_SEPARATORS.test(v.trim()),
        )
        .test("required", function (v = "") {
          const j = boxIndex(this.path);
          const { count } = (this.options.context ?? {}) as ContainerContext;
          return v.trim() || count === null || j >= count
            ? true
            : this.createError({ message: `Enter container number ${j + 1}.` });
        })
        .test("unique", function (v = "") {
          const j = boxIndex(this.path);
          const earlier = (this.parent as string[]).slice(0, Math.max(j, 0));
          return !v.trim() || !earlier.some((b) => sameNumber(b, v))
            ? true
            : this.createError({ message: `${v.trim()} is already entered in this BE line.` });
        }),
    )
    .default([])
    .test("missing", function (boxes = []) {
      const { count } = (this.options.context ?? {}) as ContainerContext;
      if (!count) return true;
      const entered = boxes.slice(0, count).filter((b) => (b ?? "").trim()).length;
      const missing = count - entered;
      if (missing <= 0) return true;
      return this.createError({
        path: "missing",
        message: `${missing} container ${missing === 1 ? "number is" : "numbers are"} missing: Number of Containers is ${count}, ${entered} entered.`,
      });
    })
    .test(
      "length",
      `Container numbers are limited to ${CONTAINER_TEXT_MAX} characters in total.`,
      (boxes = []) => containerListText(boxes.join("\n")).length <= CONTAINER_TEXT_MAX,
    ),
});
/** Runs containerBreakdownSchema on line i and adds its errors under the form's keys. */
function containerErrors(l: BeLine, i: number, errors: FieldErrors) {
  const found = validateForm(
    containerBreakdownSchema,
    { ctrCount: l.ctrCount, boxes: containerSlots(l) },
    { count: validCount(l.ctrCount) } satisfies ContainerContext,
  );
  if (!found) return;
  for (const [path, message] of Object.entries(found)) {
    const j = boxIndex(path);
    const key =
      path === "ctrCount"
        ? `line.${i}.ctrCount`
        : j >= 0
          ? `line.${i}.container.${j}`
          : `line.${i}.containerNo`; // "missing" and "boxes" (total length): shown under the boxes
    if (!errors[key]) errors[key] = message;
  }
}

// The currencies are preset to USD on new lines, so a currency alone does not count as something entered;
// container boxes left blank do not either.
const lineIsEmpty = ({
  id: _id,
  rowVersion: _rv,
  beCurr: _bc,
  paidCurr: _pc,
  containerNo,
  hasEnhancement,
  ...fields
}: BeLine) =>
  !hasEnhancement &&
  !containerNumbers(containerNo).length &&
  Object.values(fields).every((v) => !v.trim());
const trancheIsEmpty = (t: DebitTranche) => !t.value.trim() && !t.rate.trim() && !t.amount.trim();
/** Drops rows left untouched in the form, so they are not saved as blank records, and tidies containers. */
export const withoutEmptyRows = (a: DebitAdvice): DebitAdvice => ({
  ...a,
  tranches: a.tranches.filter((t) => !trancheIsEmpty(t)),
  lines: a.lines.filter((l) => !lineIsEmpty(l)).map(tidyContainers),
});

const REF_MAX = 250;
const NOTE_MAX = 200;
/**
 * Errors keyed by field: `date`, `tranche.0.rate`, `line.1.beNo`. `form` means nothing was entered.
 * Each side's fields are required only when that side is used, because the sheet has rows with just one.
 */
export function validateDebitAdvice(advice: DebitAdvice): FieldErrors | null {
  const errors: FieldErrors = {};
  const need = (key: string, value: string, message: string) => {
    if (!value.trim()) errors[key] = message;
  };
  const positive = (key: string, value: string, label: string) => {
    if (value.trim() && !(Number(value) > 0)) errors[key] = `${label} must be greater than zero.`;
  };
  advice.tranches.forEach((t, i) => {
    if (trancheIsEmpty(t)) return;
    need("date", advice.date, "Enter the date.");
    need("partyName", advice.partyName, "Enter the party name.");
    need("curr", advice.curr, "Select the currency.");
    need(`tranche.${i}.value`, t.value, "Enter the currency value.");
    need(`tranche.${i}.rate`, t.rate, "Enter the Ex. Rate / INR.");
    need(`tranche.${i}.amount`, t.amount, "Enter the amount.");
    positive(`tranche.${i}.value`, t.value, "Currency value");
    positive(`tranche.${i}.rate`, t.rate, "Ex. Rate / INR");
    positive(`tranche.${i}.amount`, t.amount, "Amount");
  });
  advice.lines.forEach((l, i) => {
    if (l.beNo.trim() || l.beValue.trim()) {
      need(`line.${i}.beNo`, l.beNo, "Enter the BE number.");
      need(`line.${i}.beDate`, l.beDate, "Enter the BE date.");
      need(`line.${i}.beCurr`, l.beCurr, "Select the BE currency.");
      need(`line.${i}.beValue`, l.beValue, "Enter the BE value.");
      positive(`line.${i}.beValue`, l.beValue, "BE value");
    }
    if (l.paidValue.trim()) {
      need(`line.${i}.tpt`, l.tpt, "Enter the shipper.");
      need(`line.${i}.paidCurr`, l.paidCurr, "Select the currency paid.");
      need(`line.${i}.paidOn`, l.paidOn, "Enter the date paid.");
      positive(`line.${i}.paidValue`, l.paidValue, "Paid value");
    }
    if (l.hasEnhancement) {
      need(`line.${i}.enhancementAmount`, l.enhancementAmount, "Enter the enhancement amount.");
      positive(`line.${i}.enhancementAmount`, l.enhancementAmount, "Enhancement amount");
    }
    containerErrors(l, i, errors);
    if (l.ref.length > REF_MAX)
      errors[`line.${i}.ref`] = `Ref. is limited to ${REF_MAX} characters.`;
    if (l.closureRef.length > REF_MAX)
      errors[`line.${i}.closureRef`] = `Reference is limited to ${REF_MAX} characters.`;
    if (l.notes.length > NOTE_MAX)
      errors[`line.${i}.notes`] = `Notes are limited to ${NOTE_MAX} characters.`;
  });
  if (advice.reference.length > REF_MAX)
    errors["reference"] = `Payment Reference is limited to ${REF_MAX} characters.`;
  if (lineAndTrancheEmpty(advice))
    errors["form"] = "Enter a debit advice amount or a BE / TPT line.";
  return Object.keys(errors).length ? errors : null;
}
const lineAndTrancheEmpty = (a: DebitAdvice) =>
  a.tranches.every(trancheIsEmpty) && a.lines.every(lineIsEmpty);

const entryPrefix = (adviceId: string) => `da-${adviceId}-`;
/** Each amount paid to a TPT is a transfer in the ledger, which is what shipment payments reserve from. */
export const tptEntriesFor = (a: DebitAdvice): LedgerEntry[] =>
  a.lines
    .filter((l) => num(l.paidValue) > 0)
    .map((l) => ({
      id: `${entryPrefix(a.id)}${l.id}`,
      date: l.paidOn,
      description: l.notes || l.fruit || `Transfer via ${l.route || l.tpt}`,
      reference: l.ref || l.beNo,
      type: entryTypes[0],
      debit: 0,
      credit: num(l.paidValue),
      currency: l.paidCurr,
      shipper: "",
      file: "",
      eta: l.eta,
      agv: l.agv,
      via: l.route || l.tpt,
    }));
/** Replaces an advice's transfers, so editing or deleting it cannot leave stale ones behind. */
export const syncTptEntries = (entries: LedgerEntry[], adviceId: string, next: LedgerEntry[]) => [
  ...entries.filter((e) => !e.id.startsWith(entryPrefix(adviceId))),
  ...next,
];

export const DEBIT_ADVICE_COLUMNS = [
  "Sl. No.",
  "DATE",
  "PARTY NAME",
  "REFERENCE",
  "TOL REF. NO.",
  "BILL NO. / ORM No.",
  "CURRENCY",
  "CURRENCY VALUE",
  "INR",
  "AMOUNT",
  "BL NO.",
  "Port Code",
  "BE NO.",
  "BE DATE",
  "BE CURRENCY",
  "BE VALUE",
  "INR VALUE",
  "REF.",
  "INVOICE NUMBER",
  "PARTY",
  "Shipper",
  "NUMBER OF CARTONS",
  "NT. WEIGHT",
  "GSM to Shipper",
  "PAID CURRENCY",
  "Paid On (FW to shipper)",
  "CONTAINER NUMBER",
  "NUMBER OF CONTAINERS",
  "FRUIT",
  "BE Closure Status",
  "BE Closure Date",
  "BE Closure Reference",
  "ORM - BE",
  "Payment Status",
  // Inv. Value, Ass. Value and the four duty check figures were removed (user request, 2026-11-10): the form
  // does not take them. The sheet rows still hold the values and send them back unchanged on edit.
  "Duty paid (BE)",
];
const EXPORT_TYPES: Record<string, XlsxColumnType> = {
  "Sl. No.": "integer",
  DATE: "date",
  "CURRENCY VALUE": "money",
  INR: "number",
  AMOUNT: "money",
  "BE DATE": "date",
  "BE VALUE": "money",
  "INR VALUE": "money",
  "NUMBER OF CARTONS": "integer",
  "NT. WEIGHT": "number",
  "GSM to Shipper": "money",
  "Paid On (FW to shipper)": "date",
  "NUMBER OF CONTAINERS": "integer",
  "BE Closure Date": "date",
  "ORM - BE": "money",
  "Duty paid (BE)": "money",
};
const EXPORT_TOTALS = new Set([
  "CURRENCY VALUE",
  "AMOUNT",
  "BE VALUE",
  "NUMBER OF CARTONS",
  "GSM to Shipper",
  "NUMBER OF CONTAINERS",
  "ORM - BE",
  "Duty paid (BE)",
]);
/** The Excel export's columns: the table's, with numbers and dates typed and the additive ones totalled. */
export const DEBIT_ADVICE_EXPORT_COLUMNS: XlsxColumn[] = DEBIT_ADVICE_COLUMNS.map((header) => ({
  header,
  ...(EXPORT_TYPES[header] ? { type: EXPORT_TYPES[header] } : {}),
  ...(EXPORT_TOTALS.has(header) ? { total: true } : {}),
}));

/** Export rows in the sheet's column order. Shared advice cells go on the first row, as the merges do. */
export const debitAdviceCsvRows = (advices: DebitAdvice[], serial: (a: DebitAdvice) => number) =>
  advices.flatMap((a) =>
    Array.from({ length: Math.max(1, a.tranches.length, a.lines.length) }, (_, i) => {
      const first = i === 0;
      const t = a.tranches[i];
      const l = a.lines[i];
      const shown = l && dutyFigures(l);
      const diff = shownOrmBe(a);
      return [
        first ? serial(a) : "",
        first ? a.date : "",
        first ? a.partyName : "",
        first ? a.reference : "",
        first ? a.tolRef : "",
        first ? a.billNo : "",
        first ? a.curr : "",
        t?.value ?? "",
        t?.rate ?? "",
        t ? trancheAmount(t) : "",
        l?.blNo ?? "",
        l?.portCode ?? "",
        l?.beNo ?? "",
        l?.beDate ?? "",
        l?.beCurr ?? "",
        l?.beValue ?? "",
        l && shown?.inr ? beInrValue(l) : "",
        l?.ref ?? "",
        l?.invNo ?? "",
        l?.party ?? "",
        l?.tpt ?? "",
        l?.cartons ?? "",
        l?.netWeight ?? "",
        l?.paidValue ?? "",
        l?.paidCurr ?? "",
        l?.paidOn ?? "",
        containerListText(l?.containerNo ?? ""),
        l?.ctrCount ?? "",
        l?.fruit ?? "",
        l?.closure ?? "",
        l?.closureDate ?? "",
        l?.closureRef ?? "",
        first ? (diff ?? "") : "",
        first ? [shownPaymentStatus(a), a.matchedTo].filter(Boolean).join(" - ") : "",
        l?.dutyPaid ?? "",
      ];
    }),
  );

/**
 * How one advice lays out in the sheet's rows: as many rows as its longer side, with the last amount and
 * the last BE line stretching to fill. A blank paid amount, TPT or party on a later BE line means the one
 * above covers it too, which the sheet shows as a merged cell. A span of 0 means covered from above.
 */
export function adviceSheetRows(a: DebitAdvice) {
  const count = Math.max(1, a.tranches.length, a.lines.length);
  const side = (i: number, length: number) => {
    if (!length) return i === 0 ? count : 0;
    if (i >= length) return 0;
    return i === length - 1 ? count - i : 1;
  };
  const carried = (i: number, has: (l: BeLine) => boolean) => {
    if (!a.lines.length) return i === 0 ? count : 0;
    const line = a.lines[i];
    if (!line || (i > 0 && !has(line))) return 0;
    let end = i + 1;
    while (end < a.lines.length && !has(a.lines[end]!)) end++;
    return (end === a.lines.length ? count : end) - i;
  };
  return Array.from({ length: count }, (_, i) => ({
    index: i,
    tranche: a.tranches[i],
    trancheSpan: side(i, a.tranches.length),
    line: a.lines[i],
    lineSpan: side(i, a.lines.length),
    partySpan: carried(i, (l) => Boolean(l.party.trim())),
    tptSpan: carried(i, (l) => Boolean(l.tpt.trim())),
    paidSpan: carried(i, (l) => Boolean(l.paidValue.trim())),
  }));
}
