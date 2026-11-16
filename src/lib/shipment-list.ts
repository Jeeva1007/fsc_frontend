import { uid } from "@/lib/id";
import { DEFAULT_UNIT, normalizeStatus, type CostLine, type Shipment } from "./fsc";
import { isUuid } from "./shipment-create";
import type { MasterOptions, ShipmentListItem, WorkflowStage } from "@/types/api";

/**
 * Maps a GET /shipments/shipmentList row to the shipment shape the screens use.
 *
 * The backend types each row as an untyped `Map<String, Object>`, so no field name is guaranteed. Every
 * value is therefore read through a list of likely keys and nothing is invented: a value that is not found
 * stays empty. Ids that come back as UUIDs (shipper, receiver, POL, POD, liner) are turned back into the
 * codes the tables show, using the same `*Dropdown` lists the Add Shipment form loads; a value that is
 * already a code or name is kept as is. The workflow stage number is turned into its status name.
 *
 * Verify the key names against one real signed-in row before trusting the mapping (the same caution as
 * `fromUserRow`): where this file lists several aliases, the real one wins and the rest are harmless.
 */

/** The first non-empty string found under any of `keys`. */
function pick(item: ShipmentListItem, keys: string[]): string {
  for (const key of keys) {
    const value = item[key];
    if (value === null || value === undefined) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return "";
}

/** A whole number found under any of `keys`, or undefined. */
function pickNumber(item: ShipmentListItem, keys: string[]): number | undefined {
  for (const key of keys) {
    const value = item[key];
    if (value === null || value === undefined || value === "") continue;
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

/** A value that may be a dropdown row's UUID turned back into its code (or name); a plain code is kept. */
function codeFor(options: MasterOptions | undefined, list: string, value: string): string {
  if (!value) return "";
  if (!isUuid(value)) return value;
  const hit = options?.[list]?.find((o) => (o.id ?? "").trim() === value);
  return (hit?.code ?? hit?.name ?? "").trim();
}

/** The status name: an explicit status field if the row has one, else the workflow stage's name. */
function statusFor(
  item: ShipmentListItem,
  stages: WorkflowStage[] | undefined,
): { status: string; stageNo: number | undefined } {
  const explicit = pick(item, ["status", "statusName", "workflowStage", "stageName", "stage"]);
  const stageId = pickNumber(item, ["workflowStageId", "stageId", "stageNo"]);
  if (explicit) return { status: normalizeStatus(explicit), stageNo: stageId };
  const hit = stages?.find((s) => s.id === stageId);
  const name = hit?.displayName || hit?.name || "";
  return { status: name ? normalizeStatus(name) : "", stageNo: stageId };
}

/** One shipmentList row -> the shipment shape used by the screens. Missing values stay empty. */
export function fromShipmentListItem(
  item: ShipmentListItem,
  options?: MasterOptions,
  stages?: WorkflowStage[],
): Shipment {
  const beNo = pick(item, ["beNo", "be"]);
  const beDate = pick(item, ["beDate"]);
  const serverUuid = pick(item, ["id", "shipmentId", "uuid"]);
  const { status, stageNo } = statusFor(item, stages);
  const row: Shipment = {
    vase: pick(item, ["containerNumber", "containerNo", "vase", "container"]),
    vsub: pick(item, ["blNo", "bl", "billOfLading"]),
    status,
    ssub: [beNo, beDate].filter(Boolean).join(" of "),
    reference: [beNo, beDate].filter(Boolean).join(" of "),
    rcv:
      pick(item, ["receiverCode", "receiverName", "receiver"]) ||
      codeFor(options, "parties", pick(item, ["receiverId"])),
    eta: pick(item, ["eta"]),
    dos: pick(item, ["fileNo", "dossier", "dos"]),
    pol:
      pick(item, ["polCode", "polName", "originCode", "pol"]) ||
      codeFor(options, "countries", pick(item, ["polId", "pol"])),
    pod:
      pick(item, ["podCode", "podName", "pod"]) || codeFor(options, "ports", pick(item, ["podId"])),
    shp:
      pick(item, ["shipperCode", "shipperName", "shipper"]) ||
      codeFor(options, "shippers", pick(item, ["shipperId"])),
    desc: pick(item, ["productDescription", "description", "desc"]),
    dsub: "",
    agv: pick(item, ["agvAmount", "agv"]) || "0",
    gsm: pick(item, ["gsm", "gsmAmount"]) || "0",
    gsmd: pick(item, ["gsmPaidOn", "gsmDate", "gsmd"]),
    bull: pick(item, ["bull", "bullAmount", "ox"]) || "0",
    bulld: pick(item, ["bullPaidOn", "oxPaidOn", "bulld"]),
    tp: pick(item, ["tp", "tpt", "tpAmount"]) || "0",
    sw: pick(item, ["sweet", "sw"]) || "0",
    inv: pick(item, ["invoiceNo", "invoice", "inv"]),
    containers: pick(item, ["containerCount", "noOfContainers", "ctrCount"]) || "1",
    cha:
      pick(item, ["chaCode", "chaName", "cha"]) ||
      (isUuid(pick(item, ["chaId"])) ? "" : pick(item, ["chaId"])),
    liner:
      pick(item, ["linerCode", "linerName", "liner"]) ||
      codeFor(options, "shippingLines", pick(item, ["linerId"])),
    chaDescription: pick(item, ["fruit", "product", "productName"]),
    netWeight: pick(item, ["netWeight"]),
    be: beNo,
    beDate,
    beType: pick(item, ["beType"]),
    note: pick(item, ["statusNotes", "statusNote", "note"]),
  };
  const cartons = pick(item, ["noOfCartons", "cartons"]);
  const whatsapp = pick(item, ["warehouseWhatsapp", "warehouseWhatsappNumber"]);
  const warehouseId = pick(item, ["warehouseId"]);
  const chaId = pick(item, ["chaId"]);
  const breakdown = pickAgvLines(item);
  const agencies = pickLinkedAgencies(item, options);
  const oxDirect = pick(item, ["oxDirectPayment", "directOxPaid", "oxDirectPaid"]);
  const remaining = pick(item, ["remainingBalance", "balanceRemaining"]);
  return {
    ...row,
    ...(oxDirect ? { oxDirectPaid: oxDirect } : {}),
    ...(remaining ? { remainingBalance: remaining } : {}),
    // Linked Agencies as the form stores them: the agency codes joined with ", " (e.g. "EN, PQ").
    ...(agencies.codes.length ? { agency: agencies.codes.join(", ") } : {}),
    ...(Object.keys(agencies.ids).length ? { agencyIds: agencies.ids } : {}),
    ...(agencies.enhancement ? { enhancement: agencies.enhancement } : {}),
    ...(cartons ? { cartons } : {}),
    ...(whatsapp ? { warehouseWhatsapp: whatsapp } : {}),
    ...(isUuid(warehouseId) ? { warehouseId } : {}),
    ...(isUuid(chaId) ? { chaId } : {}),
    ...(breakdown.length ? { breakdown } : {}),
    ...(serverUuid ? { serverUuid } : {}),
    ...(stageNo !== undefined ? { stageNo } : {}),
  };
}

/**
 * The row's `linkedAgencies` ([{ linkedAgencyId, code, name, excessAmount }]) as the agency codes the form
 * and view use — the code, else the name, else the code of `linkedAgencyId` in the linked agency dropdown —
 * plus the Enhancement agency's `excessAmount` (shown as the Enhancement amount), when it has one.
 */
function pickLinkedAgencies(
  item: ShipmentListItem,
  options: MasterOptions | undefined,
): { codes: string[]; ids: Record<string, string>; enhancement: string } {
  const raw = item["linkedAgencies"];
  if (!Array.isArray(raw)) return { codes: [], ids: {}, enhancement: "" };
  const codes: string[] = [];
  const ids: Record<string, string> = {};
  let enhancement = "";
  for (const a of raw) {
    if (typeof a !== "object" || a === null) continue;
    const r = a as Record<string, unknown>;
    const text = (v: unknown) => (v === null || v === undefined ? "" : String(v).trim());
    const code =
      text(r["code"]) ||
      text(r["name"]) ||
      codeFor(options, "linkedServices", text(r["linkedAgencyId"]));
    if (code && !codes.includes(code)) codes.push(code);
    const id = text(r["linkedAgencyId"]);
    if (code && isUuid(id)) ids[code] = id;
    const excess = text(r["excessAmount"]);
    if (excess && isEnhancementAgency(code, options, text(r["name"]))) enhancement = excess;
  }
  return { codes, ids, enhancement };
}

/**
 * True when a Linked Agency value is the Enhancement agency: the built-in name "Enhancement", or a code
 * (e.g. "EN") whose row in the linked agency dropdown — or the `name` given — says Enhancement.
 */
export function isEnhancementAgency(
  value: string,
  options?: MasterOptions,
  name?: string,
): boolean {
  const v = value.trim().toLowerCase();
  if (!v) return false;
  if (v === "enhancement" || (name ?? "").trim().toLowerCase() === "enhancement") return true;
  const row = options?.["linkedServices"]?.find(
    (o) => (o.code ?? "").trim().toLowerCase() === v || (o.name ?? "").trim().toLowerCase() === v,
  );
  return (row?.name ?? "").trim().toLowerCase() === "enhancement";
}

/** The server's `agvLines` (as sent on create) turned back into the UI's AGV composition lines. */
function pickAgvLines(item: ShipmentListItem): CostLine[] {
  const raw = item["agvLines"] ?? item["agvLineList"] ?? item["agvItems"];
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((l): l is Record<string, unknown> => typeof l === "object" && l !== null)
    .map((l) => {
      const num = (v: unknown) => {
        if (v === null || v === undefined || v === "") return "";
        const n = Number(v);
        return Number.isFinite(n) ? String(n) : "";
      };
      const str = (v: unknown) => (v === null || v === undefined ? "" : String(v));
      const serverId = str(l["id"]).trim();
      return {
        id: serverId || uid(),
        ...(isUuid(serverId) ? { serverId } : {}),
        product: str(l["product"] ?? l["productName"] ?? l["productDescription"]),
        unit: str(l["unit"]) || DEFAULT_UNIT,
        quantity: num(l["quantity"]),
        cost: num(l["unitPrice"] ?? l["cost"] ?? l["price"]),
      };
    });
}

/** Every shipmentList row mapped to a shipment. */
export function shipmentListRows(
  items: ShipmentListItem[],
  options?: MasterOptions,
  stages?: WorkflowStage[],
): Shipment[] {
  return items.map((item) => fromShipmentListItem(item, options, stages));
}
