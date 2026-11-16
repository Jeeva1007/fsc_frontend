import { uid } from "@/lib/id";
import { Fragment, useContext, useEffect, useRef, useState } from "react";
import { PendingPaymentContext } from "./pending-payment";
import {
  ArrowLeft,
  Check,
  X,
  Download,
  Ellipsis,
  Filter,
  Pencil,
  Plus,
  Save,
  Trash2,
  Wallet,
} from "lucide-react";
import { snackbar } from "@/components/ui/snackbar";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { SearchableSelect } from "@/components/common/form";
import { Badge, Combo, Field, FilterSelect, SearchInput, TextField } from "./fields";
import { latestTransferAmount, transferForFile, type LedgerEntry } from "@/lib/fsc-finance";
import { ShipmentForm } from "./shipment-form";
import { ShipmentView } from "./shipment-view";
import { money, reservedTpt, statuses, type Shipment } from "@/lib/fsc";
import { exportTable, type ExportColumn } from "@/lib/export-table";
import type { ServerPage } from "@/lib/page";
import { displayDate, parseIsoDate } from "@/lib/date-value";
import { TablePagination } from "./table-pagination";
import { useMasterOptions } from "./receiver-directory";
import { dropdownId } from "@/lib/shipment-create";
import { useReserveBalanceQuery } from "@/store/api";
import type { ShipmentPaymentSummaryResponse } from "@/types/api";

/** Shipments / Master Records export: column order matches the row values built at the Export button. */
const SHIPMENT_EXPORT_COLUMNS: ExportColumn[] = [
  "Container",
  "BL No",
  "Status",
  "Reference",
  "Shipper",
  "Receiver",
  { header: "ETA", type: "date" },
  "Dossier No.",
  "POL",
  "POD",
  "Product",
  "Description",
  { header: "AGV", type: "money", total: true },
  { header: "GSM", type: "money", total: true },
  { header: "GSM Date", type: "date" },
  { header: "Bull / OX", type: "money", total: true },
  { header: "OX Date", type: "date" },
  { header: "TPT", type: "money", total: true },
  { header: "Sweet", type: "money", total: true },
  "Invoice",
  "CHA User",
  { header: "Net Weight", type: "number" },
  "Liner",
  "BE No",
  { header: "BE Date", type: "date" },
  "BE Type",
  "Linked Agencies",
  "Enhancement",
];
const showDate = (v: string | undefined) => {
  const d = parseIsoDate(v);
  return d ? displayDate(d) : v || "—";
};
/**
 * When `server` is given, the search box and the status/receiver filters are controlled by the parent and
 * the backend has already filtered `rows` (GET /shipments/shipmentList with search/receiverId/stage), so
 * this table only pages through them. Without it, the three filters work on `rows` in the browser as before.
 */
export type ServerFilter = {
  search: string;
  onSearch: (v: string) => void;
  status: string;
  onStatus: (v: string) => void;
  receiver: string;
  onReceiver: (v: string) => void;
  /** Every receiver to offer in the dropdown, so the choices do not shrink as the list is filtered. */
  receivers: string[];
};

export function ShipmentsTable({
  rows,
  onOpen,
  onUpdate,
  onEdit,
  master = false,
  compact = false,
  query: externalQuery = "",
  server,
  serverPage,
}: {
  rows: Shipment[];
  onOpen: (s: Shipment) => void;
  onUpdate?: (s: Shipment) => void;
  onEdit?: ((s: Shipment) => void) | undefined;
  master?: boolean;
  compact?: boolean;
  query?: string;
  server?: ServerFilter;
  /** When set, the footer pages through the backend instead of slicing `rows` in the browser. */
  serverPage?: ServerPage;
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [receiver, setReceiver] = useState("");
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(10);
  // In server mode the backend already applied search/receiver/status, so show the rows as they arrive;
  // otherwise filter them here. A new server filter resets to the first page (see the effect below).
  const filtered = server
    ? rows
    : rows.filter(
        (s) =>
          (!status || s.status === status) &&
          (!receiver || s.rcv === receiver) &&
          Object.values(s)
            .join(" ")
            .toLowerCase()
            .includes((externalQuery || query).toLowerCase()),
      );
  useEffect(() => {
    if (server) setPage(1);
  }, [server?.search, server?.status, server?.receiver, server]);
  // The toolbar controls bind to the parent in server mode, or to local state otherwise.
  const searchValue = server ? server.search : query;
  const onSearchChange = server
    ? server.onSearch
    : (v: string) => {
        setQuery(v);
        setPage(1);
      };
  const statusValue = server ? server.status : status;
  const onStatusChange = server
    ? server.onStatus
    : (v: string) => {
        setStatus(v);
        setPage(1);
      };
  const receiverValue = server ? server.receiver : receiver;
  const onReceiverChange = server
    ? server.onReceiver
    : (v: string) => {
        setReceiver(v);
        setPage(1);
      };
  const receiverOptions = server ? server.receivers : [...new Set(rows.map((row) => row.rcv))];
  const anyFilter = server
    ? Boolean(server.search || server.status || server.receiver)
    : Boolean(query || status || receiver);
  const clearFilters = () => {
    if (server) {
      server.onSearch("");
      server.onStatus("");
      server.onReceiver("");
    } else {
      setQuery("");
      setStatus("");
      setReceiver("");
    }
    setPage(1);
  };
  const pageSize = compact ? 5 : serverPage ? serverPage.size : size;
  const lastPage = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, lastPage);
  // Server-paged: the rows already are the current page, so show them all. Otherwise slice locally.
  const visible = serverPage
    ? filtered
    : filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  return (
    <div className="panel shipments-panel">
      {!compact && (
        <div className="table-toolbar">
          <SearchInput value={searchValue} onChange={onSearchChange} />
          <FilterSelect
            ariaLabel="Filter status"
            allLabel="All statuses"
            options={statuses}
            value={statusValue}
            onChange={onStatusChange}
          />
          <FilterSelect
            ariaLabel="Filter receiver"
            allLabel="All receivers"
            options={receiverOptions}
            value={receiverValue}
            onChange={onReceiverChange}
          />
          {anyFilter && (
            <Button size="sm" variant="ghost" onClick={clearFilters}>
              Clear
            </Button>
          )}
          <div className="toolbar-end">
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                exportTable({
                  fileName: master ? "master-records" : "shipments",
                  title: master ? "Master Records" : "Shipments",
                  columns: SHIPMENT_EXPORT_COLUMNS,
                  rows: filtered.map((s) => [
                    s.vase,
                    s.vsub,
                    s.status,
                    s.reference || s.ssub || "",
                    s.shp,
                    s.rcv,
                    s.eta,
                    s.dos,
                    s.pol,
                    s.pod,
                    s.chaDescription || "",
                    s.desc,
                    s.agv,
                    s.gsm,
                    s.gsmd,
                    s.bull,
                    s.bulld,
                    s.tp,
                    s.sw,
                    s.inv,
                    s.cha || "",
                    s.netWeight || "",
                    s.liner || "",
                    s.be || "",
                    s.beDate || "",
                    s.beType || "",
                    s.agency || "",
                    s.enhancement || "",
                  ]),
                  totalsLabel: "Total",
                })
              }
            >
              <Download />
              Export
            </Button>
          </div>
        </div>
      )}
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              {(compact
                ? ["Container / BL No", "Status", "Shipper", "Receiver", "ETA", "AGV", "Action"]
                : [
                    "Vase / BL No",
                    "Status",
                    "Shipper",
                    "Receiver",
                    "ETA",
                    "Dossier No.",
                    "POL",
                    "POD",
                    "Product",
                    "Description",
                    "AGV",
                    "GSM",
                    // Payment breakdown and reference stay on Master Records only.
                    ...(master ? ["Bull", "TP", "Sweet", "Reference"] : []),
                    "Action",
                  ]
              ).map((h, i) => (
                <th key={i}>
                  {h}
                  {h === "ETA" && <ChevronDownTiny />}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((s) => (
              <tr key={s.vase}>
                <td>
                  <Button variant="link" className="link-button" onClick={() => onOpen(s)}>
                    {s.vase}
                  </Button>
                  <small>{s.vsub}</small>
                </td>
                <td>
                  {compact ? (
                    <Badge status={s.status} />
                  ) : (
                    <>
                      <SearchableSelect
                        trigger="button"
                        menuPlacement="fixed"
                        className="table-mini-combo"
                        ariaLabel={`Status for ${s.vase}`}
                        options={statuses}
                        value={s.status}
                        onChange={(v) => onUpdate?.({ ...s, status: v })}
                      />
                      {master && <small>{s.reference || s.ssub || "—"}</small>}
                    </>
                  )}
                </td>
                {compact ? (
                  <>
                    <td>{s.shp}</td>
                    <td>{s.rcv}</td>
                    <td>{showDate(s.eta)}</td>
                    <td>{money(s.agv)}</td>
                  </>
                ) : (
                  <>
                    <td>{s.shp}</td>
                    <td>{s.rcv}</td>
                    <td>{showDate(s.eta)}</td>
                    <td>{s.dos}</td>
                    <td>{s.pol}</td>
                    <td>{s.pod}</td>
                    <td>{s.chaDescription || "—"}</td>
                    <td>
                      {s.desc}
                      <small>{s.dsub}</small>
                    </td>
                    <td>{money(s.agv)}</td>
                    <td>
                      {money(s.gsm)}
                      <small>{s.gsmd ? showDate(s.gsmd) : ""}</small>
                    </td>
                    {master && (
                      <>
                        <td>
                          {money(s.bull)}
                          <small>{s.bulld ? showDate(s.bulld) : ""}</small>
                        </td>
                        <td>{money(s.tp)}</td>
                        <td>
                          {money(s.sw)}
                          <small>{s.inv}</small>
                        </td>
                        <td>{s.reference || s.ssub || "—"}</td>
                      </>
                    )}
                  </>
                )}
                <td>
                  {onEdit && (
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={`Edit ${s.vase}`}
                      title="Edit shipment"
                      onClick={() => onEdit(s)}
                    >
                      <Pencil size={14} />
                    </Button>
                  )}
                  {/* The pencil only edits (pop-up); the container number link opens the view screen. */}
                  {compact && (
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={`Open ${s.vase}`}
                      onClick={() => onOpen(s)}
                    >
                      <Ellipsis size={16} />
                    </Button>
                  )}
                </td>
              </tr>
            ))}
            {!visible.length && (
              <tr>
                <td colSpan={compact ? 7 : master ? 17 : 13} className="empty-state">
                  No matching shipments
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <TablePagination
        page={serverPage ? serverPage.page : currentPage}
        pageSize={pageSize}
        total={serverPage ? serverPage.total : filtered.length}
        onPage={serverPage ? serverPage.onPage : setPage}
        {...(compact || (serverPage && !serverPage.onPageSize)
          ? {}
          : {
              onPageSize: serverPage
                ? serverPage.onPageSize
                : (n: number) => {
                    setSize(n);
                    setPage(1);
                  },
            })}
        noun="shipments"
        pageSizes={[10, 25, 50, 100]}
      />
    </div>
  );
}
function ChevronDownTiny() {
  return <span className="ml-2">↓</span>;
}
/**
 * Shows the full value in a tooltip card on hover (and keyboard focus) for values that get truncated.
 * Wraps text or an input; with no value there is nothing to show, so no tooltip opens.
 */
function HoverValue({
  label,
  value,
  focusable = true,
  children,
}: {
  label: string;
  value: string;
  /** False when the child already takes focus (an input). */
  focusable?: boolean;
  children: React.ReactNode;
}) {
  const shown = Boolean(value.trim());
  // The same elements render with or without a value: changing them would rebuild an input being typed in, and lose its focus.
  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip {...(shown ? {} : { open: false })}>
        <TooltipTrigger asChild>
          <span className="hover-value" {...(focusable && shown ? { tabIndex: 0 } : {})}>
            {children}
          </span>
        </TooltipTrigger>
        {shown && (
          <TooltipContent side="top" align="start" className="value-tip">
            <span>{label}</span>
            <strong>{value}</strong>
          </TooltipContent>
        )}
      </Tooltip>
    </TooltipProvider>
  );
}
export type Payment = {
  id: string;
  date: string;
  gsm: string;
  ox: string;
  oxDate: string;
  /** The one reference the server stores. No longer typed here: only shown and sent back unchanged. */
  reference?: string;
  /** Not sent yet: the backend Payment has only `referenceNo`, so these are lost on the next reload. */
  gsmReference?: string;
  oxReference?: string;
  /** This payment was made straight to OX (isOxDirectPayment). */
  directToOx?: boolean;
  /** True for a row loaded from the server (so it updates); a new row is created with id:null. */
  serverSaved?: boolean;
  /** Changed on screen since the last save: included in the next updateShipment. */
  dirty?: boolean;
  notes: string;
  /** Stored on older server records; not shown, only sent back so an edit cannot unlink it. */
  screenshotId?: number;
};
function ReferencePill({
  label,
  value,
  earlier = false,
}: {
  label: string;
  value: string;
  earlier?: boolean;
}) {
  return (
    <HoverValue label={label} value={value}>
      <span className="pay-ref">
        {earlier ? "Earlier: " : ""}
        {value}
      </span>
    </HoverValue>
  );
}
type PaymentActions = {
  save: (p: Payment, existing: Payment[]) => Promise<string | null>;
  remove: (p: Payment) => Promise<string | null>;
};
/** TPT the shipment can reserve: its file's ledger transfer, else Rob's latest transfer. */
const ledgerTptFor = (s: Shipment, tptEntries: LedgerEntry[]) => {
  const fileEntry = transferForFile(tptEntries, s.dos);
  return {
    fileEntry,
    amount: fileEntry
      ? Number(fileEntry.credit) || 0
      : s.shp === "Rob"
        ? latestTransferAmount(tptEntries)
        : 0,
  };
};
/**
 * The overview: everything is view-only. Shipment fields, payments and the TPT reservation are changed
 * only through the Edit Shipment pop-up.
 */
export function ShipmentDetail({
  shipment,
  onBack,
  onSave,
  master,
  payments,
  onPayments,
  availableTpt,
  tptEntries,
  paymentActions,
  onDeletePayment,
  summary,
}: {
  shipment: Shipment;
  onBack: () => void;
  /** May be async. Resolving to a message means the edit was not saved. */
  onSave: (s: Shipment) => unknown;
  master: boolean;
  payments: Payment[];
  onPayments: (p: Payment[]) => void;
  availableTpt: number;
  tptEntries: LedgerEntry[];
  /** When set, add / edit / remove are sent to the server first (each returns an error text, or null). */
  paymentActions?: PaymentActions | undefined;
  onDeletePayment?: (p: Payment) => void;
  summary?: ShipmentPaymentSummaryResponse | undefined;
}) {
  const [form, setForm] = useState(shipment);
  const [edit, setEdit] = useState(false);
  const paymentsFor = (s: Shipment, setS?: (value: Shipment) => void) => (
    <ShipmentPayments
      shipment={s}
      payments={payments}
      onPayments={onPayments}
      paymentActions={paymentActions}
      availableTpt={availableTpt}
      tptEntries={tptEntries}
      {...(onDeletePayment ? { onDeletePayment } : {})}
      {...(summary ? { summary } : {})}
      {...(setS
        ? {
            onReserve: (mode: "full" | "partial", partial: string, reserved: number) =>
              setS({ ...s, tptMode: mode, tptPartial: partial, tptReserved: String(reserved) }),
          }
        : {})}
    />
  );
  return (
    <>
      <div className="page-heading">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft />
          Back to {master ? "Master Records" : "Shipments"}
        </Button>
        <div className="heading-actions">
          <Button onClick={() => setEdit(true)}>
            <Pencil />
            Edit Shipment
          </Button>
        </div>
      </div>
      <div className="detail-body screenshot-details">
        <div className="detail-title">
          <h2>Shipment Details</h2>
          <span className="status-badge success">Shipment ID : {form.vase}</span>
          <Badge status={form.status} />
        </div>
        <ShipmentView shipment={form} tpt={ledgerTptFor(form, tptEntries).amount} />
        {paymentsFor(form)}
      </div>
      {edit && (
        <ShipmentForm
          tpt={ledgerTptFor(form, tptEntries).amount}
          open
          onClose={() => setEdit(false)}
          shipment={form}
          extra={(draft, setDraft) => paymentsFor(draft, setDraft)}
          onSave={async (s) => {
            const problem = await onSave(s);
            if (typeof problem === "string") return problem;
            setForm(s);
            snackbar.success("Shipment updated");
            return null;
          }}
        />
      )}
    </>
  );
}
/**
 * Payments of one shipment plus its TPT reservation. Without `onReserve` the section is view-only (the
 * overview); with it, payments can be added, edited and removed (each saved at once) and the reservation
 * choice goes back into the shipment form, saved with "Save Changes".
 */
export function ShipmentPayments({
  shipment,
  payments,
  onPayments,
  paymentActions,
  availableTpt,
  tptEntries,
  onReserve,
  onDeletePayment,
  summary,
}: {
  shipment: Shipment;
  payments: Payment[];
  onPayments: (p: Payment[]) => void;
  paymentActions?: PaymentActions | undefined;
  availableTpt: number;
  tptEntries: LedgerEntry[];
  onReserve?: (mode: "full" | "partial", partial: string, reserved: number) => void;
  /** Records a saved row removed on screen, so Save Changes can send its id in deletedPaymentIds. */
  onDeletePayment?: (p: Payment) => void;
  /** Server figures from GET /shipmentPayments/paymentSummary (TPT used, totals). */
  summary?: ShipmentPaymentSummaryResponse | undefined;
}) {
  const readOnly = !onReserve;
  // The shipper's TPT reserve balance from GET /tptReserve/reserveBalance, shown in the TPT Reserve block.
  const master = useMasterOptions();
  const reserveShipperId = dropdownId(master, "shippers", shipment.shp);
  // The backend wants EITHER shipperId OR shipmentId, not both — send just the shipper.
  const { data: reserveBalance, isFetching: reserveLoading } = useReserveBalanceQuery(
    { shipperId: reserveShipperId ?? "" },
    { skip: !reserveShipperId },
  );
  const [paymentBusy, setPaymentBusy] = useState(false);
  // A saved payment row was removed here; it leaves the server with "Save Changes" (deletedPaymentIds).
  const [removedSaved, setRemovedSaved] = useState(false);
  const [payment, setPaymentState] = useState<Payment | null>(null);
  // What the open row held when it was opened, to tell whether the user changed anything in it.
  const [paymentStart, setPaymentStart] = useState("");
  // Opening, closing or switching the row starts with no errors.
  const setPayment = (p: Payment | null) => {
    setPaymentState(p);
    setPaymentStart(p ? JSON.stringify(p) : "");
  };
  // Tell the shipment form (its "Save Changes") about a row being entered that the user changed but has
  // not kept with ✓ yet, so the save stops instead of dropping it. An untouched new row does not count.
  const pendingPayment = useContext(PendingPaymentContext);
  const editorRef = useRef<HTMLTableRowElement>(null);
  const paymentChanged = Boolean(payment) && JSON.stringify(payment) !== paymentStart;
  useEffect(() => {
    if (!pendingPayment || readOnly) return;
    pendingPayment.current = paymentChanged
      ? {
          focus: () => {
            const row = editorRef.current;
            row?.scrollIntoView?.({ behavior: "smooth", block: "center" });
            row?.querySelector<HTMLElement>("input")?.focus({ preventScroll: true });
          },
        }
      : null;
    return () => {
      pendingPayment.current = null;
    };
  }, [pendingPayment, paymentChanged, readOnly]);
  const editPayment = (key: keyof Payment, value: string) => {
    if (!payment) return;
    setPaymentState({ ...payment, [key]: value });
  };
  // No TPT mode is chosen until the user picks one (user request): neither radio is pre-selected and
  // nothing is reserved until then.
  const mode = shipment.tptMode;
  const partial = shipment.tptPartial || "";
  const { amount: ledgerTpt } = ledgerTptFor(shipment, tptEntries);
  const localReserved = mode ? reservedTpt(ledgerTpt, mode, Number(partial)) : 0;
  const localPaid = payments.reduce((t, p) => t + (Number(p.gsm) || 0), 0);
  // The server's figures are authoritative once the summary has loaded; fall back to the local calc otherwise.
  const agvFig = summary?.agv ?? (Number(shipment.agv) || 0);
  const gsmPaidFig = summary?.gsmPaid ?? localPaid;
  // A server figure (string from shipmentList) as a number, or undefined when the row did not carry it.
  const serverNumber = (v: string | undefined) => {
    const n = Number(
      String(v ?? "")
        .replace(/,/g, "")
        .trim(),
    );
    return (v ?? "").trim() !== "" && Number.isFinite(n) ? n : undefined;
  };
  // Payment rows added, edited or removed on screen and not yet sent with "Save Changes": while there are
  // any, the server's totals are out of date, so the figures below are worked out from the rows instead.
  const paymentsPending = payments.some((p) => p.dirty) || removedSaved;
  // Direct OX Paid: the payment summary's directOxPaid, else shipmentList's oxDirectPayment, else the OX
  // amounts of rows ticked "Direct Payment to OX". It counts towards Total and so reduces Remaining.
  const localDirectOx = payments
    .filter((p) => p.directToOx)
    .reduce((t, p) => t + (Number(String(p.ox ?? "").replace(/,/g, "")) || 0), 0);
  const directOxFig =
    summary?.directOxPaid ??
    (paymentsPending ? undefined : serverNumber(shipment.oxDirectPaid)) ??
    localDirectOx;
  const reserved = summary?.tptUsed ?? localReserved; // TPT Reserve Amount / TPT Used (big number)
  // Total = everything paid against the AGV: GSM Paid + Direct OX Paid + TPT Used.
  // Remaining = the balance still to pay: shipmentList's remainingBalance when nothing is pending on
  // screen, else AGV − Total (never below zero).
  const paidTotal = gsmPaidFig + directOxFig + reserved;
  const serverRemaining = paymentsPending ? undefined : serverNumber(shipment.remainingBalance);
  const totals = {
    paid: gsmPaidFig,
    reserved,
    total: paidTotal,
    remaining: serverRemaining ?? Math.max(0, agvFig - paidTotal),
  };
  const reserve = (m: "full" | "partial", p: string) => {
    // A partial reservation cannot exceed the shipper's available TPT reserve balance.
    if (m === "partial" && (p ?? "").trim() !== "") {
      const amt = Number((p ?? "").replace(/,/g, "").trim());
      if (Number.isFinite(amt) && amt > availableTpt)
        snackbar.error("Not enough TPT reserve balance");
    }
    onReserve?.(m, p, reservedTpt(ledgerTpt, m, Number(p)));
  };
  const amountOf = (v: string | undefined) => {
    const t = (v ?? "").replace(/,/g, "").trim();
    const n = Number(t);
    return t !== "" && Number.isFinite(n) && n > 0 ? n : 0;
  };
  const savePayment = async () => {
    if (!payment || paymentBusy) return;
    // The row needs at least one amount; a direct-to-OX row needs the OX amount it pays.
    const hasGsm = amountOf(payment.gsm) > 0;
    const hasOx = amountOf(payment.ox) > 0;
    if (!hasGsm && !hasOx) {
      snackbar.error("Enter a GSM or an OX amount");
      return;
    }
    if (payment.directToOx && !hasOx) {
      snackbar.error("Enter the OX amount for a direct OX payment");
      return;
    }
    if (paymentActions) {
      setPaymentBusy(true);
      const problem = await paymentActions.save(payment, payments);
      setPaymentBusy(false);
      if (problem) {
        snackbar.error("Payment not saved", { description: problem });
        return;
      }
    }
    // Marked dirty so it is included in the next updateShipment (Save Changes). No per-row API call.
    const saved = { ...payment, dirty: true };
    onPayments(
      payments.some((x) => x.id === saved.id)
        ? payments.map((x) => (x.id === saved.id ? saved : x))
        : [...payments, saved],
    );
    setPayment(null);
    snackbar.success("Payment saved", paymentActions ? { description: "Saved to the server" } : {});
  };
  const removePayment = async (p: Payment) => {
    if (paymentBusy) return;
    if (paymentActions) {
      setPaymentBusy(true);
      const problem = await paymentActions.remove(p);
      setPaymentBusy(false);
      if (problem) {
        snackbar.error("Payment not removed", { description: problem });
        return;
      }
    } else if (p.serverSaved) {
      // Remember a saved row's id so Save Changes sends it in deletedPaymentIds.
      onDeletePayment?.(p);
      setRemovedSaved(true);
    }
    onPayments(payments.filter((x) => x.id !== p.id));
    snackbar.success("Payment removed");
  };
  const columns = ["GSM Date", "GSM", "GSM Reference", "OX", "OX Date", "OX Reference", "Notes"];
  if (!readOnly) columns.push("Actions");
  // The inline payment editor (input row + its Direct-to-OX checkbox row). Rendered in place of the row being
  // edited, or at the bottom for a brand-new payment, so the fields always open where the user clicked.
  const editorBlock = payment && !readOnly && (
    <>
      <tr
        ref={editorRef}
        className="payment-edit-row"
        // Enter saves the payment instead of submitting the surrounding shipment form.
        onKeyDown={(e) => {
          if (e.key !== "Enter" || !(e.target instanceof HTMLInputElement)) return;
          e.preventDefault();
          void savePayment();
        }}
      >
        <td>
          <TextField
            ariaLabel="GSM Date"
            type="date"
            value={payment.date}
            onChange={(v) => editPayment("date", v)}
          />
        </td>
        <td>
          <TextField
            ariaLabel="GSM Amount"
            type="number"
            placeholder="TP/GSM Paid"
            value={payment.gsm}
            onChange={(v) => editPayment("gsm", v)}
          />
        </td>
        <td>
          <HoverValue label="GSM Reference" value={payment.gsmReference || ""} focusable={false}>
            <TextField
              ariaLabel="GSM Reference"
              placeholder="GSM Reference"
              value={payment.gsmReference || ""}
              onChange={(v) => editPayment("gsmReference", v)}
            />
          </HoverValue>
          {payment.reference && <small className="pay-earlier">Earlier: {payment.reference}</small>}
        </td>
        <td>
          <TextField
            ariaLabel="OX Amount"
            type="number"
            placeholder="OX Paid"
            value={payment.ox}
            onChange={(v) => editPayment("ox", v)}
          />
        </td>
        <td>
          <TextField
            ariaLabel="OX Date"
            type="date"
            value={payment.oxDate}
            onChange={(v) => editPayment("oxDate", v)}
          />
        </td>
        <td>
          <HoverValue label="OX Reference" value={payment.oxReference || ""} focusable={false}>
            <TextField
              ariaLabel="OX Reference"
              placeholder="OX Reference"
              value={payment.oxReference || ""}
              onChange={(v) => editPayment("oxReference", v)}
            />
          </HoverValue>
        </td>
        <td>
          <TextField
            ariaLabel="Payment Notes"
            placeholder="Notes"
            value={payment.notes}
            onChange={(v) => editPayment("notes", v)}
          />
        </td>
        <td>
          <Button
            type="button"
            size="icon"
            aria-label="Save Payment"
            title="Save payment"
            disabled={paymentBusy}
            onClick={() => void savePayment()}
          >
            <Check />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            aria-label="Cancel payment"
            onClick={() => setPayment(null)}
          >
            <X />
          </Button>
        </td>
      </tr>
      <tr className="payment-direct-row">
        <td colSpan={columns.length}>
          <label className="pay-direct-ox-check">
            <input
              type="checkbox"
              checked={Boolean(payment.directToOx)}
              onChange={(e) =>
                setPaymentState(payment ? { ...payment, directToOx: e.target.checked } : payment)
              }
            />
            Direct Payment to OX
          </label>
        </td>
      </tr>
    </>
  );
  return (
    <section className="pay" aria-label="Payments">
      <header className="pay-head">
        <span className="pay-icon" aria-hidden="true">
          <Wallet size={18} />
        </span>
        <div>
          <h2>
            Payments <span className="count">{payments.length}</span>
          </h2>
          <p>
            {readOnly
              ? "GSM and OX payments recorded for this shipment, with the TPT you have reserved. Use “Edit Shipment” to change them."
              : "Payments and the TPT choice are saved with “Save Changes”."}
          </p>
        </div>
        {!readOnly && (
          <Button
            type="button"
            onClick={() =>
              setPayment({
                id: uid(),
                date: "",
                gsm: "",
                ox: "",
                oxDate: "",
                gsmReference: "",
                oxReference: "",
                directToOx: false,
                notes: "",
              })
            }
          >
            <Plus />
            Add Payment
          </Button>
        )}
      </header>
      <div className="payment-table pay-table">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                {columns.map((x) => (
                  <th key={x}>{x}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {payments.map((p) =>
                payment && !readOnly && p.id === payment.id ? (
                  <Fragment key={p.id}>{editorBlock}</Fragment>
                ) : (
                  <Fragment key={p.id}>
                    <tr className="payment-data-row">
                      <td>{showDate(p.date)}</td>
                      <td className="pay-amount">{money(p.gsm)}</td>
                      <td>
                        {p.gsmReference ? (
                          <ReferencePill label="GSM Reference" value={p.gsmReference} />
                        ) : p.reference ? (
                          <ReferencePill label="Earlier reference" value={p.reference} earlier />
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="pay-amount">{p.ox ? money(p.ox) : "—"}</td>
                      <td>{showDate(p.oxDate)}</td>
                      <td>
                        {p.oxReference ? (
                          <ReferencePill label="OX Reference" value={p.oxReference} />
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="pay-notes">{p.notes || "—"}</td>
                      {!readOnly && (
                        <td>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label="Edit payment"
                            onClick={() => setPayment(p)}
                          >
                            <Pencil />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label="Delete payment"
                            disabled={paymentBusy}
                            onClick={() => void removePayment(p)}
                          >
                            <Trash2 />
                          </Button>
                        </td>
                      )}
                    </tr>
                    <tr className="payment-direct-row readonly">
                      <td colSpan={columns.length}>
                        <label className="pay-direct-ox-check">
                          <input type="checkbox" checked={Boolean(p.directToOx)} readOnly />
                          Direct Payment to OX
                        </label>
                      </td>
                    </tr>
                  </Fragment>
                ),
              )}
              {payment && !readOnly && !payments.some((x) => x.id === payment.id) && (
                <Fragment key="new-payment">{editorBlock}</Fragment>
              )}
              {!payments.length && !payment && (
                <tr>
                  <td colSpan={columns.length} className="empty-state">
                    {readOnly
                      ? "No payments recorded yet. Use “Edit Shipment” to add one."
                      : "No payments recorded yet. Use “Add Payment” to record the first one."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <div className="tpt-reservation pay-tpt">
        <div className="pay-tpt-amount">
          <small>TPT Reserve Amount</small>
          <strong>{money(reserved)}</strong>
          <small>{reserved > 0 ? "From ledger" : "No ledger entry for this file yet"}</small>
          <small>Available TPT: {money(availableTpt)}</small>
          {reserveShipperId && (
            <small className="pay-reserve-balance">
              Shipper reserve balance:{" "}
              <b>{reserveLoading ? "…" : money(reserveBalance?.currentBalance ?? 0)}</b>
            </small>
          )}
        </div>
        {!readOnly && (
          <div className="pay-tpt-options">
            <label className="radio-option">
              <input
                type="radio"
                name="tpt-mode"
                checked={mode === "full"}
                onChange={() => reserve("full", partial)}
              />
              Use Full TPT Amount
            </label>
            <label className="radio-option">
              <input
                type="radio"
                name="tpt-mode"
                checked={mode === "partial"}
                onChange={() => reserve("partial", partial)}
              />
              Use Partial TPT amount
            </label>
            {mode === "partial" && (
              <TextField
                ariaLabel="Partial TPT amount"
                type="number"
                placeholder="Enter amount"
                value={partial}
                onChange={(v) => reserve("partial", v)}
                inputProps={{ className: "partial-input", max: ledgerTpt }}
              />
            )}
          </div>
        )}
      </div>
      <div className="payment-summary pay-summary" aria-label="Payment summary">
        {(
          [
            ["AGV", agvFig],
            ["GSM Paid", totals.paid],
            ["Direct OX Paid", directOxFig],
            ["TPT Used", totals.reserved],
            ["Total", totals.total],
            ["Remaining", totals.remaining],
          ] as const
        ).map(([label, value]) => (
          <div key={label} className={label === "Remaining" ? "pay-remaining" : undefined}>
            <span>{label}</span>
            <strong>{money(value)}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}
export function RoleShipmentsTable({
  rows,
  kind,
  onOpen,
  onEdit,
  onDelete,
}: {
  rows: Shipment[];
  kind: "shipper" | "cha";
  onOpen: (s: Shipment) => void;
  onEdit: (s: Shipment) => void;
  onDelete?: (s: Shipment) => void;
}) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [pol, setPol] = useState("");
  const [q2, setQ2] = useState("");
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(10);
  const f = rows.filter(
    (s) =>
      (!status || s.status === status) &&
      (!pol || s.pol.toLowerCase().includes(pol.toLowerCase())) &&
      [q, q2].every((t) => Object.values(s).join(" ").toLowerCase().includes(t.toLowerCase())),
  );
  const currentPage = Math.min(page, Math.max(1, Math.ceil(f.length / size)));
  const visible = f.slice((currentPage - 1) * size, currentPage * size);
  const heads =
    kind === "shipper"
      ? [
          "Container No",
          "Status",
          "Receiver",
          "ETA",
          "POL",
          "POD",
          "Description",
          "Amount",
          "Actions",
        ]
      : ["Liner", "Vase", "ETA", "CHA Status", "POL", "CHA Description", "Actions"];
  return (
    <div className="panel shipments-panel">
      <div className="table-toolbar">
        <SearchInput
          value={q}
          onChange={(v) => {
            setQ(v);
            setPage(1);
          }}
        />
        {kind === "shipper" ? (
          <FilterSelect
            ariaLabel="Filter status"
            allLabel="All statuses"
            options={statuses}
            value={status}
            onChange={(v) => {
              setStatus(v);
              setPage(1);
            }}
          />
        ) : (
          <>
            <FilterSelect
              ariaLabel="CHA Status"
              allLabel="All"
              options={statuses}
              value={status}
              onChange={(v) => {
                setStatus(v);
                setPage(1);
              }}
            />
            {/* <input aria-label="POL" placeholder="e.g. SHANGHAI" value={pol} onChange={e=>setPol(e.target.value)}/> */}
            {/* <input aria-label="Search liner or container" placeholder="Liner, Container..." value={q2} onChange={e => setQ2(e.target.value)} /> */}
          </>
        )}
        <Button
          size="sm"
          variant="ghost"
          className="text-destructive"
          onClick={() => {
            setQ("");
            setStatus("");
            setPol("");
            setQ2("");
            setPage(1);
          }}
        >
          Clear
        </Button>
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              {heads.map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((s) => (
              <tr key={s.vase}>
                {kind === "shipper" ? (
                  <>
                    <td>
                      <Button variant="link" className="link-button" onClick={() => onOpen(s)}>
                        {s.vase}
                      </Button>
                    </td>
                    <td>
                      <Badge status={s.status} />
                    </td>
                    <td>{s.rcv}</td>
                    <td>{showDate(s.eta)}</td>
                    <td>{s.pol}</td>
                    <td>{s.pod}</td>
                    <td>{s.desc}</td>
                    <td className="font-semibold">{money(s.agv)}</td>
                    <td>
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label={`Edit ${s.vase}`}
                        onClick={() => onEdit(s)}
                      >
                        <Pencil size={14} />
                      </Button>
                      {onDelete && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="text-destructive"
                          aria-label={`Delete ${s.vase}`}
                          onClick={() => onDelete(s)}
                        >
                          <Trash2 size={14} />
                        </Button>
                      )}
                    </td>
                  </>
                ) : (
                  <>
                    <td>{s.liner || ""}</td>
                    <td>{s.vase}</td>
                    <td>{showDate(s.eta)}</td>
                    <td>
                      <Badge status={s.status} />
                    </td>
                    <td>{s.pol}</td>
                    <td>
                      {s.chaDescription || ""}
                      <small>{s.dos}</small>
                    </td>
                    <td>
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label={`Edit ${s.vase}`}
                        onClick={() => onEdit(s)}
                      >
                        <Pencil size={14} />
                      </Button>
                    </td>
                  </>
                )}
              </tr>
            ))}
            {!f.length && (
              <tr>
                <td colSpan={heads.length} className="empty-state">
                  No matching shipments
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <TablePagination
        page={currentPage}
        pageSize={size}
        total={f.length}
        onPage={setPage}
        onPageSize={(n) => {
          setSize(n);
          setPage(1);
        }}
        pageSizes={[10, 25, 50, 100]}
        noun="shipments"
      />
    </div>
  );
}
