import { toIsoDate } from "./date-value";

/**
 * Demo switch for the Audit Logs screen. While true the screen shows the sample rows below and sends no
 * audit requests. Set it to false to use GET /audit; nothing else has to change.
 */
export const USE_SAMPLE_AUDIT_LOGS = true;

const OWNER = "owner@fsc.example";
const ACCOUNTS = "accounts@fsc.example";
const SHIPPER = "arctic.shipper@fsc.example";
const RECEIVER = "tfa.receiver@fsc.example";
const CHA = "mpt.cha@fsc.example";
const NAMES: Record<string, string> = {
  [OWNER]: "Rajesh Kumar",
  [ACCOUNTS]: "Priya Nair",
  [SHIPPER]: "Arctic Shipping",
  [RECEIVER]: "TFA Trading",
  [CHA]: "MPT Clearing",
};

type SampleRow = Record<string, unknown> & {
  hoursAgo: number;
  tableName: string;
  userName: string;
};

// One story across the app: a shipment moving from request to delivery, plus payments, the TPT ledger,
// members, master data and sign-ins. Same shape as a GET /audit row, so it goes through fromAuditItem.
const ROWS: SampleRow[] = [
  {
    hoursAgo: 0.4,
    userName: OWNER,
    action: "LOGIN",
    tableName: "user_sessions",
    details: "Signed in to the workspace",
    ipAddress: "203.0.113.24",
  },
  {
    hoursAgo: 1.1,
    userName: CHA,
    action: "UPDATE",
    tableName: "shipments",
    rowKey: "SEGU9423661",
    oldValues: { status: "Filed" },
    newValues: { status: "Ready for delivery" },
  },
  {
    hoursAgo: 1.6,
    userName: CHA,
    action: "UPDATE",
    tableName: "shipments",
    rowKey: "SEGU9423661",
    oldValues: { beNo: null, beDate: null, beType: null },
    newValues: { beNo: "9466051", beDate: "2026-10-29", beType: "RMS" },
  },
  {
    hoursAgo: 2.3,
    userName: ACCOUNTS,
    action: "CREATE",
    tableName: "shipment_payments",
    rowKey: "SEGU9423661",
    newValues: {
      kind: "BALANCE",
      gsmAmount: "18,400.00",
      oxAmount: "6,450.00",
      referenceNo: "GSM-2026-0641",
    },
  },
  {
    hoursAgo: 3.5,
    userName: OWNER,
    action: "APPROVE",
    tableName: "shipment_requests",
    rowKey: "MSKU7731204",
    details: "Approved the request from Arctic and added it to Active shipments",
  },
  {
    hoursAgo: 4.2,
    userName: SHIPPER,
    action: "CREATE",
    tableName: "shipment_requests",
    rowKey: "MSKU7731204",
    newValues: { receiver: "TFA", pol: "PL", pod: "BOM", agv: "24,850.00" },
  },
  {
    hoursAgo: 5,
    userName: RECEIVER,
    action: "LOGIN_FAILED",
    tableName: "user_sessions",
    details: "Incorrect password",
    ipAddress: "198.51.100.17",
  },
  {
    hoursAgo: 6.4,
    userName: OWNER,
    action: "UPDATE",
    tableName: "shipments",
    rowKey: "HLBU9787118",
    oldValues: { deliveryWarehouse: "TFA Chennai Hub", warehouseWhatsapp: "+91 90000 00001" },
    newValues: { deliveryWarehouse: "TFA Delhi Yard", warehouseWhatsapp: "+91 90000 00002" },
  },
  {
    hoursAgo: 8,
    userName: ACCOUNTS,
    action: "REVERSAL",
    tableName: "shipment_payments",
    rowKey: "HLBU9787118",
    oldValues: { gsmAmount: "2,500.00" },
    newValues: { gsmAmount: "0.00" },
    details: "Entered against the wrong shipment",
  },
  {
    hoursAgo: 11,
    userName: OWNER,
    action: "UPDATE",
    tableName: "shipments",
    rowKey: "TGHU5540127",
    oldValues: { pod: "BOM", cha: "MPT" },
    newValues: { pod: "CHE", cha: "InterlinkShipping" },
  },
  {
    hoursAgo: 23,
    userName: ACCOUNTS,
    action: "CREATE",
    tableName: "ledger_entries",
    rowKey: "TPT-KAM-0630",
    newValues: { type: "TPT transfer", shipper: "Rob", credit: "32,000.00" },
  },
  {
    hoursAgo: 26,
    userName: OWNER,
    action: "UPDATE",
    tableName: "shipments",
    rowKey: "SEGU9423661",
    oldValues: { tptMode: "Full", tptReserved: "12,000.00" },
    newValues: { tptMode: "Partial", tptReserved: "7,500.00" },
  },
  {
    hoursAgo: 29,
    userName: CHA,
    action: "UPDATE",
    tableName: "shipment_documents",
    rowKey: "SEGU9423661",
    oldValues: { receivedPhysicalDocuments: "No" },
    newValues: { receivedPhysicalDocuments: "Yes" },
  },
  {
    hoursAgo: 31,
    userName: OWNER,
    action: "UPDATE",
    tableName: "shipments",
    rowKey: "SEGU9423661",
    oldValues: { status: "Copy documents received" },
    newValues: { status: "Clearance assigned to CHA", cha: "MPT" },
  },
  {
    hoursAgo: 34,
    userName: OWNER,
    action: "UPDATE",
    tableName: "users",
    rowKey: "mpt.cha",
    oldValues: { active: "Active", password: "previous" },
    newValues: { active: "Inactive", password: "changed" },
    details: "Member deactivated and temporary password reset",
  },
  {
    hoursAgo: 46,
    userName: OWNER,
    action: "CREATE",
    tableName: "users",
    rowKey: "tfa.receiver",
    newValues: { fullName: "TFA Imports", role: "Receiver", linkedReceiver: "TFA" },
  },
  {
    hoursAgo: 50,
    userName: RECEIVER,
    action: "LOGOUT",
    tableName: "user_sessions",
    details: "Signed out",
    ipAddress: "198.51.100.17",
  },
  {
    hoursAgo: 52,
    userName: OWNER,
    action: "REJECT",
    tableName: "shipment_requests",
    rowKey: "CAIU2219043",
    details: "Rejected: invoice number does not match the bill of lading",
  },
  {
    hoursAgo: 56,
    userName: ACCOUNTS,
    action: "CREATE",
    tableName: "shipment_payments",
    rowKey: "SEGU9423661",
    newValues: {
      kind: "ADVANCE",
      gsmAmount: "6,000.00",
      oxAmount: "2,100.00",
      referenceNo: "GSM-2026-0622",
    },
  },
  {
    hoursAgo: 71,
    userName: OWNER,
    action: "UPDATE",
    tableName: "deals",
    rowKey: "PI 4700",
    oldValues: { containers: "2", agv: "48,200.00" },
    newValues: { containers: "3", agv: "72,300.00" },
  },
  {
    hoursAgo: 75,
    userName: OWNER,
    action: "DELETE",
    tableName: "warehouses",
    rowKey: "GFF Kolkata Godown",
    oldValues: { location: "Dum Dum, Kolkata" },
    details: "Warehouse removed from GFF",
  },
  {
    hoursAgo: 94,
    userName: OWNER,
    action: "CREATE",
    tableName: "master_records",
    rowKey: "ports/KOL",
    newValues: { list: "Ports", code: "KOL", name: "Kolkata" },
  },
  {
    hoursAgo: 99,
    userName: SHIPPER,
    action: "UPDATE",
    tableName: "shipments",
    rowKey: "SEGU9423661",
    oldValues: { eta: "2026-10-22", vessel: "CMA Rhone" },
    newValues: { eta: "2026-10-27", vessel: "CMA Danube" },
  },
  {
    hoursAgo: 118,
    userName: OWNER,
    action: "CREATE",
    tableName: "shipments",
    rowKey: "SEGU9423661",
    newValues: {
      dossierNo: "62874",
      shipper: "TFC",
      receiver: "TFA",
      product: "Apple",
      agv: "24,850.00",
    },
  },
  {
    hoursAgo: 120,
    userName: OWNER,
    action: "UPDATE",
    tableName: "cost_config",
    rowKey: "G_ex",
    oldValues: { value: "83.10" },
    newValues: { value: "83.45" },
  },
  {
    hoursAgo: 142,
    userName: OWNER,
    action: "UPDATE",
    tableName: "workspace_settings",
    details: "Headline changed to “Port congestion please clear ASAP”",
  },
];

export const sampleAuditTables = [...new Set(ROWS.map((r) => r.tableName))];
export const sampleAuditActors = [...new Set(ROWS.map((r) => r.userName))].map((email) => ({
  value: email,
  label: NAMES[email] ?? email,
}));

/** The sample rows, newest first, dated relative to `now` so a demo always looks current. */
export function sampleAuditPage(
  filters: { table: string; actor: string; from: string; to: string; page: number; size: number },
  now = Date.now(),
) {
  const matching = ROWS.map(({ hoursAgo, ...row }) => ({
    ...row,
    actorName: NAMES[row.userName],
    actorEmail: row.userName,
    changedAt: new Date(now - hoursAgo * 3_600_000).toISOString(),
  })).filter((row) => {
    const day = toIsoDate(new Date(row.changedAt));
    return (
      (!filters.table || row.tableName === filters.table) &&
      (!filters.actor || row.userName === filters.actor) &&
      (!filters.from || day >= filters.from) &&
      (!filters.to || day <= filters.to)
    );
  });
  const start = (filters.page - 1) * filters.size;
  return { items: matching.slice(start, start + filters.size), total: matching.length };
}
