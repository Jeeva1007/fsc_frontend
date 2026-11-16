import { normalizeStatus, type Shipment } from "./fsc";
import { toShipmentPayload } from "./shipment-api";
import type { ChecksPayload, MasterOptions, ShipmentPayload, StageRow } from "@/types/api";

export type ShipmentSyncPlan = {
  /** PUT /shipments/{id}: sent when any mapped field (including AGV lines) changed. */
  body?: ShipmentPayload;
  /** PUT /shipments/{id}/checks: sent when a document-stage checkbox changed. */
  checks?: ChecksPayload;
  /** PUT /shipments/{id}/stage: sent when the status changed to a known stage. */
  stageNo?: number;
  /** The status changed but no server stage has that name, so it cannot be saved to the server. */
  stageMissing?: boolean;
};

const checksOf = (s: Shipment): Required<ChecksPayload> => ({
  chkAwaitingPhysDocs: Boolean(s.awaitingPhysicalDocs),
  chkReceivedPhysDocs: Boolean(s.receivedPhysicalDocs),
  chkPhysDocsToCha: Boolean(s.physicalDocsSentToCha),
  chkAwaitingTelex: Boolean(s.awaitingTelex),
});

const sameName = (a: string, b: string) =>
  normalizeStatus(a).toLowerCase() === normalizeStatus(b).toLowerCase();

/**
 * Works out which server calls an edit needs by comparing the shipment before and after.
 * Edits that touch only local-only data (TPT reservation, payments on screen) produce an empty plan.
 */
export function planShipmentSync(
  prev: Shipment,
  next: Shipment,
  master: MasterOptions | undefined,
  stages: StageRow[] | undefined,
): ShipmentSyncPlan {
  const plan: ShipmentSyncPlan = {};
  const body = toShipmentPayload(next, master);
  if (JSON.stringify(body) !== JSON.stringify(toShipmentPayload(prev, master))) plan.body = body;

  const before = checksOf(prev);
  const after = checksOf(next);
  if (JSON.stringify(before) !== JSON.stringify(after)) plan.checks = after;

  if (prev.status !== next.status) {
    const stage = stages?.find((s) => s.name && sameName(s.name, next.status));
    if (stage?.no !== undefined) plan.stageNo = stage.no;
    else plan.stageMissing = true;
  }
  return plan;
}

export const planIsEmpty = (p: ShipmentSyncPlan) =>
  !p.body && !p.checks && p.stageNo === undefined && !p.stageMissing;
