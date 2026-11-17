import { useState, type ReactNode } from "react";
import { Download, Pencil, Trash2 } from "lucide-react";
import { skipToken } from "@reduxjs/toolkit/query/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { snackbar } from "@/components/ui/snackbar";
import { displayDate, parseIsoDate } from "@/lib/date-value";
import {
  adviceSheetRows,
  beInrValue,
  containerNumbers,
  CLOSURE_STATUSES,
  DEBIT_ADVICE_COLUMNS,
  DEBIT_ADVICE_EXPORT_COLUMNS,
  debitAdviceAbstract,
  debitAdviceCsvRows,
  debitAdviceDisplayOrder,
  debitAdviceTotals,
  dutyFigures,
  parseMatchedTo,
  shownOrmBe,
  PAYMENT_STATUSES,
  shownPaymentStatus,
  syncTptEntries,
  trancheAmount,
  type DebitAdvice,
} from "@/lib/debit-advice";
import { money } from "@/lib/fsc";
import { fromGsmOxLedgerResponse } from "@/lib/debit-advice-api";
import { describeApiError } from "@/lib/shipment-api";
import { useMatchedEntriesQuery } from "@/store/api/ledger.api";
import type { MatchedEntriesRequest } from "@/types/api";
import { exportTable } from "@/lib/export-table";
import type { LedgerEntry } from "@/lib/fsc-finance";
import { FilterSelect, SearchInput } from "./fields";
import { TablePagination } from "./table-pagination";
import type { LedgerServerPage } from "@/lib/page";
import { receiverNameChoices } from "@/lib/master-choices";
import { useMasterOptions } from "./receiver-directory";
import "./debit-advice.css";

const HEADS = [...DEBIT_ADVICE_COLUMNS, "Actions"];
/**
 * The Actions column's delete icon is hidden for now (user request, 2026-11-13); only Edit shows. Set this to
 * true to bring it back: the confirm dialog and delete code are kept as they are.
 */
const SHOW_DELETE = false;
/**
 * The Abstract (Party Name · Sum of Currency Value · Sum of Amount · Grand Total) under the register is
 * hidden for now (user request, 2026-11-13). Set this to true to show it again; the code is kept.
 */
const SHOW_ABSTRACT = false;
/**
 * The "Matched entries" pop-up (click a More/Less paid Payment Status) is switched off for now (user request,
 * 2026-11-13: to be done later). Every Payment Status shows as a plain badge with its "Matched to" line.
 * Set this to true to bring the pop-up back; MatchDialog / POST matchedEntries code is kept as it is.
 */
const SHOW_MATCH_POPUP = false;
const showDate = (v: string) => {
  const d = parseIsoDate(v);
  return d ? displayDate(d) : v || "—";
};
const statusTone: Record<string, string> = {
  Matched: "success",
  "More paid from OX": "",
  "Less paid from OX": "warning",
};
/** A cell the rows below merge into, or nothing when a row above already covers it. */
function Cell({
  span,
  className,
  title,
  children,
}: {
  span: number;
  className?: string;
  title?: string;
  children: ReactNode;
}) {
  if (!span) return null;
  return (
    <td rowSpan={span > 1 ? span : undefined} className={className} title={title}>
      {children}
    </td>
  );
}
/** A BE line's container numbers, one under another, so each container of the line is visible. */
function ContainerList({ numbers }: { numbers: string[] }) {
  if (!numbers.length) return <>—</>;
  if (numbers.length === 1) return <>{numbers[0]}</>;
  return (
    <ol className="da-ctr-list">
      {numbers.map((n, i) => (
        <li key={`${i}-${n}`}>{n}</li>
      ))}
    </ol>
  );
}

/**
 * One advice as a `<tbody>` of full-column rows (a row per BE line, with header cells merged down the
 * group). Shared by the register table and the matched-entries popup so the columns never drift apart.
 * Pass `onStatus`/`onEdit`/`onRemove` for the register's interactive cells; omit them for a read-only view.
 */
function AdviceGroup({
  advice: a,
  serial,
  highlight = false,
  onStatus,
  onEdit,
  onRemove,
}: {
  advice: DebitAdvice;
  serial: (a: DebitAdvice) => number | string;
  highlight?: boolean;
  onStatus?: (a: DebitAdvice) => void;
  onEdit?: (a: DebitAdvice) => void;
  onRemove?: (a: DebitAdvice) => void;
}) {
  const rows = adviceSheetRows(a);
  const all = rows.length;
  const diff = shownOrmBe(a);
  const state = shownPaymentStatus(a);
  // A "Matched" entry needs no matched-entries pop-up; only More/Less paid (or an unlabelled match) opens it.
  const opensMatch =
    SHOW_MATCH_POPUP && Boolean(onStatus) && state.trim().toLowerCase() !== "matched";
  const amount = (v: string | undefined) => (v ? money(v) : "—");
  return (
    <tbody className={`da-group ${highlight ? "da-self" : ""}`}>
      {rows.map((row) => {
        const { tranche: t, line: l, lineSpan, index } = row;
        const first = index === 0;
        const shown = l && dutyFigures(l);
        return (
          <tr key={index}>
            <Cell span={first ? all : 0} className="da-sl">
              {serial(a)}
            </Cell>
            <Cell span={first ? all : 0}>{showDate(a.date)}</Cell>
            <Cell span={first ? all : 0}>{a.partyName || "—"}</Cell>
            <Cell span={first ? all : 0} className="da-reference" title={a.reference}>
              {a.reference || "—"}
            </Cell>
            <Cell span={first ? all : 0}>{a.tolRef || "—"}</Cell>
            <Cell span={first ? all : 0}>{a.billNo || "—"}</Cell>
            <Cell span={first ? all : 0}>{a.curr || "—"}</Cell>
            <Cell span={row.trancheSpan}>{amount(t?.value)}</Cell>
            <Cell span={row.trancheSpan}>{t?.rate || "—"}</Cell>
            <Cell span={row.trancheSpan}>{t ? money(trancheAmount(t)) : "—"}</Cell>
            <Cell span={lineSpan}>{l?.blNo || "—"}</Cell>
            <Cell span={lineSpan}>{l?.portCode || "—"}</Cell>
            <Cell span={lineSpan}>{l?.beNo || "—"}</Cell>
            <Cell span={lineSpan}>{l ? showDate(l.beDate) : "—"}</Cell>
            <Cell span={lineSpan}>{l?.beValue ? l.beCurr : "—"}</Cell>
            <Cell span={lineSpan}>{amount(l?.beValue)}</Cell>
            <Cell span={lineSpan}>{l && shown?.inr ? money(beInrValue(l)) : "—"}</Cell>
            <Cell span={lineSpan}>{l?.ref || "—"}</Cell>
            <Cell span={lineSpan}>{l?.invNo || "—"}</Cell>
            <Cell span={row.partySpan}>{l?.party || "—"}</Cell>
            <Cell span={row.tptSpan}>{l?.tpt || "—"}</Cell>
            <Cell span={lineSpan}>{l?.cartons || "—"}</Cell>
            <Cell span={lineSpan}>{l?.netWeight || "—"}</Cell>
            <Cell span={row.paidSpan}>{amount(l?.paidValue)}</Cell>
            <Cell span={row.paidSpan}>{l?.paidValue ? l.paidCurr : "—"}</Cell>
            <Cell span={row.paidSpan}>{l ? showDate(l.paidOn) : "—"}</Cell>
            <Cell span={lineSpan}>
              <ContainerList numbers={containerNumbers(l?.containerNo ?? "")} />
            </Cell>
            <Cell span={lineSpan}>{l?.ctrCount || "—"}</Cell>
            <Cell span={lineSpan}>{l?.fruit || "—"}</Cell>
            <Cell span={lineSpan}>{l?.closure || "—"}</Cell>
            <Cell span={lineSpan}>{l ? showDate(l.closureDate) : "—"}</Cell>
            <Cell span={lineSpan}>{l?.closureRef || "—"}</Cell>
            <Cell span={first ? all : 0}>{diff === null ? "—" : money(diff)}</Cell>
            <Cell span={first ? all : 0}>
              {state || a.matchedTo ? (
                onStatus && opensMatch ? (
                  <button
                    type="button"
                    className="da-status-btn"
                    onClick={() => onStatus(a)}
                    title="View the entries this is matched with"
                  >
                    {state ? (
                      <span className={`status-badge ${statusTone[state] ?? ""}`}>{state}</span>
                    ) : (
                      <span className="status-badge">View match</span>
                    )}
                    {a.matchedTo && <small>Matched to {a.matchedTo}</small>}
                  </button>
                ) : (
                  <span className="da-status-static">
                    {state && (
                      <span className={`status-badge ${statusTone[state] ?? ""}`}>{state}</span>
                    )}
                    {a.matchedTo && <small>Matched to {a.matchedTo}</small>}
                  </span>
                )
              ) : (
                "—"
              )}
            </Cell>
            <Cell span={lineSpan}>{amount(l?.dutyPaid)}</Cell>
            <Cell span={first ? all : 0} className="da-actions">
              {onEdit && (
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={`Edit entry ${serial(a)}`}
                  onClick={() => onEdit(a)}
                >
                  <Pencil size={14} />
                </Button>
              )}
              {onRemove && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="text-destructive"
                  aria-label={`Delete entry ${serial(a)}`}
                  onClick={() => onRemove(a)}
                >
                  <Trash2 size={14} />
                </Button>
              )}
            </Cell>
          </tr>
        );
      })}
    </tbody>
  );
}

/** The client's Debit Advice sheet: an advice takes as many rows as it has amounts or BE lines, with shared cells merged. */
export function DebitAdviceRegister({
  advices,
  onAdvices,
  entries,
  onEntries,
  onEdit,
  serverPage,
}: {
  advices: DebitAdvice[];
  onAdvices: (advices: DebitAdvice[]) => void;
  entries: LedgerEntry[];
  onEntries: (entries: LedgerEntry[]) => void;
  /** Opens the entry in the Add Ledger Entry tab. */
  onEdit: (advice: DebitAdvice) => void;
  /** When set, the footer pages through the backend; the loaded page is shown as-is. */
  serverPage?: LedgerServerPage;
}) {
  // With a server page, search / BE closure / payment status go to the backend (ledgerList `search`,
  // `beClosureStatus`, `paymentStatus`) and cover every page; without one they filter the rows held here.
  const [localQuery, setLocalQuery] = useState("");
  const serverSearch = Boolean(serverPage?.onSearch);
  const query = serverSearch ? (serverPage?.search ?? "") : localQuery;
  const setQuery = (v: string) => (serverSearch ? serverPage?.onSearch?.(v) : setLocalQuery(v));
  const typed = query.trim().length;
  const master = useMasterOptions();
  const [localParty, setLocalParty] = useState("");
  // With a server page the Party filter goes to the backend (ledgerList `party`, every page); without one
  // it filters the rows held here.
  const serverParty = Boolean(serverPage?.onParty);
  const party = serverParty ? (serverPage?.party ?? "") : localParty;
  const setParty = (v: string) => (serverParty ? serverPage?.onParty?.(v) : setLocalParty(v));
  // Party choices = the receivers (receiverDropdown), plus any Party Name already on the loaded rows (older
  // entries), so the same names as the form's Party Name / Party dropdowns.
  const partyChoices = [
    ...new Set([
      ...receiverNameChoices(master, []).choices,
      ...advices.map((a) => a.partyName.trim()).filter(Boolean),
      ...(party ? [party] : []),
    ]),
  ].sort((x, y) => x.localeCompare(y));
  const [localClosure, setLocalClosure] = useState("");
  const serverClosure = Boolean(serverPage?.onClosure);
  const closure = serverClosure ? (serverPage?.closure ?? "") : localClosure;
  const setClosure = (v: string) =>
    serverClosure ? serverPage?.onClosure?.(v) : setLocalClosure(v);
  const [localStatus, setLocalStatus] = useState("");
  const serverStatus = Boolean(serverPage?.onPaymentStatus);
  const status = serverStatus ? (serverPage?.paymentStatus ?? "") : localStatus;
  const setStatus = (v: string) =>
    serverStatus ? serverPage?.onPaymentStatus?.(v) : setLocalStatus(v);
  const [page, setPage] = useState(1);
  // The entry whose Payment Status cell was clicked, to show what it is matched with.
  const [matchView, setMatchView] = useState<DebitAdvice | null>(null);
  const [size, setSize] = useState(10);
  const [removing, setRemoving] = useState<DebitAdvice | null>(null);
  const serial = (a: DebitAdvice) => advices.findIndex((x) => x.id === a.id) + 1;
  const filter = <T,>(setter: (v: T) => void) => ({
    onChange: (v: T) => {
      setter(v);
      setPage(1);
    },
  });
  const filtered = debitAdviceDisplayOrder(advices).filter(
    (a) =>
      (serverParty || !party || a.partyName === party) &&
      (serverClosure || !closure || a.lines.some((l) => l.closure === closure)) &&
      (serverStatus || !status || shownPaymentStatus(a) === status) &&
      (serverSearch || JSON.stringify(a).toLowerCase().includes(query.toLowerCase())),
  );
  const pageSize = serverPage ? serverPage.size : size;
  const lastPage = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, lastPage);
  const visible = serverPage
    ? filtered
    : filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const totals = debitAdviceTotals(filtered);
  return (
    <div className="panel shipments-panel da-panel">
      <div className="panel-header">
        <div>
          <h2>
            Debit Advice Details{" "}
            {/* With a server page, the backend's totalElements (every page, after its Party/Shipper filters). */}
            <span className="count">{serverPage ? serverPage.total : advices.length}</span>
          </h2>
        </div>
      </div>
      <div className="table-toolbar">
        <SearchInput placeholder="Search entries…" value={query} {...filter(setQuery)} />
        {serverSearch && typed === 1 && (
          <span className="da-search-hint" role="status">
            Type at least 2 characters to search
          </span>
        )}
        <FilterSelect
          ariaLabel="Filter party"
          allLabel="All parties"
          options={partyChoices}
          value={party}
          {...filter(setParty)}
        />
        {/* No "All shippers" filter (user request, 2026-11-16). */}
        <FilterSelect
          ariaLabel="Filter BE closure status"
          allLabel="All BE closure"
          options={CLOSURE_STATUSES}
          value={closure}
          {...filter(setClosure)}
        />
        <FilterSelect
          ariaLabel="Filter payment status"
          allLabel="All payment status"
          options={PAYMENT_STATUSES}
          value={status}
          {...filter(setStatus)}
        />
        {(query || party || closure || status) && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setQuery("");
              setParty("");
              setClosure("");
              setStatus("");
              setPage(1);
            }}
          >
            Clear
          </Button>
        )}
        <div className="toolbar-end">
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              exportTable({
                fileName: "debit-advice-details",
                title: "Debit Advice Details",
                columns: DEBIT_ADVICE_EXPORT_COLUMNS,
                rows: debitAdviceCsvRows(filtered, serial),
                totalsLabel: "Total",
              })
            }
          >
            <Download />
            Export
          </Button>
        </div>
      </div>
      <div className="table-scroll">
        <table className="da-sheet">
          <thead>
            <tr>
              {HEADS.map((h, i) => (
                <th key={i}>{h}</th>
              ))}
            </tr>
          </thead>
          {visible.map((a) => (
            <AdviceGroup
              key={a.id}
              advice={a}
              serial={serial}
              onStatus={setMatchView}
              onEdit={onEdit}
              {...(SHOW_DELETE ? { onRemove: setRemoving } : {})}
            />
          ))}
          {!visible.length && (
            <tbody>
              <tr>
                <td colSpan={HEADS.length} className="empty-state">
                  {typed >= 2 ? `No entries match “${query.trim()}”` : "No data found"}
                </td>
              </tr>
            </tbody>
          )}
        </table>
      </div>
      <div className="payment-summary pay-summary" aria-label="Debit advice totals">
        {(
          [
            ["Currency Value", money(totals.value)],
            ["Amount", money(totals.amount)],
            ["BE Value", money(totals.beValue)],
            ["Number of Cartons", totals.cartons.toLocaleString("en-US")],
            ["Number of Containers", totals.containers.toLocaleString("en-US")],
            ["Paid to shipper", money(totals.paidToTpt)],
            ["ORM - BE", money(totals.ormBe)],
          ] as const
        ).map(([label, value]) => (
          <div key={label} className={label === "ORM - BE" ? "pay-remaining" : undefined}>
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
      <TablePagination
        page={serverPage ? serverPage.page : currentPage}
        pageSize={pageSize}
        total={serverPage ? serverPage.total : filtered.length}
        onPage={serverPage ? serverPage.onPage : setPage}
        {...(serverPage
          ? serverPage.onPageSize
            ? { onPageSize: serverPage.onPageSize }
            : {}
          : {
              onPageSize: (n: number) => {
                setSize(n);
                setPage(1);
              },
            })}
        noun="entries"
      />
      {SHOW_ABSTRACT && (
        <div className="da-abstract">
          <h3>Abstract</h3>
          <div className="da-lines">
            <table>
              <thead>
                <tr>
                  <th>Party Name</th>
                  <th>Sum of Currency Value</th>
                  <th>Sum of Amount</th>
                </tr>
              </thead>
              <tbody>
                {debitAdviceAbstract(filtered).map((row) => (
                  <tr key={row.party}>
                    <td>{row.party}</td>
                    <td>{money(row.value)}</td>
                    <td>{money(row.amount)}</td>
                  </tr>
                ))}
                {!filtered.length && (
                  <tr>
                    <td colSpan={3} className="empty-state">
                      No data found
                    </td>
                  </tr>
                )}
                <tr className="da-grand-total">
                  <td>Grand Total</td>
                  <td>{money(totals.value)}</td>
                  <td>{money(totals.amount)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
      <Dialog open={Boolean(removing)} onOpenChange={(v) => !v && setRemoving(null)}>
        <DialogContent>
          <DialogTitle>Delete entry?</DialogTitle>
          <DialogDescription>
            This removes the entry and any TPT amount it added to shipment payments.
          </DialogDescription>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setRemoving(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (removing) {
                  onAdvices(advices.filter((a) => a.id !== removing.id));
                  onEntries(syncTptEntries(entries, removing.id, []));
                }
                setRemoving(null);
                snackbar.success("Entry deleted");
              }}
            >
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      {SHOW_MATCH_POPUP && (
        <MatchDialog
          advice={matchView}
          serial={(a) => serial(a) || "—"}
          onClose={() => setMatchView(null)}
          onOpen={(a) => {
            setMatchView(null);
            onEdit(a);
          }}
        />
      )}
    </div>
  );
}

/** The numbers an entry can be searched by: its ORM No. (Bill No. / ORM No.) and each line's BE No. */
function matchNumbers(a: DebitAdvice): { ORM: string[]; BE: string[] } {
  const uniq = (xs: string[]) => [...new Set(xs.map((x) => x.trim()).filter(Boolean))];
  return { ORM: uniq([a.billNo]), BE: uniq(a.lines.map((l) => l.beNo)) };
}
const MATCH_LABEL: Record<MatchedEntriesRequest["searchType"], string> = {
  ORM: "ORM No.",
  BE: "BE No.",
};
const MATCH_MAX = 50;

/**
 * "Matched entries" pop-up: POST /gsmOxLedger/matchedEntries returns every ledger entry for one BE No. or
 * ORM No., across all pages. It opens searching the clicked entry's ORM No. (else its first BE No.); the
 * BE No. / ORM No. switch and the number box search another one. The clicked entry is shown on top.
 */
function MatchDialog({
  advice,
  serial,
  onClose,
  onOpen,
}: {
  advice: DebitAdvice | null;
  serial: (a: DebitAdvice) => number | string;
  onClose: () => void;
  onOpen: (a: DebitAdvice) => void;
}) {
  return (
    <Dialog open={Boolean(advice)} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="match-dialog">
        {advice && (
          <MatchSearch
            key={advice.id}
            advice={advice}
            serial={serial}
            onClose={onClose}
            onOpen={onOpen}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function MatchSearch({
  advice,
  serial,
  onClose,
  onOpen,
}: {
  advice: DebitAdvice;
  serial: (a: DebitAdvice) => number | string;
  onClose: () => void;
  onOpen: (a: DebitAdvice) => void;
}) {
  const own = matchNumbers(advice);
  // Open with the "Matched to" BE/ORM No. typed on the entry; without one, the entry's own ORM No.
  // (else its first BE No.).
  const typed = parseMatchedTo(advice.matchedTo);
  const firstType: MatchedEntriesRequest["searchType"] =
    typed?.searchType ?? (own.ORM[0] || !own.BE[0] ? "ORM" : "BE");
  // The switch refills the box with the typed number of that type first, then the entry's own.
  const choices = (t: MatchedEntriesRequest["searchType"]) => [
    ...new Set([...(typed?.searchType === t ? [typed.number] : []), ...own[t]]),
  ];
  const [type, setType] = useState(firstType);
  const [number, setNumber] = useState(choices(firstType)[0] ?? "");
  // The search that was run; starts with the entry's own number so the pop-up opens with results.
  const [asked, setAsked] = useState<MatchedEntriesRequest | null>(() =>
    number ? { searchType: firstType, number } : null,
  );
  const { data, isFetching, isError, error } = useMatchedEntriesQuery(asked ?? skipToken);
  // Every entry the backend returned, except the clicked one (shown on top already).
  const found = (data ?? []).map(fromGsmOxLedgerResponse).filter((m) => m.id !== advice.id);
  const trimmed = number.trim();
  const valid = trimmed.length > 0 && trimmed.length <= MATCH_MAX;
  const suggestions = choices(type);
  const search = () => valid && setAsked({ searchType: type, number: trimmed });
  return (
    <>
      <DialogTitle>Matched entries</DialogTitle>
      <DialogDescription>
        {asked
          ? `Ledger entries with ${MATCH_LABEL[asked.searchType]} ${asked.number}, across all pages.`
          : "Choose BE No. or ORM No. and enter the number to find its ledger entries."}
      </DialogDescription>
      <form
        className="match-search"
        onSubmit={(e) => {
          e.preventDefault();
          search();
        }}
      >
        <div className="match-type" role="group" aria-label="Search by">
          {(["ORM", "BE"] as const).map((t) => (
            <Button
              key={t}
              type="button"
              size="sm"
              variant={type === t ? "default" : "outline"}
              aria-pressed={type === t}
              onClick={() => {
                setType(t);
                setNumber(choices(t)[0] ?? "");
              }}
            >
              {MATCH_LABEL[t]}
            </Button>
          ))}
        </div>
        <Input
          aria-label={MATCH_LABEL[type]}
          placeholder={`Enter ${MATCH_LABEL[type]}`}
          value={number}
          maxLength={MATCH_MAX}
          list={suggestions.length > 1 ? "match-numbers" : undefined}
          onChange={(e) => setNumber(e.target.value)}
        />
        {suggestions.length > 1 && (
          <datalist id="match-numbers">
            {suggestions.map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>
        )}
        <Button type="submit" size="sm" disabled={!valid || isFetching}>
          {isFetching ? "Searching…" : "Search"}
        </Button>
      </form>
      <div className="match-table-scroll table-scroll">
        <table className="da-sheet">
          <thead>
            <tr>
              {HEADS.map((h, i) => (
                <th key={i}>{h}</th>
              ))}
            </tr>
          </thead>
          <AdviceGroup advice={advice} serial={serial} highlight />
          {!isFetching &&
            !isError &&
            found.map((m) => <AdviceGroup key={m.id} advice={m} serial={serial} onEdit={onOpen} />)}
        </table>
      </div>
      {asked && !isFetching && (isError || !found.length) && (
        <p className="match-empty">
          {isError
            ? describeApiError(error)
            : `No other ledger entries with ${MATCH_LABEL[asked.searchType]} ${asked.number}.`}
        </p>
      )}
      <div className="flex justify-end">
        <Button variant="outline" onClick={onClose}>
          Close
        </Button>
      </div>
    </>
  );
}
