import type { Payment } from "@/components/fsc/shipments";
import type { PaymentBody, PaymentKind, PaymentRecord, PaymentSide } from "@/types/api";

/** Frontend limit requested by the user; the backend Swagger still says referenceNo <= 60 (2026-10-30). */
export const REFERENCE_MAX = 250;
export const REVERSAL_NOTE_MAX = 60;

const amountOf = (v: string) => {
  const n = Number(v.trim());
  return v.trim() !== "" && Number.isFinite(n) && n > 0 ? n : undefined;
};

/** The shared part of the add and edit bodies. Empty fields are left out, never sent as blanks. */
export function toPaymentSide(p: Payment): PaymentSide {
  const gsm = amountOf(p.gsm);
  const ox = amountOf(p.ox);
  const reference = (p.reference ?? "").trim();
  return {
    ...(gsm !== undefined ? { gsmAmount: gsm } : {}),
    ...(p.date ? { gsmPaidOn: p.date } : {}),
    ...(ox !== undefined ? { oxAmount: ox } : {}),
    ...(ox !== undefined && p.oxDate ? { oxPaidOn: p.oxDate } : {}),
    ...(reference ? { referenceNo: reference } : {}),
    ...(p.screenshotId !== undefined ? { screenshotId: p.screenshotId } : {}),
  };
}

/** POST body. The first payment on a shipment is the ADVANCE, later ones are BALANCE payments. */
export const toPaymentBody = (p: Payment, existingCount: number): PaymentBody => ({
  kind: (existingCount === 0 ? "ADVANCE" : "BALANCE") satisfies PaymentKind,
  ...toPaymentSide(p),
});

const text = (v: unknown) => (typeof v === "string" ? v : "");
const numStr = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? String(v) : "");

/** Server row -> the Payment shape the screen uses. Notes are not stored by the backend. */
export function fromPaymentRecord(r: PaymentRecord): Payment {
  return {
    id: String(r.id),
    date: text(r.gsmPaidOn),
    gsm: numStr(r.gsmAmount),
    ox: numStr(r.oxAmount),
    oxDate: text(r.oxPaidOn),
    reference: text(r.referenceNo),
    notes: "",
    ...(typeof r.screenshotId === "number" ? { screenshotId: r.screenshotId } : {}),
  };
}

const isRecord = (v: unknown): v is PaymentRecord =>
  typeof v === "object" && v !== null && typeof (v as { id?: unknown }).id === "number";

/**
 * GET /shipments/{id}/payments is typed as a free-form object, so find the payment rows defensively:
 * the first array of records (under any key), or the response itself when it is an array.
 */
export function extractPaymentRecords(section: unknown): PaymentRecord[] {
  if (Array.isArray(section)) return section.filter(isRecord);
  if (typeof section !== "object" || section === null) return [];
  for (const value of Object.values(section)) {
    if (Array.isArray(value) && value.some(isRecord)) return value.filter(isRecord);
  }
  return [];
}

/** Hides reversal entries and the payments they cancelled, so a "deleted" payment disappears. */
export function visiblePayments(records: PaymentRecord[]): PaymentRecord[] {
  // The server sends reversesId: null on ordinary payments, so treat null and missing alike.
  return records.filter((r) => r.reversed !== true && r.reversesId == null);
}

/** Server payment ids are digits; locally created rows carry a UUID until the server answers. */
export const serverPaymentId = (p: Payment): number | undefined =>
  /^\d+$/.test(p.id) ? Number(p.id) : undefined;
