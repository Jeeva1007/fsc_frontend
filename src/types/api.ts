import type { CostConfig } from "@/lib/fsc-cost";
import type { LedgerEntry } from "@/lib/fsc-finance";
import type { Preferences } from "@/lib/fsc-workspace";
import type { Role, Shipment, User } from "@/lib/fsc";

/** Domain models re-exported so API code shares one source of truth with the UI. */
export type { CostConfig, LedgerEntry, Preferences, Role, Shipment, User };

export type Payment = {
  id: string;
  date: string;
  gsm: string;
  ox: string;
  oxDate: string;
  reference?: string;
  notes: string;
};
export type Weather = { temp: string; high: string };

/** POST /auth/login body (backend `SignIn`). Limits mirror the OpenAPI schema; the server enforces them. */
export type LoginRequest = { username: string; password: string };
/** Backend `Me`: the cookie session has no bearer token. Roles: OWNER, ACCOUNTANT, RECEIVER, SHIPPER, CHA. */
export type Me = {
  signedIn: boolean;
  /** A number from the deployed backend; text (e.g. a UUID) from the newer local backend. */
  id: number | string | null;
  displayName: string | null;
  role: string | null;
  mustChangePassword: boolean;
};
export type LoginResponse = Me;
export type SessionUser = Omit<User, "password">;

/** shipment-controller payloads (backend `Shipment`, `AgvLine`, ...). Ids come from /masters/options. */
export type AgvLinePayload = {
  product?: string;
  unit?: string;
  quantity: number;
  unitPrice: number;
};
export type ServiceChoice = { id: number; excessAmount?: number };
export type FirstPayment = {
  kind: "ADVANCE" | "BALANCE";
  gsmAmount?: number;
  gsmPaidOn?: string;
  oxAmount?: number;
  oxPaidOn?: string;
  referenceNo?: string;
  screenshotId?: number;
};
export type ShipmentPayload = {
  containerNo?: string;
  containerCount?: number;
  invoiceNo?: string;
  blNo?: string;
  shippingLineId?: number;
  partyId?: number;
  shipperId?: number;
  eta?: string;
  fileNo?: string;
  originCode?: string;
  podCode?: string;
  chaId?: number;
  fruit?: string;
  description?: string;
  agvTotal?: number;
  agvLines?: AgvLinePayload[];
  linkedServices?: ServiceChoice[];
  netWeight?: number;
  warehouseWhatsapp?: string;
  warehouseId?: string;
  beNo?: string;
  beDate?: string;
  beType?: string;
  statusNote?: string;
  firstPayment?: FirstPayment;
};
export type ShipmentCreated = { id: number };
export type AgvLinesPayload = { agvLines: AgvLinePayload[]; agvTotal?: number };
/** GET /masters/options: option lists keyed by list name; ids are strings in the spec. */
export type MasterOption = { id: string; code?: string; name?: string };
export type MasterOptions = Record<string, MasterOption[]>;
/** A local backend `*_dropdown` row (`DropdownResponse`): ids are UUIDs. */
export type DropdownRow = { id?: string | null; code?: string | null; name?: string | null };
/** GET /shipments/stages_dropdown row (`WorkflowStageResponse`). */
export type WorkflowStage = {
  id?: number | null;
  stageNo?: number | null;
  name?: string | null;
  displayName?: string | null;
  isCheckBox?: boolean | null;
};
/** POST /shipments/create_shipment body (`ShipmentCreateRequest`); every field is optional in the API. */
export type ShipmentCreateRequest = {
  fileNo?: string;
  sequenceNo?: number;
  containerNumber?: string;
  blNo?: string;
  invoiceNo?: string;
  shipperId?: string;
  receiverId?: string;
  warehouseId?: string;
  linerId?: string;
  pol?: string;
  podId?: string;
  chaId?: string;
  eta?: string;
  productId?: string;
  productDescription?: string;
  noOfCartons?: number;
  netWeight?: number;
  beNo?: string;
  beDate?: string;
  beType?: string;
  workflowStageId?: number;
  statusNotes?: string;
  /** The overall AGV amount the user entered (>= 0); sent alongside any itemised `agvLines`. */
  agvAmount?: number;
  agvLines?: {
    id?: string;
    productId?: string;
    product?: string;
    productDescription?: string;
    unit?: string;
    quantity?: number;
    unitPrice?: number;
  }[];
  linkedAgencies?: { linkedAgencyId: string }[];
};
/** PUT /shipments/update_shipment body (`ShipmentUpdateRequest`): the create fields plus the shipment's UUID. */
export type ShipmentUpdateRequest = ShipmentCreateRequest & {
  shipmentId: string;
  beCurrencyCode?: string;
  beValue?: number;
  /** Payment rows to save in the same transaction: a row with an id updates, a row with id:null is created. */
  payments?: ShipmentPaymentUpdateItem[];
  /** Ids of saved payment rows removed on screen; their TPT reserve is given back. */
  deletedPaymentIds?: string[];
  /** TPT reservation choice (owner only). mode = FULL | PARTIAL | NONE. */
  tpt?: ShipmentTptRequest;
};
/** A payment row inside updateShipment. No shipmentId / useFullTptAmount; id is the row id or null (new). */
export type ShipmentPaymentUpdateItem = {
  id?: string | null;
  gsmDate?: string | null;
  gsmTpt?: number | null;
  gsmTptType?: string | null;
  gsmTptReference?: string | null;
  ox?: number | null;
  oxDate?: string | null;
  oxReference?: string | null;
  isOxDirectPayment?: boolean;
  notes?: string | null;
};
/** The TPT reservation choice sent inside updateShipment (owner only). */
export type ShipmentTptRequest = {
  mode: "FULL" | "PARTIAL" | "NONE";
  amount?: number | null;
  date?: string | null;
  referenceNo?: string | null;
  notes?: string | null;
};
/** PUT /shipments/update-stage body (`ShipmentStageUpdateRequest`). */
export type ShipmentStageUpdateRequest = {
  shipmentId: string;
  workflowStageId: number;
  isChecked?: boolean;
};
/** PUT /shipments/update-stage reply (`ShipmentStageUpdateResponse`, unwrapped). */
export type ShipmentStageUpdateResult = {
  shipmentId?: string;
  workflowStageId?: number;
  stageNo?: number;
  stageName?: string;
  displayName?: string;
  isCheckBox?: boolean;
  isChecked?: boolean;
};
/** POST /shipments/create_shipment reply (`ShipmentCreateResponse`, unwrapped). */
/** The same reply shape is returned by create_shipment, update_shipment and GET /shipments/{id}. */
export type ShipmentCreateResult = {
  id?: string;
  fileNo?: string;
  sequenceNo?: number;
  containerNumber?: string;
  agvAmount?: number;
  message?: string;
};
/**
 * One row of GET /shipments/shipmentList. The OpenAPI document types each row as an untyped
 * `Map<String, Object>`, so the field names are not promised: read them defensively.
 */
export type ShipmentListItem = Record<string, unknown>;
/** Optional filters and paging for GET /users/usersList; all are omitted when not set. */
export type UserListArgs = {
  /** Matches full name, username, display name or role (2–50 chars). */
  search?: string;
  /** Role code: OWNER | ACCOUNTANT | RECEIVER | SHIPPER | CHA (empty = all). */
  role?: string;
  /** active | inactive (empty = all). */
  status?: string;
  page?: number;
  size?: number;
};
/** Optional filters and paging for GET /shipments/shipmentList; all are omitted when not set. */
export type ShipmentListArgs = {
  tab?: string;
  shipperId?: string;
  receiverId?: string;
  pod?: string;
  stage?: number;
  etaFrom?: string;
  etaTo?: string;
  search?: string;
  sort?: string;
  page?: number;
  size?: number;
};
/** GET /products row. Shipments store the name (`fruit`), not the id. */
export type ProductRow = { id?: string; name?: string | null };
/** GET /ports/{portCode}/chas row: one per CHA user, so a CHA with several users appears more than once. */
export type PortCha = {
  /** A number from the deployed backend, a UUID from the local one. */
  chaId?: number | string;
  userId?: number;
  username?: string | null;
  displayName?: string | null;
  fullName?: string | null;
  email?: string | null;
  chaCode?: string | null;
  chaName?: string | null;
  portCode?: string | null;
  portName?: string | null;
};
/** Paged response used by the listing endpoints (backend `PageResultMapStringObject`). Row fields are untyped in the spec. */
export type PageResult<T = Record<string, unknown>> = {
  items: T[];
  total: number;
  page: number;
  size: number;
};
/** GET /audit query (all optional). The page is 0-based on the server. */
export type AuditParams = {
  from?: string;
  to?: string;
  userId?: number;
  table?: string;
  rowKey?: string;
  page?: number;
  size?: number;
};
/** GET /listing query (all optional). `sort` defaults to "eta,desc" on the server. */
export type ListingParams = {
  tab?: string;
  shipperId?: number;
  partyId?: number;
  pod?: string;
  stage?: number;
  etaFrom?: string;
  etaTo?: string;
  search?: string;
  sort?: string;
  page?: number;
  size?: number;
};
/** GET/PUT /shipments/{id} return an untyped object in the OpenAPI document. */
export type ShipmentRecord = Record<string, unknown>;

/** Generic envelope; adjust once the backend response shape is confirmed. */
export type ApiList<T> = { data: T[]; total?: number };
export type ListParams = { page?: number; limit?: number; search?: string };

/** user-controller: GET /users rows (backend `UserRow`). Roles: OWNER, ACCOUNTANT, RECEIVER, SHIPPER, CHA. */
/**
 * GET /users and GET /users/{id} item. The local backend's Swagger leaves it untyped (`CommonResponse.data`),
 * so every field is optional; ids are UUIDs there and numbers on the deployed backend.
 */
export type UserRow = {
  id?: number | string;
  username?: string;
  fullName?: string;
  displayName?: string;
  role?: string;
  active?: boolean;
  email?: string;
  country?: string;
  countryId?: string;
  countryCode?: string;
  location?: string;
  linkedCode?: string;
  entityCode?: string;
  /** A Receiver's free-text payment alert, once the backend returns it. */
  paymentAlert?: string;
  partyId?: number;
  shipperId?: number;
  chaId?: number;
  portIds?: unknown;
  warehouses?: unknown;
  mustChangePassword?: boolean;
  isLocked?: boolean;
  createdAt?: string;
};
/** POST /warehouses/create body (backend `WarehouseCreate`). */
export type WarehouseCreate = {
  partyId: number;
  name?: string;
  address?: string;
  /** "+" then 8-15 digits, nothing else. */
  whatsappNumber?: string;
  whatsappOptedInOn?: string;
  isActive: boolean;
};
/** PUT /warehouses/update body (backend `WarehouseUpdate`). */
export type WarehouseUpdate = WarehouseCreate & { warehouseId: string };
/** warehouse-controller response (backend `WarehouseRow`). */
export type WarehouseRow = Partial<WarehouseCreate> & {
  id?: string;
  createdBy?: number;
  createdAt?: string;
};
/** POST /users_create and PUT /users/{id} body (backend `UserForm`); only `role` is required by the schema. */
/** One warehouse inside a user request (`WarehouseRequest`); `name` is required by the API. */
export type WarehouseRequest = {
  id?: string;
  name: string;
  location?: string;
  description?: string;
  whatsappNumber?: string;
  whatsappOptedInOn?: string;
  active?: boolean;
};
/**
 * POST /users_create and PUT /updateUser body (`UserManagementRequest`). `username`, `displayName` and
 * `role` are required; an update also carries the user's `id` (UUID). Limits: username 60, displayName and
 * fullName 120, email 160, password 6-72, location 120.
 */
export type UserRequest = {
  id?: string;
  username: string;
  /** Short code (<=20): the entity code for company roles, else the username. */
  code?: string;
  displayName: string;
  fullName?: string;
  email?: string;
  password?: string;
  role: string;
  countryId?: string;
  location?: string;
  active?: boolean;
  paymentAlertDays?: number;
  /**
   * A Receiver's "Payment alert", free text (user request, 2026-11-16). Not in the backend's
   * UserManagementRequest yet (it has only the whole-number `paymentAlertDays`); the backend must add it.
   */
  paymentAlert?: string;
  commercialTerms?: string;
  eta?: string;
  warehouses?: WarehouseRequest[];
  /** A CHA's PODs (UUIDs from the POD list). */
  portIds?: string[];
};

/** PUT /shipments/{id}/checks body (backend `ChecksForm`): the four document-stage checkboxes. */
export type ChecksPayload = {
  chkAwaitingPhysDocs?: boolean;
  chkReceivedPhysDocs?: boolean;
  chkPhysDocsToCha?: boolean;
  chkAwaitingTelex?: boolean;
};
/** PUT /shipments/{id}/stage body (backend `StageForm`). */
export type StagePayload = { stageNo: number };
/** GET /stages row (backend `StageRow`). */
export type StageRow = { no?: number; name?: string; isCheckbox?: boolean; updatedBy?: string };

/** payment-controller (OpenAPI `Payment` / `Side` / `PaymentRow` / `Reversal`). */
export type PaymentKind = "ADVANCE" | "BALANCE";
/** POST /shipments/{id}/payments body. */
export type PaymentBody = {
  kind: PaymentKind;
  gsmAmount?: number;
  gsmPaidOn?: string;
  oxAmount?: number;
  oxPaidOn?: string;
  /** <= 60 characters. */
  referenceNo?: string;
  screenshotId?: number;
};
/** PUT /shipments/{id}/payments/{paymentId} body: same as PaymentBody without `kind`. */
export type PaymentSide = Omit<PaymentBody, "kind">;
export type PaymentRecord = {
  id: number;
  kind?: string;
  gsmAmount?: number;
  gsmPaidOn?: string;
  oxAmount?: number;
  oxPaidOn?: string;
  referenceNo?: string;
  screenshotId?: number;
  /** Set on the entry that cancels another payment. */
  reversesId?: number | null;
  /** True once a reversal exists for this payment. */
  reversed?: boolean;
  dateInferred?: boolean;
  createdBy?: string;
  createdAt?: string;
};
/** POST .../reversal body; the note is <= 60 characters. */
export type ReversalBody = { note?: string };

// gsm-ox-ledger (local Swagger, 2026-11-11): save/edit one GSM-OX Deal Ledger / Debit Advice entry.
// Numbers are plain numbers; dates are ISO yyyy-mm-dd. All fields optional; the backend validates.
export type GsmOxLedgerLineRequest = {
  id?: string;
  rowVersion?: number;
  blNo?: string;
  customsPortCode?: string;
  containerNumbers?: string;
  beNo?: string;
  beDate?: string;
  beCurrencyCode?: string;
  beValue?: number;
  ref?: string;
  invoiceNo?: string;
  party?: string;
  fruit?: string;
  noOfCartons?: number;
  netWeight?: number;
  noOfContainers?: number;
  beClosureStatus?: string;
  shipperName?: string;
  fwToTptPaidOn?: string;
  fwToTptCurrencyCode?: string;
  fwToTptCurrencyValue?: number;
  dutyPaidBe?: number;
};
export type GsmOxLedgerRequest = {
  id?: string;
  rowVersion?: number;
  entryDate?: string;
  partyName?: string;
  currencyCode?: string;
  tolRefNo?: string;
  billOrOrmNo?: string;
  containerReference?: string;
  currencyValue?: number;
  inrRate?: number;
  amountInr?: number;
  ormMinusBe?: number;
  paymentStatus?: string;
  matchedTo?: string;
  lines?: GsmOxLedgerLineRequest[];
};
/** One line of a saved ledger entry, as returned by the server. */
export type GsmOxLedgerLineResponse = {
  id?: string;
  lineNo?: number;
  rowVersion?: number;
  blNo?: string | null;
  customsPortCode?: string | null;
  containerNumbers?: string | null;
  beNo?: string | null;
  beDate?: string | null;
  beCurrencyCode?: string | null;
  beValue?: number | null;
  ref?: string | null;
  invoiceNo?: string | null;
  party?: string | null;
  fruit?: string | null;
  noOfCartons?: number | null;
  netWeight?: number | null;
  noOfContainers?: number | null;
  beClosureStatus?: string | null;
  shipperName?: string | null;
  fwToTptPaidOn?: string | null;
  fwToTptCurrencyCode?: string | null;
  fwToTptCurrencyValue?: number | null;
  dutyPaidBe?: number | null;
};
/** createLedger / updateLedger / ledgerList item (envelope unwrapped by baseApi): a saved entry, with its id. */
export type GsmOxLedgerResponse = {
  id?: string;
  rowVersion?: number;
  entryDate?: string | null;
  partyName?: string | null;
  currencyCode?: string | null;
  tolRefNo?: string | null;
  billOrOrmNo?: string | null;
  containerReference?: string | null;
  currencyValue?: number | null;
  inrRate?: number | null;
  amountInr?: number | null;
  ormMinusBe?: number | null;
  paymentStatus?: string | null;
  matchedTo?: string | null;
  lines?: GsmOxLedgerLineResponse[];
};
/**
 * POST /gsmOxLedger/matchedEntries body: every ledger entry for one BE No. or ORM No. (view only, no
 * paging). Reply = GsmOxLedgerResponse[] (envelope unwrapped by baseApi). `number` max 50 characters.
 */
export type MatchedEntriesRequest = { searchType: "BE" | "ORM"; number: string };
/** GET /gsmOxLedger/cards reply (schema GsmOxLedgerCardsResponse): the GSM - OX Deal Ledger cards. */
export type GsmOxLedgerCardsResponse = {
  totalPurchase?: number;
  dealCount?: number;
  containerCount?: number;
  paidToShippers?: number;
  dueToShippers?: number;
  totalOx?: number;
  dueFromOx?: number;
  gsmMargin?: number;
};
/** Optional filters + paging for GET /gsmOxLedger/ledgerList. */
export type GsmOxLedgerListArgs = {
  search?: string;
  party?: string;
  shipper?: string;
  beClosureStatus?: string;
  paymentStatus?: string;
  financialYear?: string;
  page?: number;
  size?: number;
};

// tptReserve (local Swagger, 2026-11-12): record a TPT transfer entry that reserves TPT for a shipper.
// POST /tptReserve/addEntry. Required: shipperId, entryDate, amount (> 0).
export type TptTransferRequest = {
  shipperId: string;
  entryDate: string;
  amount: number;
  /** Entry category, e.g. "TPT (Transfer)" (<= 20 chars). */
  entryCategory?: string;
  /** ISO 4217 currency code, e.g. "USD". */
  currencyCode?: string;
  route?: string;
  referenceNo?: string;
  note?: string;
};
/** GET /tptReserve/reserveBalance query params (both optional UUIDs). */
export type ReserveBalanceArgs = { shipperId?: string; shipmentId?: string };
/** GET /tptReserve/reserveBalance reply (envelope unwrapped by baseApi): a shipper's TPT reserve balance. */
export type TptReserveBalanceResponse = {
  shipperId?: string;
  tptReserveId?: string;
  currentBalance?: number;
  lastEntryNo?: number;
  updatedAt?: string;
};
/** POST /tptReserve/addEntry reply (envelope unwrapped by baseApi): the saved entry + running balance. */
export type TptEntryResponse = {
  entryNo?: number;
  tptReserveId?: string;
  shipperId?: string;
  entryType?: string;
  amount?: number;
  currencyCode?: string;
  signedAmount?: number;
  balanceAfter?: number;
  entryDate?: string;
  route?: string;
  referenceNo?: string;
  note?: string;
  createdAt?: string;
};

// shipment-payments (local Swagger, 2026-11-12). Payment rows are saved/updated as an ARRAY: a row with an
// `id` is updated, a row without `id` is created (so create omits every id).
export type ShipmentPaymentRequest = {
  id?: string;
  shipmentId?: string;
  gsmDate?: string;
  gsmTpt?: number;
  gsmTptType?: string;
  gsmTptReference?: string;
  useFullTptAmount?: boolean;
  ox?: number;
  oxDate?: string;
  oxReference?: string;
  isOxDirectPayment?: boolean;
  notes?: string;
};
export type ShipmentPaymentResponse = {
  id?: string;
  shipmentId?: string;
  gsmDate?: string | null;
  gsmTpt?: number | null;
  gsmTptType?: string | null;
  gsmTptReference?: string | null;
  ox?: number | null;
  oxDate?: string | null;
  oxReference?: string | null;
  isOxDirectPayment?: boolean | null;
  notes?: string | null;
  tptEntryNo?: number | null;
  tptReserveBalance?: number | null;
};
/** GET /shipmentPayments/paymentSummary reply (envelope unwrapped): rows + AGV/totals + TPT balance. */
export type ShipmentPaymentSummaryResponse = {
  shipmentId?: string;
  shipperId?: string;
  // null for a non-owner (e.g. an accountant): the TPT section is then hidden and no `tpt` is sent.
  availableTptBalance?: number | null;
  agv?: number;
  gsmPaid?: number;
  oxPaid?: number;
  directOxPaid?: number;
  tptUsed?: number | null;
  tptAmountForFull?: number | null;
  payments?: ShipmentPaymentResponse[];
};

/** GET /shipperAccount/statement args: the shipper's UUID, plus an optional date window. */
export type ShipperAccountStatementArgs = {
  shipperId: string;
  /** yyyy-MM-dd; payments before it become the opening total. */
  fromDate?: string;
  toDate?: string;
};
/** Opening / closing block of the statement: the total paid brought / carried forward. */
export type ShipperAccountBalance = {
  amount?: number;
  description?: string;
};
/** The shipment a statement payment belongs to. */
export type ShipperAccountShipment = {
  shipmentId?: string;
  fileNo?: string | null;
  fileLabel?: string | null;
  containerNumber?: string | null;
  variety?: string | null;
  beNo?: string | null;
  blNo?: string | null;
};
/**
 * One statement line (GET /shipperAccount/statement, schema `Transaction`). `transactionType` = CHARGE (a
 * container's AGV, in `charge`) | GSM | TPT | the direct OX type (a payment, in `paid`). `balance` = the
 * running balance after the line. The backend lists the lines newest first.
 */
export type ShipperAccountTransaction = {
  serialNo?: number;
  transactionId?: string;
  transactionType?: string;
  shipmentPaymentId?: string | null;
  transactionDate?: string | null;
  isDateAssumed?: boolean;
  description?: string;
  referenceNo?: string | null;
  charge?: number | null;
  paid?: number | null;
  balance?: number | null;
  notes?: string | null;
  shipment?: ShipperAccountShipment | null;
  postedBy?: string | null;
  postedAt?: string | null;
  updatedAt?: string | null;
};
/**
 * GET /shipperAccount/statement reply (schema `ShipperStatementResponse`): the shipper's AGV charges and
 * GSM / TPT / direct OX payments with the running balance. `openingBalance` is the TPT reserve balance (its
 * own description says so) and `closingBalance` the balance to be paid to the shipper.
 */
export type ShipperAccountStatementResponse = {
  shipper?: { shipperId?: string; shipperCode?: string; shipperName?: string };
  period?: { fromDate?: string | null; toDate?: string | null };
  currency?: string;
  generatedAt?: string;
  openingBalance?: ShipperAccountBalance;
  transactions?: ShipperAccountTransaction[];
  summary?: {
    transactionCount?: number;
    containerCount?: number;
    totalCharges?: number;
    gsmCount?: number;
    totalGsm?: number;
    tptCount?: number;
    totalTpt?: number;
    oxDirectCount?: number;
    totalOxDirect?: number;
    totalPaid?: number;
    balance?: number;
  };
  closingBalance?: ShipperAccountBalance;
};
/** GET /shipperAccount/summary reply: the summary tiles of a shipper's account (from the Swagger schema). */
export type ShipperAccountSummaryResponse = {
  shipperId?: string;
  shipperCode?: string;
  shipperName?: string;
  isActive?: boolean;
  openingBalance?: number;
  containerCount?: number;
  agvMissingCount?: number;
  totalAgv?: number;
  totalGsm?: number;
  gsmPaymentCount?: number;
  averageGsmPerContainer?: number;
  totalTransfers?: number;
  transferCount?: number;
  transfersByRoute?: { route?: string; amount?: number; count?: number }[];
  totalAdjustments?: number;
  totalTptUsed?: number;
  nonUsdEntryCount?: number;
  reserveBalance?: number;
  closingBalance?: number;
  balanceStatus?: string;
};
/** One row of GET /shipperAccount/containers: a container's AGV, GSM advance, net after advance and %. */
export type ShipperAccountContainerResponse = {
  shipmentId?: string;
  fileNo?: string;
  sequenceNo?: number;
  fileLabel?: string;
  containersInFile?: number;
  containerNumber?: string;
  blNo?: string;
  variety?: string;
  eta?: string | null;
  agv?: number;
  isAgvMissing?: boolean;
  gsmAdvance?: number;
  gsmPaymentCount?: number;
  lastGsmDate?: string | null;
  directOxPaid?: number;
  tptUsed?: number;
  netAfterAdvance?: number;
  advancePct?: number;
  balanceDue?: number;
};
