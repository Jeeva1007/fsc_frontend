import records from "@/assets/shipments.json";
import type { Warehouse } from "./warehouse";
export type Role = "accountant" | "admin" | "cha" | "receiver" | "shipper";
export const screens = [
  "dashboard",
  "shipments",
  "master",
  "ledger",
  "meeting",
  "users",
  "audit",
  "settings",
  "cha",
] as const;
export type Screen = (typeof screens)[number];
export const titles: Record<Screen, string> = {
  dashboard: "Dashboard",
  shipments: "Shipments",
  master: "Master Records",
  ledger: "Ledger",
  meeting: "Meeting",
  users: "User Management",
  audit: "Audit Logs",
  settings: "Settings",
  cha: "CHA User",
};
export const access: Record<Role, Screen[]> = {
  accountant: ["dashboard", "shipments", "master", "ledger", "meeting"],
  admin: ["dashboard", "shipments", "master", "ledger", "meeting", "users", "audit", "settings"],
  cha: ["dashboard", "shipments", "cha", "meeting"],
  receiver: ["dashboard", "shipments", "master", "meeting"],
  shipper: ["dashboard", "shipments", "ledger", "meeting"],
};
export type User = {
  name: string;
  username: string;
  short: string;
  role: string;
  country: string;
  port: string;
  status?: string;
  password: string;
  /** Receivers only: one or more warehouses with contact details. */
  warehouses?: Warehouse[];
  /** Receivers only: the "Payment alert" note, free text (user request, 2026-11-16). */
  paymentAlert?: string;
  /** Set on members loaded from GET /users (the server never returns passwords): a UUID on the local backend. */
  serverId?: number | string;
  email?: string;
  /** Code of the linked receiver / shipper / CHA from the master data. */
  linked?: string;
  partyId?: number;
  shipperId?: number;
  chaId?: number;
};
export const initialUsers: User[] = [
  {
    name: "Arctic",
    username: "arc",
    short: "Arctic",
    role: "Shipper",
    country: "PL",
    port: "—",
    password: "arctic123",
  },
  {
    name: "AgriFood",
    username: "afnl",
    short: "AFNL",
    role: "Shipper",
    country: "BR",
    port: "BOM",
    password: "afnl123",
  },
  {
    name: "TFA",
    username: "tfadel",
    short: "TFA",
    role: "Receiver",
    country: "IN",
    port: "—",
    password: "tfa123",
    warehouses: [
      {
        id: "wh-tfa-1",
        name: "TFA Chennai Hub",
        location: "Ennore Port Road, Chennai",
        whatsapp: "+91 90000 00001",
      },
      {
        id: "wh-tfa-2",
        name: "TFA Delhi Yard",
        location: "Okhla Industrial Area, New Delhi",
        whatsapp: "+91 90000 00002",
      },
      {
        id: "wh-tfa-3",
        name: "TFA Mumbai Cold Store",
        location: "JNPT Cold Chain Park, Navi Mumbai",
        whatsapp: "+91 90000 00003",
      },
    ],
  },
  {
    name: "RD8",
    username: "robnz",
    short: "Rob",
    role: "Shipper",
    country: "NZ",
    port: "—",
    password: "rob123",
  },
  {
    name: "GFF",
    username: "gffish",
    short: "GFF",
    role: "Receiver",
    country: "IN",
    port: "—",
    password: "shareef",
    warehouses: [
      {
        id: "wh-gff-1",
        name: "GFF Kolkata Godown",
        location: "Kidderpore Docks, Kolkata",
        whatsapp: "+91 90000 00004",
      },
      {
        id: "wh-gff-2",
        name: "GFF Bengaluru Depot",
        location: "Peenya Industrial Estate, Bengaluru",
        whatsapp: "+91 90000 00005",
      },
    ],
  },
  {
    name: "John Doe",
    username: "admin",
    short: "Q",
    role: "Admin",
    country: "IN",
    port: "—",
    password: "56789",
  },
  {
    name: "InterlinkShipping",
    username: "lingam",
    short: "MPT",
    role: "CHA",
    country: "IN",
    port: "BOM",
    password: "mptmpt",
  },
  {
    name: "acnt",
    username: "acnt",
    short: "acnt",
    role: "Accountant",
    country: "IN",
    port: "CHE",
    password: "acnt123",
  },
  {
    name: "TFC",
    username: "tfc",
    short: "TFC",
    role: "Shipper",
    country: "US",
    port: "—",
    password: "tfc123",
  },
  {
    name: "Nargo",
    username: "nri",
    short: "Nargo",
    role: "Shipper",
    country: "US",
    port: "—",
    password: "nargo123",
  },
  {
    name: "FreshPack",
    username: "fp",
    short: "Kam",
    role: "Shipper",
    country: "US",
    port: "—",
    password: "kam123",
  },
];
export const previewRoleProfiles = (users: User[]) =>
  users
    .filter((u) => (u.status || "Active") === "Active")
    .filter(
      (u, index, all) =>
        all.findIndex(
          (profile) =>
            roleFor(profile.role) === roleFor(u.role) && (profile.status || "Active") === "Active",
        ) === index,
    );
/** Maps a member's role to a screen set. Mock only: never production authorization. */
export const roleFor = (memberRole: string): Role =>
  memberRole === "Admin"
    ? "admin"
    : memberRole === "CHA"
      ? "cha"
      : memberRole === "Shipper"
        ? "shipper"
        : memberRole === "Accountant"
          ? "accountant"
          : "receiver";
/** Mock credential check against preview members; inactive members cannot sign in. */
export const findLogin = (users: User[], id: string, key: string) =>
  users.find(
    (u) =>
      u.username.toLowerCase() === id.trim().toLowerCase() &&
      u.password === key &&
      (u.status || "Active") === "Active",
  );
export const canAccess = (role: Role, screen: Screen) => access[role].includes(screen);
export type Shipment = (typeof records.active)[number] & {
  chaDescription?: string;
  cha?: string;
  agency?: string;
  /**
   * The server's `linkedAgencyId` for each agency code in `agency`, exactly as shipmentList gave it, so an
   * update sends those ids back unchanged. A code ticked later in the form is looked up in the dropdown.
   */
  agencyIds?: Record<string, string>;
  /** shipmentList `oxDirectPayment`: the total paid directly to OX. */
  oxDirectPaid?: string;
  /** shipmentList `remainingBalance`: AGV − (GSM + direct OX + TPT used), as the server worked it out. */
  remainingBalance?: string;

  enhancement?: string;
  netWeight?: string;
  /** No. of Cartons, free text. Not sent yet: the backend Shipment has no field for it. */
  cartons?: string;
  liner?: string;
  be?: string;
  beDate?: string;
  beType?: string;
  note?: string;
  finScreenshot?: string;
  breakdown?: CostLine[];
  tptMode?: "full" | "partial";
  tptPartial?: string;
  tptReserved?: string;
  containers?: string;
  /** Set on rows loaded from GET /listing: the server id, stage number, late flag and invoice due. */
  serverId?: number;
  /** The shipment's UUID on the local backend, from createShipment; used by updateShipment and updateStage. */
  serverUuid?: string;
  stageNo?: number;
  isLate?: boolean;
  invoiceDue?: string;
  balanceDueDate?: string;
  reference?: string;
  /** Delivery warehouse, from the receiver's warehouses. The server stores only the id and the WhatsApp. */
  warehouse?: string;
  warehouseLocation?: string;
  warehouseWhatsapp?: string;
  /** The server's id for the chosen warehouse. */
  warehouseId?: string;
  /** The id of the chosen CHA, from GET /ports/{portCode}/chas; `cha` holds its code for display. */
  /** The CHA picked from the POD's list: a number (deployed backend) or a UUID (local backend). */
  chaId?: number | string | undefined;
  awaitingPhysicalDocs?: boolean;
  receivedPhysicalDocs?: boolean;
  physicalDocsSentToCha?: boolean;
  awaitingTelex?: boolean;
  docCheckboxes?: Record<string, boolean>;
};
/** The client ships every product in cartons, so AGV composition lines no longer offer a choice of unit. */
export const DEFAULT_UNIT = "Cartons";
export type CostLine = {
  /** The form's own key for the line (a new line gets a fresh UUID). Not sent to the server. */
  id: string;
  /**
   * The line's id on the server (`agvLines[].id` from shipmentList), set ONLY for a line loaded from the
   * server. updateShipment sends it as `id` so the server updates that line instead of adding a copy; a
   * line added in the form has none and is created.
   */
  serverId?: string;
  product: string;
  unit: string;
  quantity: string;
  cost: string;
};
/** A cost-line field (quantity or price) parsed to a number; thousands separators are tolerated. */
export const lineNumber = (v: string | undefined) =>
  Number(
    String(v ?? "")
      .replace(/,/g, "")
      .trim(),
  );
export const agvTotal = (lines: CostLine[]) =>
  lines.reduce(
    (sum, line) => sum + (lineNumber(line.quantity) || 0) * (lineNumber(line.cost) || 0),
    0,
  );
/** The product lines that count towards AGV: a quantity above zero and a price of zero or more. */
export const pricedLines = (lines: CostLine[] | undefined) =>
  (lines ?? []).filter((l) => {
    const quantity = lineNumber(l.quantity);
    const cost = lineNumber(l.cost);
    return (
      String(l.quantity ?? "").trim() !== "" &&
      String(l.cost ?? "").trim() !== "" &&
      Number.isFinite(quantity) &&
      Number.isFinite(cost) &&
      quantity > 0 &&
      cost >= 0
    );
  });
export const reservedTpt = (total: number, mode: "full" | "partial", partial: number) =>
  mode === "full" ? total : Math.min(total, Math.max(0, partial));
export const entryTypes = ["TPT (Transfer)"] as const;
export const money = (n: number | string | undefined) =>
  Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const statuses = [
  "Shipment created",
  "Passing copy received",
  "Copy documents received",
  "Clearance assigned to CHA",
  "Filed",
  "Ready for delivery",
  "Delivered",
];
export const stageCheckboxes = [
  {
    key: "awaitingPhysicalDocs" as const,
    label: "Awaiting physical documents",
    step: 4,
    role: "Owner",
  },
  {
    key: "receivedPhysicalDocs" as const,
    label: "Received physical documents",
    step: 5,
    role: "Owner",
  },
  {
    key: "physicalDocsSentToCha" as const,
    label: "Physical documents sent to CHA",
    step: 7,
    role: "Owner",
  },
  { key: "awaitingTelex" as const, label: "Awaiting telex", step: 9, role: "Owner" },
] as const;
export function inputDate(value: string) {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const [day, month, year] = value.split("/");
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const m = months.indexOf(month || "");
  return m < 0 || !day || !year
    ? ""
    : `${year.length === 2 ? "20" : ""}${year}-${String(m + 1).padStart(2, "0")}-${day.padStart(2, "0")}`;
}
export function normalizeStatus(st: string): string {
  if (!st) return "Shipment created";
  const l = st.toLowerCase().trim();
  if (l === "ready for delivery") return "Ready for delivery";
  if (l === "clearance assigned" || l === "clearance assigned to cha")
    return "Clearance assigned to CHA";
  if (l === "awaiting documents") return "Copy documents received";
  if (l === "shipment created") return "Shipment created";
  if (l === "passing copy received") return "Passing copy received";
  if (l === "copy documents received") return "Copy documents received";
  if (l === "filed") return "Filed";
  if (l === "delivered") return "Delivered";
  return st;
}
function hydrateShipment(s: (typeof records.active)[number]): Shipment {
  const [be, beDate] = s.ssub.split(" of ");
  const norm = normalizeStatus(s.status);
  const isDelivered = norm === "Delivered";
  const isReady = norm === "Ready for delivery";
  const isFiled = norm === "Filed";
  return {
    ...s,
    status: norm,
    reference: s.ssub || "",
    eta: inputDate(s.eta),
    gsmd: inputDate(s.gsmd),
    bulld: inputDate(s.bulld),
    be: be || "",
    beDate: inputDate(beDate || ""),
    beType: "Ass",
    netWeight: s.dsub.split(" - ")[0] || "",
    cha: "InterlinkShipping",
    chaDescription: s.vase === "HLBU9787118" ? "XF" : /pear/i.test(s.desc) ? "Pears" : "Apple",
    liner:
      s.vase === "HLBU9787118"
        ? "OOCL"
        : s.vase === "SEGU9423661"
          ? "CMA"
          : s.vase === "EGSU5029071"
            ? "Evergreen"
            : "",
    agency: "",
    awaitingPhysicalDocs: isFiled || isReady || isDelivered,
    receivedPhysicalDocs: isFiled || isReady || isDelivered,
    physicalDocsSentToCha: isFiled || isReady || isDelivered,
    awaitingTelex: isReady || isDelivered,
  };
}
export const initialActive: Shipment[] = records.active.map(hydrateShipment);
export const initialMaster: Shipment[] = records.master.map(hydrateShipment);
