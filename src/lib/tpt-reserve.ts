import type { TptTransferRequest } from "@/types/api";

/** The Add TPT Entry fields this mapper reads (a structural subset of the form draft). */
type TptEntryDraft = {
  amount?: string;
  date?: string;
  via?: string;
  reference?: string;
  currency?: string;
  notes?: string;
};

/**
 * Maps the Add TPT Entry form draft to the backend's `TptTransferRequest` (POST /tptReserve/addEntry).
 * `shipperId` must already be the shipper's UUID and `entryCategory` is the chosen Entry type. Amounts come
 * from the typed string (commas stripped); blank optional values are left out. Returns null when a required
 * field (shipper/date/amount) is missing, so the caller can show a validation message instead of posting.
 */
export function toTptTransferRequest(
  entry: TptEntryDraft,
  shipperId: string | undefined,
  entryCategory?: string,
): TptTransferRequest | null {
  const amount = Number((entry.amount ?? "").replace(/,/g, "").trim());
  const entryDate = (entry.date ?? "").trim();
  if (
    !shipperId ||
    !/^\d{4}-\d{2}-\d{2}$/.test(entryDate) ||
    !Number.isFinite(amount) ||
    amount <= 0
  )
    return null;
  const str = (s: string | undefined, max: number) => {
    const v = (s ?? "").trim();
    return v ? v.slice(0, max) : undefined;
  };
  const body: TptTransferRequest = { shipperId, entryDate, amount };
  const category = str(entryCategory, 20);
  const currencyCode = str(entry.currency, 10);
  const route = str(entry.via, 30);
  const referenceNo = str(entry.reference, 150);
  const note = str(entry.notes, 300);
  if (category) body.entryCategory = category;
  if (currencyCode) body.currencyCode = currencyCode;
  if (route) body.route = route;
  if (referenceNo) body.referenceNo = referenceNo;
  if (note) body.note = note;
  return body;
}
