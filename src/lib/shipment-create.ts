import { DEFAULT_UNIT, lineNumber, pricedLines, stageCheckboxes, type Shipment } from "@/lib/fsc";
import type {
  MasterOptions,
  ShipmentCreateRequest,
  ShipmentStageUpdateRequest,
  ShipmentUpdateRequest,
  WorkflowStage,
} from "@/types/api";

/**
 * Maps the Add Shipment form to the local backend's `ShipmentCreateRequest`
 * (POST /shipments/createShipment). Dropdown values the form stores as a code or name are sent as the
 * UUID of the matching `*Dropdown` row; a value with no match is left out rather than guessed. Fields
 * with no value are omitted; the server validates the rest and its message is shown.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v: unknown): v is string => typeof v === "string" && UUID.test(v.trim());

const clean = (v: string | undefined) => (v ?? "").trim();
const number = (v: string | undefined) => {
  const s = clean(v).replace(/,/g, "");
  const n = Number(s);
  return s !== "" && Number.isFinite(n) ? n : undefined;
};
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const date = (v: string | undefined) => (ISO_DATE.test(clean(v)) ? clean(v) : undefined);
const same = (a: string | null | undefined, b: string) =>
  (a ?? "").trim().toLowerCase() === b.toLowerCase();

/** The UUID of the row in `options[list]` whose code or name is `value`, or of a UUID typed as is. */
export function dropdownId(
  options: MasterOptions | undefined,
  list: string,
  value: string | undefined,
): string | undefined {
  const wanted = clean(value);
  if (!wanted) return undefined;
  if (isUuid(wanted)) return wanted;
  const hit = options?.[list]?.find((o) => same(o.code, wanted) || same(o.name, wanted));
  return isUuid(hit?.id) ? hit.id.trim() : undefined;
}

/** The workflow stage whose name or display name is the form's status. */
export function stageId(stages: WorkflowStage[] | undefined, status: string | undefined) {
  const wanted = clean(status);
  if (!wanted) return undefined;
  const hit = stages?.find((s) => same(s.displayName, wanted) || same(s.name, wanted));
  return typeof hit?.id === "number" ? hit.id : undefined;
}

export function toCreateShipmentRequest(
  form: Shipment,
  options: MasterOptions | undefined,
  stages: WorkflowStage[] | undefined,
  /**
   * Building an updateShipment body: send each server-loaded AGV line's `id` (see CostLine.serverId), and
   * send `agvLines` / `linkedAgencies` as an empty array when every line / agency was removed, so the
   * server clears them (a create leaves an empty list out).
   */
  forUpdate = false,
): ShipmentCreateRequest {
  const cartons = number(form.cartons);
  const netWeight = number(form.netWeight);
  const agvAmount = number(form.agv);
  const agvLines = pricedLines(form.breakdown).map((l) => {
    const name = clean(l.product);
    const productId = dropdownId(options, "products", name);
    return {
      // The server's line id, so updateShipment updates the line instead of adding a copy of it.
      ...(forUpdate && isUuid(l.serverId) ? { id: l.serverId!.trim() } : {}),
      ...(productId ? { productId } : {}),
      ...(name ? { product: name } : {}),
      unit: clean(l.unit) || DEFAULT_UNIT,
      quantity: lineNumber(l.quantity),
      unitPrice: lineNumber(l.cost),
    };
  });
  // Each ticked agency's id: the one shipmentList gave for that code (sent back unchanged), else the
  // code's id in the linked agency dropdown (an agency ticked in the form). Unknown codes are left out.
  const linkedAgencies = [
    ...new Set(
      (form.agency ?? "")
        .split(",")
        .map((a) => a.trim())
        .filter(Boolean)
        .map((a) => {
          const given = form.agencyIds?.[a];
          return isUuid(given) ? given.trim() : dropdownId(options, "linkedServices", a);
        })
        .filter((id): id is string => Boolean(id)),
    ),
  ].map((linkedAgencyId) => ({ linkedAgencyId }));
  const body: Record<string, unknown> = {
    fileNo: clean(form.dos),
    containerNumber: clean(form.vase),
    blNo: clean(form.vsub),
    invoiceNo: clean(form.inv),
    shipperId: dropdownId(options, "shippers", form.shp),
    receiverId: dropdownId(options, "parties", form.rcv),
    warehouseId: isUuid(form.warehouseId) ? form.warehouseId.trim() : undefined,
    linerId: dropdownId(options, "shippingLines", form.liner),
    pol: dropdownId(options, "countries", form.pol),
    podId: dropdownId(options, "ports", form.pod),
    // The CHA picked from the POD's list carries its UUID.
    chaId: isUuid(form.chaId) ? form.chaId.trim() : undefined,
    eta: date(form.eta),
    // The shipment's product: its UUID from the productDropdown list (by the chosen name), with the free-text
    // description sent alongside. A typed name that is not in the list sends no id, only the description.
    productId: dropdownId(options, "products", form.chaDescription),
    productDescription: clean(form.desc) || clean(form.chaDescription),
    noOfCartons:
      cartons !== undefined && Number.isInteger(cartons) && cartons >= 0 ? cartons : undefined,
    netWeight: netWeight !== undefined && netWeight > 0 ? netWeight : undefined,
    beNo: clean(form.be),
    beDate: date(form.beDate),
    beType: clean(form.beType),
    workflowStageId: stageId(stages, form.status),
    statusNotes: clean(form.note),
    // The AGV amount exactly as the user entered it (never recomputed from the lines).
    agvAmount: agvAmount !== undefined && agvAmount >= 0 ? agvAmount : undefined,
    agvLines: agvLines.length || forUpdate ? agvLines : undefined,
    linkedAgencies: linkedAgencies.length || forUpdate ? linkedAgencies : undefined,
  };
  return Object.fromEntries(
    Object.entries(body).filter(([, v]) => v !== undefined && v !== ""),
  ) as ShipmentCreateRequest;
}

/**
 * The edit body for PUT /shipments/updateShipment: every field the create body has, plus the shipment's
 * UUID. The whole form is sent, so a field cleared on the form is simply left out of the body.
 */
export function toUpdateShipmentRequest(
  form: Shipment,
  options: MasterOptions | undefined,
  stages: WorkflowStage[] | undefined,
  shipmentId: string,
): ShipmentUpdateRequest {
  return { shipmentId, ...toCreateShipmentRequest(form, options, stages, true) };
}

/**
 * The workflow stage behind one of the form's document checkboxes: a checkbox stage whose name or display
 * name is the checkbox label, or failing that the checkbox stage with the same step number.
 */
export function checkboxStageId(
  stages: WorkflowStage[] | undefined,
  checkbox: (typeof stageCheckboxes)[number],
): number | undefined {
  const boxes = (stages ?? []).filter((s) => s.isCheckBox && typeof s.id === "number");
  const hit =
    boxes.find((s) => same(s.displayName, checkbox.label) || same(s.name, checkbox.label)) ??
    boxes.find((s) => s.stageNo === checkbox.step);
  return hit?.id ?? undefined;
}

/**
 * One PUT /shipments/updateStage body per document checkbox that changed between `before` and `after`.
 * `missing` lists the checkboxes the server has no stage for, so the caller can say they were not saved.
 */
export function checkboxStageUpdates(
  before: Shipment,
  after: Shipment,
  stages: WorkflowStage[] | undefined,
  shipmentId: string,
): { updates: ShipmentStageUpdateRequest[]; missing: string[] } {
  const updates: ShipmentStageUpdateRequest[] = [];
  const missing: string[] = [];
  for (const box of stageCheckboxes) {
    const isChecked = Boolean(after[box.key]);
    if (isChecked === Boolean(before[box.key])) continue;
    const workflowStageId = checkboxStageId(stages, box);
    if (workflowStageId === undefined) missing.push(box.label);
    else updates.push({ shipmentId, workflowStageId, isChecked });
  }
  return { updates, missing };
}
