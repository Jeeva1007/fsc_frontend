import { normalizeStatus, type Shipment } from "./fsc";

type Item = Record<string, unknown>;

// The listing rows are untyped in the OpenAPI document, so every field is read defensively.
const str = (i: Item, k: string) => {
  const v = i[k];
  return v === null || v === undefined ? "" : String(v);
};
const flag = (i: Item, k: string) => i[k] === true;
const whole = (i: Item, k: string) => {
  const n = Number(i[k]);
  return i[k] === null || i[k] === undefined || !Number.isFinite(n) ? undefined : n;
};

/** Maps one GET /listing row to the shipment shape used by the screens. Nothing is invented: missing values stay empty. */
export function fromListingItem(i: Item): Shipment {
  const beNo = str(i, "beNo");
  const beDate = str(i, "beDate");
  const docs = {
    awaitingPhysicalDocs: flag(i, "chkAwaitingPhysDocs"),
    receivedPhysicalDocs: flag(i, "chkReceivedPhysDocs"),
    physicalDocsSentToCha: flag(i, "chkPhysDocsToCha"),
    awaitingTelex: flag(i, "chkAwaitingTelex"),
  };
  const serverId = whole(i, "id");
  const stageNo = whole(i, "stageNo");
  return {
    vase: str(i, "vase"),
    vsub: str(i, "blNo"),
    status: normalizeStatus(str(i, "status")),
    ssub: [beNo, beDate].filter(Boolean).join(" of "),
    reference: [beNo, beDate].filter(Boolean).join(" of "),
    rcv: str(i, "receiver"),
    eta: str(i, "eta"),
    dos: str(i, "dossier"),
    pol: str(i, "pol"),
    pod: str(i, "pod"),
    shp: str(i, "shipper"),
    desc: str(i, "description"),
    dsub: "",
    agv: str(i, "agv") || "0",
    gsm: str(i, "gsm") || "0",
    gsmd: str(i, "gsmPaidOn"),
    bull: str(i, "bull") || "0",
    bulld: str(i, "bullPaidOn"),
    tp: str(i, "tp") || "0",
    sw: str(i, "sweet") || "0",
    inv: str(i, "invoiceNo"),
    containers: str(i, "containerCount") || "1",
    ...(str(i, "warehouseWhatsapp") ? { warehouseWhatsapp: str(i, "warehouseWhatsapp") } : {}),
    ...(str(i, "warehouseId") ? { warehouseId: str(i, "warehouseId") } : {}),
    cha: str(i, "cha"),
    liner: str(i, "liner"),
    chaDescription: str(i, "fruit"),
    netWeight: str(i, "netWeight"),
    be: beNo,
    beDate,
    beType: str(i, "beType"),
    note: str(i, "statusNote"),
    ...docs,
    docCheckboxes: { ...docs },
    isLate: flag(i, "isLate"),
    invoiceDue: str(i, "invoiceDue"),
    balanceDueDate: str(i, "balanceDueDate"),
    ...(serverId !== undefined ? { serverId } : {}),
    ...(stageNo !== undefined ? { stageNo } : {}),
  };
}

/** Active shipments are every shipment that is not Delivered. */
export const activeShipments = (rows: Shipment[]) =>
  rows.filter((row) => row.status !== "Delivered");
export const deliveredShipments = (rows: Shipment[]) =>
  rows.filter((row) => row.status === "Delivered");

/** Every shipment in the listing; the Master tab shows them all, the Active tab all but Delivered. */
export const listingRows = (items: Item[]): Shipment[] => items.map(fromListingItem);
