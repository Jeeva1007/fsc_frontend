import { agvTotal, DEFAULT_UNIT, pricedLines, type Shipment } from "@/lib/fsc";
import type { MasterOption, MasterOptions, ShipmentPayload } from "@/types/api";

const clean = (v: string | undefined) => (v ?? "").trim();
const num = (v: string | undefined) => {
  const n = Number(clean(v));
  return clean(v) !== "" && Number.isFinite(n) ? n : undefined;
};

/** Finds an option id whose code or name equals `value` (case-insensitive) in lists whose key contains a hint. */
export function optionId(
  options: MasterOptions | undefined,
  hints: string[],
  value: string | undefined,
): number | undefined {
  const wanted = clean(value).toLowerCase();
  if (!options || !wanted) return undefined;
  for (const [key, list] of Object.entries(options)) {
    if (!hints.some((h) => key.toLowerCase().includes(h))) continue;
    const hit = (list as MasterOption[]).find(
      (o) => o.code?.trim().toLowerCase() === wanted || o.name?.trim().toLowerCase() === wanted,
    );
    const id = hit ? Number(hit.id) : NaN;
    if (Number.isSafeInteger(id)) return id;
  }
  return undefined;
}

/**
 * Maps the Add Shipment form to the backend `Shipment` body. Values are sent as typed (never
 * silently truncated or rewritten); the server validates lengths, ranges and required fields and
 * its messages are shown to the user. Fields with no value are omitted.
 */
export function toShipmentPayload(form: Shipment, options?: MasterOptions): ShipmentPayload {
  const priced = pricedLines(form.breakdown);
  const lines = priced.map((l) => ({
    ...(clean(l.product) ? { product: clean(l.product) } : {}),
    unit: clean(l.unit) || DEFAULT_UNIT,
    quantity: Number(l.quantity),
    unitPrice: Number(l.cost),
  }));
  const containerCount = num(form.containers);
  const netWeight = num(form.netWeight);
  const payload: { [key: string]: unknown } = {
    containerNo: clean(form.vase),
    containerCount: containerCount !== undefined ? Math.trunc(containerCount) : undefined,
    invoiceNo: clean(form.inv),
    blNo: clean(form.vsub),
    fileNo: clean(form.dos),
    eta: clean(form.eta),
    originCode: clean(form.pol),
    podCode: clean(form.pod),
    description: clean(form.desc),
    fruit: clean(form.chaDescription),
    netWeight: netWeight !== undefined && netWeight > 0 ? netWeight : undefined,
    beNo: clean(form.be),
    beDate: clean(form.beDate),
    beType: clean(form.beType),
    statusNote: clean(form.note),
    // The backend pattern allows only "+", digits and spaces.
    warehouseWhatsapp: clean(form.warehouseWhatsapp?.replace(/[-()]/g, "")),
    warehouseId: clean(form.warehouseId),
    shippingLineId: optionId(options, ["line", "liner"], form.liner),
    shipperId: optionId(options, ["shipper"], form.shp),
    partyId: optionId(options, ["part", "receiver", "consignee"], form.rcv),
    // The id of the CHA picked from the POD's list; a saved CHA is looked up by code.
    chaId: typeof form.chaId === "number" ? form.chaId : optionId(options, ["cha"], form.cha),
    // Products decide the AGV when there are any; otherwise it is the amount typed in the AGV field.
    ...(lines.length
      ? { agvLines: lines, agvTotal: Number(agvTotal(priced).toFixed(2)) }
      : { agvTotal: num(form.agv) }),
  };
  return Object.fromEntries(
    Object.entries(payload).filter(([, v]) => v !== undefined && v !== ""),
  ) as ShipmentPayload;
}

/** Backend field names -> the labels shown on the Add Shipment form. */
const FIELD_LABELS: Record<string, string> = {
  containerNo: "Vase / Container No",
  containerCount: "No. of Containers",
  invoiceNo: "Sales Invoice No",
  blNo: "BL No",
  fileNo: "Dossier No",
  eta: "ETA",
  originCode: "POL",
  podCode: "POD",
  description: "Product Description",
  fruit: "Product",
  netWeight: "Net Weight",
  beNo: "BE No",
  beDate: "BE Date",
  beType: "BE Type",
  statusNote: "Status Note",
  shippingLineId: "Liner",
  shipperId: "Shipper",
  partyId: "Receiver",
  chaId: "CHA",
  agvLines: "AGV",
  agvTotal: "AGV",
  username: "User ID",
  entityCode: "Entity Code",
  fullName: "Full Name",
  displayName: "Display Name",
  temporaryPassword: "Password",
  email: "Email",
  country: "Country",
  location: "Location",
  role: "Role",
  name: "Warehouse name",
  address: "Location",
  whatsappNumber: "WhatsApp number",
};

/** Turns an RTK Query / backend error into a short, plain-text message for a toast. */
export function describeApiError(error: unknown): string {
  const e = error as { status?: unknown; data?: unknown };
  if (e?.status === "FETCH_ERROR") return "Unable to reach the server.";
  if (e?.status === 401) return "Your session has expired. Please sign in again.";
  if (e?.status === 403) return "You do not have permission to do this.";
  const data = (e?.data ?? {}) as { message?: unknown; fields?: unknown };
  const fields = Array.isArray(data.fields)
    ? data.fields
        .map((f) => {
          // The backend reports each field's reason as `problem` (older shapes used `message`).
          const x = f as { field?: unknown; problem?: unknown; message?: unknown };
          const reason = [x?.problem, x?.message].find((r) => typeof r === "string" && r) as
            string | undefined;
          if (!reason) return "";
          const name = typeof x.field === "string" ? x.field : "";
          return `${FIELD_LABELS[name] ?? name}${name ? ": " : ""}${reason}`;
        })
        .filter(Boolean)
        .slice(0, 3)
    : [];
  if (fields.length) return fields.join("; ");
  return typeof data.message === "string" && data.message
    ? data.message
    : "The server rejected the request.";
}
