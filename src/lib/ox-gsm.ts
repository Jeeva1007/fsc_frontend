import { uid } from "@/lib/id";
import * as yup from "yup";
import type { Deal } from "@/components/fsc/ledger-data";
import { validateForm, type FieldErrors } from "./login-schema";
import { REFERENCE_MAX } from "./payments-api";

export const OX_STAGES = ["Payment 1", "Payment 2", "Final payment"];

/** One stage of what OX owes GSM. Amounts stay as form text; `received` is empty until OX has paid. */
export type OxPayment = {
  id: string;
  description: string;
  reference: string;
  stage: string;
  due: string;
  scheduled: string;
  received: string;
  oxDate: string;
};
export type OxToGsmRow = OxPayment & {
  /** What OX still owes on this reference after this row: all scheduled less everything received so far. */
  balance: number;
};

export const blankOxPayment = (): OxPayment => ({
  id: uid(),
  description: "",
  reference: "",
  stage: "",
  due: "",
  scheduled: "",
  received: "",
  oxDate: "",
});

/**
 * The OX side of each deal: OX is GSM's customer, so its sell value is what it owes and each payment
 * reduces that. The invoice adjustment (GSM's margin) is collected with Payment 1.
 */
export const oxPaymentsFromDeals = (deals: Deal[]): OxPayment[] =>
  deals.flatMap((d) => {
    const [value, buy1, buy2] = [Number(d.value), Number(d.buy1), Number(d.buy2)];
    return [
      { stage: "Payment 1", amount: buy1 + Number(d.adjustment), paid: true, due: "" },
      { stage: "Payment 2", amount: buy2, paid: true, due: "" },
      { stage: "Final payment", amount: value - buy1 - buy2, paid: d.finalPaid, due: d.due },
    ].map(({ stage, amount, paid, due }) => ({
      id: `${d.id}-${stage}`,
      description: d.description,
      reference: d.pi,
      stage,
      due,
      scheduled: String(amount),
      received: paid ? String(amount) : "",
      oxDate: "",
    }));
  });

const amountOf = (v: string) => Number(v) || 0;

/** Adds each row's balance, worked out per reference so rows can be added in any order. */
export function oxToGsmRows(payments: OxPayment[]): OxToGsmRow[] {
  const owed = new Map<string, number>();
  for (const p of payments)
    owed.set(p.reference, (owed.get(p.reference) ?? 0) + amountOf(p.scheduled));
  return payments.map((p) => {
    const balance = (owed.get(p.reference) ?? 0) - amountOf(p.received);
    owed.set(p.reference, balance);
    return { ...p, balance };
  });
}

export const oxToGsmTotals = (payments: OxPayment[]) => {
  const scheduled = payments.reduce((sum, p) => sum + amountOf(p.scheduled), 0);
  const received = payments.reduce((sum, p) => sum + amountOf(p.received), 0);
  return { scheduled, received, due: scheduled - received };
};

const amount = (label: string) =>
  yup
    .number()
    .transform((v, original) => (String(original ?? "").trim() === "" ? undefined : v))
    .typeError(`${label} must be a number.`)
    .min(0.01, `${label} must be at least 0.01.`);

const oxPaymentSchema = yup.object({
  description: yup.string().trim().required("Enter the description."),
  reference: yup
    .string()
    .trim()
    .required("Enter the reference.")
    .max(REFERENCE_MAX, `Reference must be ${REFERENCE_MAX} characters or fewer.`),
  stage: yup.string().trim().required("Select the payment stage."),
  scheduled: amount("Sell scheduled").required("Enter the sell scheduled amount."),
  received: amount("Sell received"),
  oxDate: yup.string().when("received", {
    is: (v: unknown) => v !== undefined,
    then: (s) => s.trim().required("Enter the OX date."),
  }),
});

export const validateOxPayment = (p: OxPayment): FieldErrors | null =>
  validateForm(oxPaymentSchema, p);
