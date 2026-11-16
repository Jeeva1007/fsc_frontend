import { useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { money, type Shipment } from "@/lib/fsc";
import { exportTable } from "@/lib/export-table";
import type { LedgerEntry } from "@/lib/fsc-finance";
import { FilterSelect, SearchInput } from "./fields";
import { TablePagination } from "./table-pagination";
import { contains, usePages } from "./ledger-table-utils";

/**
 * The Rob Account Ledger's Statement and Containers tables, in the project's standard table layout
 * (header with count, search and filter toolbar, totals strip, pagination), like Shipments and Debit Advice.
 */

const ENTRY_KINDS = ["Charge", "Advance", "Transfer"] as const;
type EntryKind = (typeof ENTRY_KINDS)[number];
const kindOf = (e: LedgerEntry): EntryKind =>
  e.type === "AGV charge" ? "Charge" : e.type === "GSM advance" ? "Advance" : "Transfer";
export function Totals({ label, items }: { label: string; items: [string, string, string?][] }) {
  return (
    <div className="payment-summary pay-summary" aria-label={label}>
      {items.map(([name, value, className]) => (
        <div key={name} className={className}>
          <span>{name}</span>
          <strong>{value}</strong>
        </div>
      ))}
    </div>
  );
}

export function RobStatement({
  entries,
  closingBalance,
}: {
  entries: LedgerEntry[];
  closingBalance: number;
}) {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState("");
  // The running balance covers every entry, so a filtered row still shows its true balance.
  let running = 0;
  const rows = entries
    .map((e) => {
      running += e.debit - e.credit;
      return { ...e, balance: running, kind: kindOf(e) };
    })
    .filter((e) => (!kind || e.kind === kind) && contains(Object.values(e), query));
  const { visible, reset, pagination } = usePages(rows);
  const narrow = (set: (v: string) => void) => (v: string) => {
    set(v);
    reset();
  };
  return (
    <div className="panel shipments-panel rob-panel">
      <div className="panel-header">
        <h2>
          Statement <span className="count">{entries.length}</span>
        </h2>
      </div>
      <div className="table-toolbar">
        <SearchInput placeholder="Search statement…" value={query} onChange={narrow(setQuery)} />
        <FilterSelect
          ariaLabel="Filter entry type"
          allLabel="All entry types"
          options={[...ENTRY_KINDS]}
          value={kind}
          onChange={narrow(setKind)}
        />
        {(query || kind) && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setQuery("");
              setKind("");
              reset();
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
                fileName: "rob-account-ledger",
                title: "Rob Account Ledger · Statement",
                sheetName: "Statement",
                columns: [
                  { header: "Date", type: "date" },
                  "Description",
                  "Reference",
                  "Entry type",
                  { header: "Charge", type: "money", total: true },
                  { header: "Credit", type: "money", total: true },
                  { header: "Balance", type: "money" },
                ],
                rows: rows.map((e) => [
                  e.date,
                  e.description,
                  e.reference,
                  e.type,
                  e.debit,
                  e.credit,
                  e.balance,
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
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              {[
                "Date",
                "Type",
                "Description",
                "Reference",
                "Charge (+)",
                "Paid (−)",
                "Balance",
              ].map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((e) => (
              <tr key={e.id}>
                <td>{e.date}</td>
                <td>
                  <span className={`entry-chip ${e.kind.toLowerCase()}`}>{e.kind}</span>
                </td>
                <td className="rob-desc">{e.description}</td>
                <td>{e.reference || "—"}</td>
                <td className={e.debit ? "amt-charge" : "rob-none"}>
                  {e.debit ? money(e.debit) : "—"}
                </td>
                <td className={e.credit ? "amt-paid" : "rob-none"}>
                  {e.credit ? money(e.credit) : "—"}
                </td>
                <td className={`font-semibold ${e.balance < 0 ? "amt-negative" : ""}`}>
                  {money(e.balance)}
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={7} className="empty-state">
                  No matching entries
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <Totals
        label="Statement totals"
        items={[
          ["Charges (+)", money(rows.reduce((sum, e) => sum + e.debit, 0))],
          ["Paid (−)", money(rows.reduce((sum, e) => sum + e.credit, 0))],
          ["Closing balance", money(closingBalance), "pay-remaining"],
        ]}
      />
      <TablePagination {...pagination} noun="entries" />
    </div>
  );
}

export function RobContainers({
  shipments,
  fileName = "rob-containers",
  title = "Rob Account Ledger · Containers",
}: {
  shipments: Shipment[];
  /** Export file name; defaults to the Rob ledger's. */
  fileName?: string;
  /** Export title; defaults to the Rob ledger's. */
  title?: string;
}) {
  const [query, setQuery] = useState("");
  const rows = shipments.filter((s) => contains([s.vase, s.dos, s.eta, s.desc], query));
  const { visible, reset, pagination } = usePages(rows);
  const sum = (pick: (s: Shipment) => unknown) =>
    money(rows.reduce((total, s) => total + Number(pick(s) || 0), 0));
  return (
    <div className="panel shipments-panel rob-panel">
      <div className="panel-header">
        <h2>
          Containers <span className="count">{shipments.length}</span>
        </h2>
      </div>
      <div className="table-toolbar">
        <SearchInput
          placeholder="Search containers…"
          value={query}
          onChange={(v) => {
            setQuery(v);
            reset();
          }}
        />
        {query && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setQuery("");
              reset();
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
                fileName,
                title,
                sheetName: "Containers",
                columns: [
                  "Container",
                  "File number",
                  { header: "ETA", type: "date" },
                  "Variety / description",
                  { header: "AGV", type: "money", total: true },
                  { header: "GSM advances", type: "money", total: true },
                  { header: "TPT", type: "money", total: true },
                ],
                rows: rows.map((s) =>
                  [s.vase, s.dos, s.eta, s.desc, s.agv, s.gsm, s.tptReserved].map((v) => v ?? ""),
                ),
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
        <table>
          <thead>
            <tr>
              {[
                "Container",
                "File number",
                "ETA",
                "Variety / description",
                "AGV",
                "GSM advances",
                "TPT",
              ].map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((s) => (
              <tr key={s.vase}>
                <td className="font-semibold">{s.vase}</td>
                <td>{s.dos || "—"}</td>
                <td>{s.eta || "—"}</td>
                <td className="rob-desc">{s.desc || "—"}</td>
                <td>{money(s.agv)}</td>
                <td>{money(s.gsm)}</td>
                <td>{money(s.tptReserved)}</td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={7} className="empty-state">
                  No matching containers
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <Totals
        label="Container totals"
        items={[
          ["AGV", sum((s) => s.agv)],
          ["GSM advances", sum((s) => s.gsm)],
          ["TPT", sum((s) => s.tptReserved), "pay-remaining"],
        ]}
      />
      <TablePagination {...pagination} noun="containers" />
    </div>
  );
}
