import { createContext, type MutableRefObject } from "react";

/**
 * A payment row being entered in the shipment's Payments section (opened with "Add Payment" or a row's
 * edit button) whose values were changed but not yet kept with its ✓ button. `focus` brings it into view.
 */
export type PendingPayment = { focus: () => void };

/**
 * Provided by the shipment form so "Save Changes" can stop while a payment is still being entered (it would
 * otherwise be dropped). The Payments section writes the open row here; null when there is none. Outside a
 * shipment form (the read-only overview) there is no provider and nothing is reported.
 */
export const PendingPaymentContext = createContext<MutableRefObject<PendingPayment | null> | null>(
  null,
);

/** The message shown when "Save Changes" is pressed while a payment is still being entered. */
export const PENDING_PAYMENT_MESSAGE =
  "Please save the payment you are entering (✓) or remove it (✕) before saving the shipment.";
