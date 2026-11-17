import { useEffect, useState } from "react";
import {
  ArrowLeftRight,
  ChevronDown,
  Download,
  Plus,
  Receipt,
  Ship,
  Wallet,
  X,
} from "lucide-react";
import { LedgerCards } from "./ledger-cards";
import { dealLedgerStats, statCards } from "./ledger-card-items";
import { useLedgerCardsQuery } from "@/store/api/ledger.api";
import { snackbar } from "@/components/ui/snackbar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge, TextField } from "./fields";
import { useMasterOptions } from "./receiver-directory";
import { RobStatement } from "./rob-ledger-tables";
import { dropdownId } from "@/lib/shipment-create";
import { useShipperStatementQuery, useShipperSummaryQuery } from "@/store/api/shipper-account.api";
import { LedgerTransferForm } from "./ledger-transfer-form";
import { money, type Shipment } from "@/lib/fsc";
import type { ShipperAccountStatementResponse } from "@/types/api";
import { exportTable } from "@/lib/export-table";
import { shipmentsForShipper, transferTotal, type LedgerEntry } from "@/lib/fsc-finance";
import { blankDeal, blankEntry, initialDeals, type Deal } from "./ledger-data";
import { LEDGER_ENTRY_TAB, useLedgerEntry } from "./ledger-entry";
import type { DebitAdvice } from "@/lib/debit-advice";
import type { LedgerServerPage } from "@/lib/page";
import { useStoredView } from "@/lib/stored-view";
import { balanceClass, usePages } from "./ledger-table-utils";
import { TablePagination } from "./table-pagination";
function ShipperLedger({
  shipper,
  shipments,
  isAdmin = false,
  entries = [],
  onEntries,
}: {
  shipper: { code: string; name: string };
  shipments: Shipment[];
  isAdmin?: boolean;
  entries?: import("@/lib/fsc-finance").LedgerEntry[];
  onEntries?: (e: import("@/lib/fsc-finance").LedgerEntry[]) => void;
}) {
  // No Containers tab for anyone (user request, 2026-11-16): the Owner's view from "Select Shipper"
  // (isAdmin) adds TPT entries, a signed-in shipper's own ledger has the statement only.
  const tabs = isAdmin ? ["Statements", "Add TPT Entry"] : ["Statements"];
  // The open tab survives a page refresh (user request, 2026-11-16).
  const [view, setView] = useStoredView(
    isAdmin ? "ledger.shipperView" : "ledger.ownView",
    "Statements",
    (v) => tabs.includes(v),
  );
  const [entry, setEntry] = useState(blankEntry);
  // The shipper's UUID feeds the live /shipperAccount endpoints; resolved from the shipper dropdown.
  const master = useMasterOptions();
  const shipperId = dropdownId(master, "shippers", shipper.code);
  const ownShipments = shipmentsForShipper(shipments, shipper.code, shipper.name);
  const agv = ownShipments.reduce((sum, s) => sum + (Number(s.agv) || 0), 0);
  const gsm = ownShipments.reduce((sum, s) => sum + (Number(s.gsm) || 0), 0);
  const tpt = ownShipments.reduce((sum, s) => sum + (Number(s.tptReserved ?? s.tp) || 0), 0);
  // The four tiles bind GET /shipperAccount/summary; until it loads (or with no shipper UUID) they show
  // the totals worked out from the local shipment records above.
  const { data: summary } = useShipperSummaryQuery(shipperId ?? "", { skip: !shipperId });
  const tiles = {
    count: summary?.containerCount ?? ownShipments.length,
    agv: summary?.totalAgv ?? agv,
    gsm: summary?.totalGsm ?? gsm,
    tpt: summary?.totalTptUsed ?? tpt,
  };
  // Tile subtitles: the summary's counts once it has loaded, otherwise the local-record wording.
  const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
  const sub = summary
    ? {
        count: "Containers on this account",
        agv: summary.agvMissingCount
          ? `${plural(summary.agvMissingCount, "container")} without AGV`
          : "AGV recorded on every container",
        // The average per container and the transfer count were dropped (user request, 2026-11-16).
        gsm: plural(summary.gsmPaymentCount ?? 0, "GSM payment"),
        tpt: `Of ${money(summary.totalTransfers ?? 0)}`,
      }
    : {
        count: "Active and master records",
        agv: "From your shipment records",
        gsm: "Recorded shipment payments",
        tpt: "Recorded shipment transfers",
      };
  return (
    <>
      <h2 className="ledger-title">{shipper.name} Ledger</h2>
      <LedgerCards
        label={`${shipper.name} ledger summary`}
        items={[
          {
            label: "Shipments",
            value: tiles.count,
            sub: sub.count,
            icon: <Ship />,
            tone: "primary",
          },
          {
            label: "AGV",
            value: money(tiles.agv),
            sub: sub.agv,
            icon: <Receipt />,
            tone: "warning",
          },
          {
            label: "GSM paid",
            value: money(tiles.gsm),
            sub: sub.gsm,
            icon: <Wallet />,
            tone: "success",
          },
          {
            label: "TPT used",
            value: money(tiles.tpt),
            sub: sub.tpt,
            icon: <ArrowLeftRight />,
            tone: "success",
          },
        ]}
      />
      <div className="tab-bar ledger-tabs">
        {tabs.map((v) => (
          <Button
            variant="ghost"
            key={v}
            className={view === v ? "selected" : ""}
            onClick={() => setView(v)}
          >
            {v}
          </Button>
        ))}
      </div>
      {view === "Add TPT Entry" && isAdmin ? (
        <LedgerTransferForm
          ledgerName={`${shipper.name} Ledger`}
          shipperCode={shipper.code}
          entry={entry}
          setEntry={setEntry}
          onAdd={(added) => {
            onEntries?.([...(entries || []), added]);
            setView("Statements");
          }}
        />
      ) : (
        <ShipperStatement
          shipper={shipper}
          shipments={ownShipments}
          shipperId={shipperId}
          // Only the Owner opens a ledger from "Select Shipper" (isAdmin); a shipper's own view hides file numbers.
          showFileNo={isAdmin}
        />
      )}
    </>
  );
}

/**
 * A statement line's `transactionType` as one of the kinds the screen shows: CHARGE (a container's AGV),
 * GSM, TPT or direct OX (payments). The backend names CHARGE, GSM and TPT exactly; the direct OX type's
 * spelling is not in the Swagger, so any type mentioning OX counts.
 */
function paymentKind(type?: string | null): "CHARGE" | "GSM" | "TPT" | "OX" | "" {
  const t = (type ?? "").trim().toUpperCase();
  if (t === "CHARGE" || t.startsWith("CHARGE")) return "CHARGE";
  if (t === "GSM" || t.startsWith("GSM")) return "GSM";
  if (t === "TPT" || t.startsWith("TPT")) return "TPT";
  if (/(^|[^A-Z])OX([^A-Z]|$)|OXDIRECT|DIRECTOX/.test(t)) return "OX";
  return "";
}
const PAYMENT_KIND_LABEL = {
  CHARGE: "Charge",
  GSM: "GSM",
  TPT: "TPT",
  OX: "Direct OX",
  "": "Entry",
} as const;

/** Chip colour for an entry type: a charge is amber, a payment that reduces the balance green. */
const PAYMENT_KIND_CLASS = {
  CHARGE: "charge",
  GSM: "advance",
  TPT: "transfer",
  OX: "info",
  "": "info",
} as const;

/**
 * The statement's Entry cell: the entry type as a chip, a dash, then the file number, nothing else (user
 * request, 2026-11-16). With no file number, just the chip; only the Owner is given file numbers.
 */
function EntryCell({
  label,
  tone,
  fileNo,
}: {
  label: string;
  tone: string;
  fileNo?: string | null | undefined;
}) {
  const file = fileNo?.trim();
  return (
    <td className="rob-desc">
      <span className={`entry-chip ${tone}`}>{label}</span>
      {file ? `- ${file}` : null}
    </td>
  );
}

/** A local-fallback entry kind (CHARGE | ADVANCE | TRANSFER) as the Entry label. */
function entryKindLabel(kind?: string): string {
  if (!kind) return "Entry";
  return kind
    .split("_")
    .map((w) =>
      ["TPT", "GSM", "OX", "BE"].includes(w) ? w : w.charAt(0) + w.slice(1).toLowerCase(),
    )
    .join(" ");
}

/**
 * Statements tab: the only table there since Design A (the summary table) was removed (user request,
 * 2026-11-16). With the live reply
 * (GET /shipperAccount/statement) it lists the shipper's payments in date order — GSM, TPT and direct OX —
 * with the running total paid between the "brought forward" and "carried forward" rows. Before the call
 * loads (or with no shipper UUID) it shows the local running-balance view: AGV charges less payments.
 */
function ShipperStatement({
  shipper,
  shipments,
  shipperId,
  showFileNo,
}: {
  shipper: { code: string; name: string };
  shipments: Shipment[];
  shipperId?: string | undefined;
  /** The Owner sees "TPT - <file no>"; everyone else only the type (user request, 2026-11-16). */
  showFileNo: boolean;
}) {
  const { data } = useShipperStatementQuery({ shipperId: shipperId ?? "" }, { skip: !shipperId });
  // Keyed by shipper, so picking another shipper starts on page 1.
  if (data?.transactions)
    return (
      <PaymentStatement key={shipper.code} shipper={shipper} data={data} showFileNo={showFileNo} />
    );
  return (
    <LocalStatement
      key={shipper.code}
      shipper={shipper}
      shipments={shipments}
      showFileNo={showFileNo}
    />
  );
}

/**
 * The live statement (GET /shipperAccount/statement): AGV charges and GSM / TPT / direct OX payments with the
 * running balance, in the backend's order (newest first). Charges (+) = `charge`, Paid (−) = `paid`,
 * Balance = `balance`. The first row shows the reply's `openingBalance` (the TPT reserve balance) and the last
 * its `closingBalance` (the balance to be paid to the shipper), each with the reply's own description.
 */
function PaymentStatement({
  shipper,
  data,
  showFileNo,
}: {
  shipper: { code: string; name: string };
  data: ShipperAccountStatementResponse;
  showFileNo: boolean;
}) {
  const transactions = data.transactions ?? [];
  const summary = data.summary;
  const opening = data.openingBalance?.amount ?? 0;
  const ofKind = (kind: "GSM" | "TPT" | "OX") =>
    transactions.filter((t) => paymentKind(t.transactionType) === kind);
  const paidOf = (kind: "GSM" | "TPT" | "OX") =>
    ofKind(kind).reduce((n, t) => n + (t.paid ?? 0), 0);
  // The summary's own figures when present; otherwise added up from the rows.
  const breakdown = [
    ["GSM", summary?.totalGsm ?? paidOf("GSM"), summary?.gsmCount ?? ofKind("GSM").length],
    ["TPT", summary?.totalTpt ?? paidOf("TPT"), summary?.tptCount ?? ofKind("TPT").length],
    [
      "Direct OX",
      summary?.totalOxDirect ?? paidOf("OX"),
      summary?.oxDirectCount ?? ofKind("OX").length,
    ],
  ] as const;
  const containers =
    summary?.containerCount ??
    transactions.filter((t) => paymentKind(t.transactionType) === "CHARGE").length;
  const totalCharges =
    summary?.totalCharges ?? transactions.reduce((n, t) => n + (t.charge ?? 0), 0);
  const totalPaid = summary?.totalPaid ?? transactions.reduce((n, t) => n + (t.paid ?? 0), 0);
  const closing = data.closingBalance?.amount ?? summary?.balance ?? totalCharges - totalPaid;
  // Paged (user request, 2026-11-16); the opening and closing rows stay on every page as the summary.
  const { visible, pagination } = usePages(transactions);
  return (
    <div className="panel shipments-panel rob-panel stmt-panel">
      <div className="panel-header">
        <StatementHeading
          name={shipper.name}
          label={data.openingBalance?.description || "Opening balance"}
          amount={opening}
        />
        <p>
          Newest first — container charges increase the balance, GSM, TPT / direct OX payments
          reduce it
        </p>
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              {STATEMENT_HEADS.map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((t, i) => {
              const kind = paymentKind(t.transactionType);
              const isCharge = kind === "CHARGE";
              const balance = t.balance ?? 0;
              return (
                <tr key={t.transactionId || `${t.serialNo ?? ""}-${i}`}>
                  <td>
                    {t.transactionDate || "—"}
                    {t.isDateAssumed && <small className="stmt-flag">date assumed</small>}
                  </td>
                  <EntryCell
                    label={
                      kind ? PAYMENT_KIND_LABEL[kind] : t.transactionType || PAYMENT_KIND_LABEL[""]
                    }
                    tone={PAYMENT_KIND_CLASS[kind]}
                    fileNo={showFileNo ? t.shipment?.fileNo || t.shipment?.fileLabel : null}
                  />
                  {/* A charge line always shows its AGV, even 0.00 (no AGV entered yet). */}
                  <td className={t.charge ? "amt-charge" : "rob-none"}>
                    {isCharge || t.charge ? money(t.charge ?? 0) : "—"}
                  </td>
                  <td className={t.paid ? "amt-paid" : "rob-none"}>
                    {t.paid ? money(t.paid) : "—"}
                  </td>
                  <td className={balanceClass(balance)}>{money(balance)}</td>
                </tr>
              );
            })}
            {!transactions.length && (
              <tr>
                <td colSpan={5} className="empty-state">
                  No statement entries for this shipper yet.
                </td>
              </tr>
            )}
            <tr className="stmt-close">
              <td />
              <td className="font-semibold">
                {data.closingBalance?.description || "Closing balance"}
                <small>
                  {[
                    `${containers} ${containers === 1 ? "container" : "containers"}`,
                    ...breakdown.map(([name, amount, n]) => `${name} ${money(amount)} (${n})`),
                  ].join(" · ")}
                </small>
              </td>
              <td className="amt-charge">{money(totalCharges)}</td>
              <td className="amt-paid">{money(totalPaid)}</td>
              <td className={balanceClass(closing)}>{money(closing)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <TablePagination {...pagination} noun="entries" />
    </div>
  );
}

/**
 * The statement's heading with its opening balance under it (user request, 2026-11-16): moved out of the
 * table so it reads as the starting point, e.g. "TPT reserve balance 17,485.00".
 */
function StatementHeading({
  name,
  label,
  amount,
}: {
  name: string;
  label: string;
  amount: number;
}) {
  return (
    <div className="stmt-heading">
      <h2>Statement · {name}</h2>
      <p>
        {label} <strong className={balanceClass(amount)}>{money(amount)}</strong>
      </p>
    </div>
  );
}

/** Column headings of the Statement · <shipper> table (live and fallback), as the client asked (2026-11-13). */
const STATEMENT_HEADS = ["Date", "Entry", "Charges (+)", "Paid (−)", "Balance"];

/** Fallback before the statement loads: a running balance from the local shipment records. */
function LocalStatement({
  shipper,
  shipments,
  showFileNo,
}: {
  shipper: { code: string; name: string };
  shipments: Shipment[];
  showFileNo: boolean;
}) {
  type Row = {
    key: string;
    date: string;
    kind: string;
    fileNo: string;
    charge: number;
    paid: number;
    balance: number;
  };
  const rows: Row[] = [];
  let running = 0;
  shipments.forEach((s) => {
    const agv = Number(s.agv) || 0;
    const gsm = Number(s.gsm) || 0;
    const tpt = Number(s.tptReserved ?? s.tp) || 0;
    if (agv) {
      running += agv;
      rows.push({
        key: `${s.vase}-c`,
        date: s.eta,
        kind: "CHARGE",
        fileNo: s.dos,
        charge: agv,
        paid: 0,
        balance: running,
      });
    }
    if (gsm) {
      running -= gsm;
      rows.push({
        key: `${s.vase}-a`,
        date: s.gsmd,
        kind: "ADVANCE",
        fileNo: s.dos,
        charge: 0,
        paid: gsm,
        balance: running,
      });
    }
    if (tpt) {
      running -= tpt;
      rows.push({
        key: `${s.vase}-t`,
        date: s.bulld || s.gsmd,
        kind: "TRANSFER",
        fileNo: s.dos,
        charge: 0,
        paid: tpt,
        balance: running,
      });
    }
  });
  const totalCharge = rows.reduce((t, r) => t + r.charge, 0);
  const totalPaid = rows.reduce((t, r) => t + r.paid, 0);
  const closing = totalCharge - totalPaid;
  const { visible: shown, pagination } = usePages(rows);
  return (
    <div className="panel shipments-panel rob-panel stmt-panel">
      <div className="panel-header">
        <StatementHeading name={shipper.name} label="Opening balance" amount={0} />
        <p>
          Entries in date order — charges increase the balance, advances and transfers reduce it
        </p>
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              {STATEMENT_HEADS.map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.key}>
                <td>{r.date || "—"}</td>
                <EntryCell
                  label={entryKindLabel(r.kind)}
                  tone={
                    r.kind === "CHARGE" ? "charge" : r.kind === "ADVANCE" ? "advance" : "transfer"
                  }
                  fileNo={showFileNo ? r.fileNo : null}
                />
                <td className={r.charge ? "amt-charge" : "rob-none"}>
                  {r.charge ? money(r.charge) : "—"}
                </td>
                <td className={r.paid ? "amt-paid" : "rob-none"}>{r.paid ? money(r.paid) : "—"}</td>
                <td className={balanceClass(r.balance)}>{money(r.balance)}</td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={5} className="empty-state">
                  No statement entries yet.
                </td>
              </tr>
            )}
            <tr className="stmt-close">
              <td />
              <td className="font-semibold">Closing balance</td>
              <td className="amt-charge">{money(totalCharge)}</td>
              <td className="amt-paid">{money(totalPaid)}</td>
              <td className={balanceClass(closing)}>{money(closing)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <TablePagination {...pagination} noun="entries" />
    </div>
  );
}
/**
 * The GSM–OX tab's Deals, Payment register and New deal views are hidden at the user's request (2026-11-10).
 * Set this to true to show them again; the code is kept as is.
 */
const SHOW_DEAL_VIEW = false;

export function Ledger({
  entries,
  onEntries,
  shipments,
  shipper,
  ledgerEntry,
}: {
  entries: LedgerEntry[];
  onEntries: (entries: LedgerEntry[]) => void;
  shipments: Shipment[];
  shipper?: { code: string; name: string } | undefined;
  /** Given to the Owner, who adds ledger entries the way the Accountant does. */
  ledgerEntry?:
    | {
        advices: DebitAdvice[];
        onAdvices: (advices: DebitAdvice[]) => void;
        serverPage?: LedgerServerPage;
      }
    | undefined;
}) {
  // The open tab or picked shipper survives a page refresh (user request, 2026-11-16).
  const [tab, setTab] = useStoredView(
    "ledger.tab",
    "GSM - OX Deal Ledger",
    (v) =>
      v === "GSM - OX Deal Ledger" ||
      (v === LEDGER_ENTRY_TAB && Boolean(ledgerEntry)) ||
      v.endsWith(" Account Ledger"),
  );
  const master = useMasterOptions();
  // Once the shipper list has loaded, a remembered shipper that is no longer in it falls back to the deals.
  useEffect(() => {
    const shippers = master?.["shippers"];
    if (!shippers?.length || !tab.endsWith(" Account Ledger")) return;
    const offered = shippers.map((o) => `${(o.code || o.name || "").trim()} Account Ledger`);
    if (!offered.includes(tab)) setTab("GSM - OX Deal Ledger");
  }, [master, tab, setTab]);
  // GSM - OX Deal Ledger cards (Owner); not fetched for a shipper's own ledger view (403 for that role).
  const { data: ledgerCards } = useLedgerCardsQuery(undefined, { skip: Boolean(shipper) });
  const {
    form: entryForm,
    table: entryTable,
    openNew: openNewEntry,
  } = useLedgerEntry({
    entries,
    onEntries,
    debitAdvices: ledgerEntry?.advices ?? [],
    onDebitAdvices: ledgerEntry?.onAdvices ?? (() => {}),
    showForm: () => setTab(LEDGER_ENTRY_TAB),
    showTable: () => setTab("GSM - OX Deal Ledger"),
    ...(ledgerEntry?.serverPage ? { serverPage: ledgerEntry.serverPage } : {}),
  });
  const [robView, setRobView] = useStoredView(
    "ledger.robView",
    "Statement",
    (v) => v === "Statement" || v === "Add TPT Entry",
  );
  const [dealView, setDealView] = useState("Deals");
  const [entry, setEntry] = useState(blankEntry);
  const [deals, setDeals] = useState(initialDeals);
  const [draft, setDraft] = useState<Deal | null>(null);
  const [dealId, setDealId] = useState("d2");
  const debits = entries.reduce((sum, e) => sum + e.debit, 0);
  const advances = entries
    .filter((e) => e.type === "GSM advance")
    .reduce((sum, e) => sum + e.credit, 0);
  const transfers = transferTotal(entries);
  const purchase = deals.reduce((sum, d) => sum + Number(d.value), 0);
  const paid = deals.reduce(
    (sum, d) => sum + (d.finalPaid ? Number(d.value) : Number(d.buy1) + Number(d.buy2)),
    0,
  );
  const margin = deals.reduce((sum, d) => sum + Number(d.adjustment), 0);
  const selected = deals.find((d) => d.id === dealId) || deals[0];
  const stats =
    tab === "Rob Account Ledger"
      ? [
          {
            label: "Containers charged (AGV)",
            value: debits,
            sub: `${shipments.length} containers`,
            tone: "warning",
          },
          { label: "GSM advances", value: advances, sub: "Payments to shippers", tone: "success" },
          {
            label: "Transfers (Shipper)",
            value: transfers,
            sub: "KAM · VG · Direct",
            tone: "success",
          },
          {
            label: "Closing balance",
            value: debits - advances - transfers,
            sub:
              debits - advances - transfers < 0
                ? "Rob holds GSM’s money"
                : "Balance payable to Rob",
            tone: debits - advances - transfers < 0 ? "destructive" : "",
          },
        ]
      : // The five deal cards come from GET /gsmOxLedger/cards (a dash until it loads).
        dealLedgerStats(ledgerCards);
  const dealField = (
    label: string,
    key: keyof Deal,
    type = "text",
    placeholder?: string,
    required = false,
  ) =>
    draft && (
      <TextField
        label={label}
        value={String(draft[key])}
        type={type}
        placeholder={placeholder}
        required={required}
        onChange={(v) => setDraft({ ...draft, [key]: v })}
      />
    );
  if (shipper) return <ShipperLedger shipper={shipper} shipments={shipments} />;
  // Shippers to offer come ONLY from the Add Shipment "Shipper" dropdown (GET /shipments/shipperDropdown,
  // via master options), de-duplicated (user request, 2026-11-12). No hardcoded "Rob" entry. A backend
  // shipper actually named "Rob" still opens the Rob transfer ledger via `isRob` below.
  const ledgerOptions = [
    ...new Set(
      (master?.["shippers"] ?? []).map((o) => (o.code || o.name || "").trim()).filter(Boolean),
    ),
  ].map((s) => `${s} Account Ledger`);
  const isDeal = tab === "GSM - OX Deal Ledger";
  const isRob = tab === "Rob Account Ledger";
  const isEntry = tab === LEDGER_ENTRY_TAB;
  const ledgerPicked = !isDeal && !isEntry;
  const selectedShipperName =
    !isDeal && !isRob && !isEntry ? tab.replace(" Account Ledger", "") : null;
  return (
    <>
      <div className="tab-bar ledger-tabs ledger-picker" style={{ alignItems: "center" }}>
        <Button
          variant="ghost"
          className={isDeal ? "selected" : ""}
          onClick={() => setTab("GSM - OX Deal Ledger")}
        >
          GSM - OX Deal Ledger
        </Button>
        {ledgerEntry && (
          <Button
            variant="ghost"
            className={isEntry ? "selected" : ""}
            onClick={() => {
              openNewEntry();
              setTab(LEDGER_ENTRY_TAB);
            }}
          >
            {LEDGER_ENTRY_TAB}
          </Button>
        )}
        <div className="ledger-select">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={`ledger-dropdown-btn ${ledgerPicked ? "selected has-clear" : ""}`}
                aria-label="Select Shipper"
              >
                <span>{ledgerPicked ? tab : "Select Shipper"}</span>
                <ChevronDown size={14} className="dropdown-arrow" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className="min-w-[200px] bg-card border border-border shadow-md"
            >
              {ledgerOptions.map((option) => (
                <DropdownMenuItem
                  key={option}
                  className={`cursor-pointer ${tab === option ? "font-semibold bg-accent text-accent-foreground" : ""}`}
                  onClick={() => setTab(option)}
                >
                  {option}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          {ledgerPicked && (
            <button
              type="button"
              className="ledger-clear"
              aria-label={`Clear ${tab}`}
              title="Clear selected ledger"
              onClick={() => setTab("GSM - OX Deal Ledger")}
            >
              <X size={13} />
            </button>
          )}
        </div>
      </div>
      {isEntry ? (
        entryForm
      ) : selectedShipperName ? (
        <ShipperLedger
          shipper={{ code: selectedShipperName, name: selectedShipperName }}
          shipments={shipments}
          isAdmin
          entries={entries}
          onEntries={onEntries}
        />
      ) : (
        <>
          <h2 className="ledger-title">{tab}</h2>
          <LedgerCards label={`${tab} summary`} items={statCards(stats)} />
          {isRob ? (
            <>
              <div className="tab-bar ledger-tabs">
                {/* No Containers tab: Rob is opened from "Select Shipper" too (user request, 2026-11-16). */}
                {["Statement", "Add TPT Entry"].map((v) => (
                  <Button
                    variant="ghost"
                    key={v}
                    className={robView === v ? "selected" : ""}
                    onClick={() => setRobView(v)}
                  >
                    {v}
                  </Button>
                ))}
              </div>
              {robView === "Add TPT Entry" ? (
                <LedgerTransferForm
                  ledgerName="Rob Account Ledger"
                  shipperCode="Rob"
                  entry={entry}
                  setEntry={setEntry}
                  onAdd={(added) => {
                    onEntries([...entries, added]);
                    setRobView("Statement");
                  }}
                />
              ) : (
                <RobStatement entries={entries} closingBalance={debits - advances - transfers} />
              )}
            </>
          ) : SHOW_DEAL_VIEW ? (
            <>
              <div className="tab-bar ledger-tabs">
                {["Deals", "Payment register", "New deal"].map((v) => (
                  <Button
                    variant="ghost"
                    key={v}
                    className={dealView === v ? "selected" : ""}
                    onClick={() => {
                      setDealView(v);
                      if (v === "New deal") setDraft(blankDeal());
                    }}
                  >
                    {v}
                  </Button>
                ))}
              </div>
              {dealView === "New deal" ? (
                <section className="ledger-form-band">
                  <h2>New deal</h2>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!draft) return;
                      setDeals([...deals, draft]);
                      setDealId(draft.id);
                      setDraft(null);
                      setDealView("Deals");
                      snackbar.success("Deal added");
                    }}
                  >
                    <div className="ledger-form-grid">
                      {dealField("Description", "description", "text", "3 × Gala", true)}
                      {dealField("Containers", "containers", "number", undefined, true)}
                      {dealField("Shipper", "shipper", "text", "e.g. Kam", true)}
                      {dealField("PI number(s)", "pi", "text", "4801 / 4802", true)}
                      {dealField("PI value total (USD)", "value", "number", "90000", true)}
                      {dealField("Invoice adjustment (USD)", "adjustment", "number")}
                      {dealField("Buy · Payment 1 (to shipper)", "buy1", "number", undefined, true)}
                      {dealField("Buy · Payment 2 (to shipper)", "buy2", "number", undefined, true)}
                      {dealField(
                        "Sell · Payment 1 rate per container",
                        "sellRate",
                        "number",
                        undefined,
                        true,
                      )}
                      {dealField("Final payment due date", "due", "date", undefined, true)}
                      <div className="ledger-form-actions">
                        <Button type="submit">
                          <Plus />
                          Add deal
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setDraft(blankDeal())}
                        >
                          Clear
                        </Button>
                      </div>
                    </div>
                  </form>
                </section>
              ) : dealView === "Payment register" ? (
                <div className="panel">
                  <div className="panel-header">
                    <h2>Payment Register</h2>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        exportTable({
                          fileName: "payment-register",
                          title: "Payment Register",
                          columns: [
                            { header: "Date", type: "date" },
                            "Description",
                            "Reference",
                            { header: "Amount", type: "money", total: true },
                          ],
                          rows: entries
                            .filter((e) => e.credit)
                            .map((e) => [e.date, e.description, e.reference, e.credit]),
                          totalsLabel: "Total",
                        })
                      }
                    >
                      <Download />
                      Export
                    </Button>
                  </div>
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          {["Date", "Payment", "Reference", "Amount"].map((h) => (
                            <th key={h}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {entries
                          .filter((e) => e.credit)
                          .map((e) => (
                            <tr key={e.id}>
                              <td>{e.date}</td>
                              <td>{e.description}</td>
                              <td>{e.reference}</td>
                              <td>{money(e.credit)}</td>
                            </tr>
                          ))}
                        {!entries.some((e) => e.credit) && (
                          <tr>
                            <td colSpan={4} className="empty-state">
                              No data found
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex gap-2 mb-5 flex-wrap">
                    {deals.map((d) => (
                      <Button
                        key={d.id}
                        variant={d.id === dealId ? "secondary" : "outline"}
                        onClick={() => setDealId(d.id)}
                      >
                        {d.description} · {d.pi}
                      </Button>
                    ))}
                  </div>
                  {selected && (
                    <div className="panel">
                      <div className="panel-header">
                        <div>
                          <h2>{selected.description}</h2>
                          <p>
                            Buy: GSM → {selected.shipper} · Sell: OX → GSM · PI {selected.pi}
                          </p>
                        </div>
                        <Badge status={selected.finalPaid ? "Delivered" : "Final committed"} />
                      </div>
                      <div className="ledger-stats">
                        <div>
                          <span>Buy invoice</span>
                          <strong>{money(selected.value)}</strong>
                        </div>
                        <div>
                          <span>Sell value</span>
                          <strong>
                            {money(Number(selected.value) + Number(selected.adjustment))}
                          </strong>
                        </div>
                        <div>
                          <span>GSM Margin</span>
                          <strong>{money(selected.adjustment)}</strong>
                        </div>
                      </div>
                      <div className="table-scroll">
                        <table>
                          <thead>
                            <tr>
                              {[
                                "Payment stage",
                                "Buy scheduled",
                                "Buy paid",
                                "Buy date",
                                "Sell scheduled",
                                "Sell received",
                                "Margin",
                              ].map((h) => (
                                <th key={h}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {[
                              Number(selected.buy1),
                              Number(selected.buy2),
                              Number(selected.value) -
                                Number(selected.buy1) -
                                Number(selected.buy2),
                            ].map((value, i) => {
                              const sell = value + (i === 0 ? Number(selected.adjustment) : 0);
                              return (
                                <tr key={i}>
                                  <td>{["Payment 1", "Payment 2", "Final payment"][i]}</td>
                                  <td>{money(value)}</td>
                                  <td>{i === 2 && !selected.finalPaid ? "—" : money(value)}</td>
                                  <td>{i === 2 ? selected.due : "—"}</td>
                                  <td>{money(sell)}</td>
                                  <td>{i === 2 && !selected.finalPaid ? "—" : money(sell)}</td>
                                  <td>{money(i === 0 ? selected.adjustment : 0)}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </>
              )}
            </>
          ) : null}
          {isDeal && ledgerEntry && entryTable}
        </>
      )}
    </>
  );
}
