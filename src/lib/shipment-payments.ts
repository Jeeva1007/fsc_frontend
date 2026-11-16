import { uid } from "@/lib/id";
import type { Payment } from "@/components/fsc/shipments";
import type {
  ShipmentPaymentRequest,
  ShipmentPaymentResponse,
  ShipmentPaymentUpdateItem,
  ShipmentTptRequest,
} from "@/types/api";

const numStr = (v: number | null | undefined) => (v === null || v === undefined ? "" : String(v));

/** One server payment row -> the UI Payment the table shows. `serverSaved` marks it as an existing row. */
export function fromShipmentPaymentResponse(r: ShipmentPaymentResponse): Payment {
  return {
    id: r.id ?? uid(),
    date: r.gsmDate ?? "",
    gsm: numStr(r.gsmTpt),
    ox: numStr(r.ox),
    oxDate: r.oxDate ?? "",
    gsmReference: r.gsmTptReference ?? "",
    oxReference: r.oxReference ?? "",
    directToOx: Boolean(r.isOxDirectPayment),
    notes: r.notes ?? "",
    serverSaved: true,
  };
}

const num = (s: string | undefined) => {
  const v = (s ?? "").replace(/,/g, "").trim();
  const n = Number(v);
  return v !== "" && Number.isFinite(n) && n >= 0 ? n : undefined;
};
const date = (s: string | undefined) => {
  const v = (s ?? "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined;
};
const str = (s: string | undefined, max: number) => {
  const v = (s ?? "").trim();
  return v ? v.slice(0, max) : undefined;
};

/**
 * One UI Payment -> the server's `ShipmentPaymentRequest`. The `id` is sent only when `withId` (an update);
 * on create every row is sent WITHOUT an id so the backend generates one. `useFull` is the shipment's TPT
 * reservation mode. Blank optional values are omitted.
 */
export function toShipmentPaymentRequest(
  p: Payment,
  shipmentId: string,
  useFull: boolean,
  withId: boolean,
): ShipmentPaymentRequest {
  const body: ShipmentPaymentRequest = {
    shipmentId,
    useFullTptAmount: useFull,
    isOxDirectPayment: Boolean(p.directToOx),
  };
  if (withId && p.id) body.id = p.id;
  const gsm = num(p.gsm);
  const ox = num(p.ox);
  const gsmDate = date(p.date);
  const oxDate = date(p.oxDate);
  const gsmRef = str(p.gsmReference, 120);
  const oxRef = str(p.oxReference, 120);
  const notes = str(p.notes, 500);
  if (gsm !== undefined) body.gsmTpt = gsm;
  if (ox !== undefined) body.ox = ox;
  if (gsmDate) body.gsmDate = gsmDate;
  if (oxDate) body.oxDate = oxDate;
  if (gsmRef) body.gsmTptReference = gsmRef;
  if (oxRef) body.oxReference = oxRef;
  if (notes) body.notes = notes;
  return body;
}

const numN = (s: string | undefined) => {
  const v = (s ?? "").replace(/,/g, "").trim();
  const n = Number(v);
  return v !== "" && Number.isFinite(n) ? n : null;
};

/**
 * One UI Payment -> a `payments` item for updateShipment. The row carries NO shipmentId and NO
 * useFullTptAmount (TPT lives only in the `tpt` key). `id` is the server id for an existing row, or null for
 * a new one. `gsmTptType` is "GSM" whenever there is a GSM amount, never "TPT".
 */
export function toShipmentPaymentUpdateItem(p: Payment): ShipmentPaymentUpdateItem {
  const gsmTpt = numN(p.gsm);
  return {
    id: p.serverSaved ? p.id : null,
    gsmDate: date(p.date) ?? null,
    gsmTpt,
    gsmTptType: gsmTpt != null ? "GSM" : null,
    gsmTptReference: str(p.gsmReference, 120) ?? null,
    ox: numN(p.ox),
    oxDate: date(p.oxDate) ?? null,
    oxReference: str(p.oxReference, 120) ?? null,
    isOxDirectPayment: Boolean(p.directToOx),
    notes: str(p.notes, 500) ?? null,
  };
}

/** The shipment's TPT reservation choice -> `tpt` for updateShipment (owner only). */
export function buildShipmentTpt(
  tptMode: "full" | "partial" | undefined,
  tptPartial: string | undefined,
): ShipmentTptRequest {
  const mode = tptMode === "full" ? "FULL" : tptMode === "partial" ? "PARTIAL" : "NONE";
  const today = new Date().toISOString().slice(0, 10);
  const amount = mode === "PARTIAL" ? (numN(tptPartial) ?? null) : null;
  return { mode, amount, date: today };
}
