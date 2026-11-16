import { useMemo, useState } from "react";
import { ArrowRight, Download, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FilterSelect, TextField } from "./fields";
import { TablePagination } from "./table-pagination";
import {
  auditDetails,
  auditParams,
  auditPerson,
  EMPTY_VALUE,
  formatAuditTime,
  fromAuditItem,
  humanize,
} from "@/lib/audit";
import {
  sampleAuditActors,
  sampleAuditPage,
  sampleAuditTables,
  USE_SAMPLE_AUDIT_LOGS,
} from "@/lib/audit-samples";
import { type User } from "@/lib/fsc";
import { exportTable } from "@/lib/export-table";
import { describeApiError } from "@/lib/shipment-api";
import { useAuditTablesQuery, useListAuditQuery } from "@/store/api";

// Long diffs fold, but never just to hide one line.
const VISIBLE_CHANGES = 3;
const FOLD_ABOVE = 4;
const TONES = {
  create: "success",
  update: "info",
  delete: "danger",
  session: "neutral",
  other: "neutral",
} as const;

/** Owner-only activity log (GET /audit). Filters and paging run on the server. */
export function AuditLogs({
  users,
  samples = USE_SAMPLE_AUDIT_LOGS,
}: {
  users: User[];
  /** Shows the demo rows and sends no requests; see USE_SAMPLE_AUDIT_LOGS. */
  samples?: boolean;
}) {
  const [table, setTable] = useState("");
  const [userId, setUserId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(25);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const { data, error, isError, isFetching, isLoading, refetch } = useListAuditQuery(
    auditParams({ table, userId, from, to, page, size }),
    { refetchOnMountOrArgChange: true, skip: samples },
  );
  const { data: tables } = useAuditTablesQuery(undefined, { skip: samples });
  const sample = useMemo(
    () => (samples ? sampleAuditPage({ table, actor: userId, from, to, page, size }) : null),
    [samples, table, userId, from, to, page, size],
  );
  const entries = (sample?.items ?? (Array.isArray(data?.items) ? data.items : [])).map(
    fromAuditItem,
  );
  const total = sample?.total ?? data?.total ?? entries.length;
  const filtered = Boolean(table || userId || from || to);
  // Any filter change starts again from the first page.
  const change = (set: (value: string) => void) => (value: string) => {
    set(value);
    setPage(1);
  };
  const clear = () => {
    setTable("");
    setUserId("");
    setFrom("");
    setTo("");
    setPage(1);
  };
  const empty =
    isLoading && !samples
      ? "Loading audit logs…"
      : filtered
        ? "No activity matches these filters."
        : "No activity has been recorded yet.";
  return (
    <section className="panel shipments-panel audit-panel" aria-label="Audit logs">
      <div className="table-toolbar">
        <FilterSelect
          ariaLabel="Filter by resource"
          allLabel="All resources"
          options={(samples ? sampleAuditTables : (tables ?? [])).map((t) => ({
            value: t,
            label: humanize(t),
          }))}
          value={table}
          onChange={change(setTable)}
        />
        <FilterSelect
          ariaLabel="Filter by user"
          allLabel="All users"
          options={
            samples
              ? sampleAuditActors
              : users
                  .filter((u) => u.serverId !== undefined)
                  .map((u) => ({ value: String(u.serverId), label: u.name }))
          }
          value={userId}
          onChange={change(setUserId)}
        />
        <div className="audit-date">
          <TextField
            ariaLabel="From date"
            type="date"
            placeholder="From date"
            value={from}
            onChange={change(setFrom)}
            // The calendars cannot select a From date after the To date.
            inputProps={to ? { max: to } : {}}
          />
        </div>
        <div className="audit-date">
          <TextField
            ariaLabel="To date"
            type="date"
            placeholder="To date"
            value={to}
            onChange={change(setTo)}
            inputProps={from ? { min: from } : {}}
          />
        </div>
        {filtered && (
          <Button size="sm" variant="ghost" onClick={clear}>
            <X />
            Clear
          </Button>
        )}
        <div className="toolbar-end">
          {samples && <span className="audit-sample-tag">Sample data</span>}
          {!samples && (
            <Button
              size="sm"
              variant="outline"
              aria-label="Refresh audit logs"
              disabled={isFetching}
              onClick={() => void refetch()}
            >
              <RefreshCw className={isFetching ? "animate-spin" : undefined} />
              Refresh
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            title="Downloads the entries on this page"
            disabled={!entries.length}
            onClick={() =>
              exportTable({
                fileName: "audit-logs",
                title: "Audit Logs",
                columns: ["Timestamp", "User", "Email", "Action", "Resource", "Record", "Details"],
                rows: entries.map((e) => [
                  formatAuditTime(e.at),
                  auditPerson(e, users).name,
                  auditPerson(e, users).email,
                  e.action,
                  e.resource,
                  e.rowKey,
                  auditDetails(e),
                ]),
              })
            }
          >
            <Download />
            Export
          </Button>
        </div>
      </div>
      {isError && !samples ? (
        <div className="audit-error" role="alert">
          <p>
            {(error as { status?: unknown }).status === 403
              ? "Only the owner can view audit logs."
              : `Audit logs could not be loaded. ${describeApiError(error)}`}
          </p>
          <Button size="sm" variant="outline" onClick={() => void refetch()}>
            Try again
          </Button>
        </div>
      ) : (
        <div className="table-scroll" aria-busy={isFetching}>
          <table>
            <thead>
              <tr>
                {["Timestamp", "User", "Action", "Resource", "Details / Diff"].map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => {
                const open = expanded[e.key];
                const folds = e.changes.length > FOLD_ABOVE;
                const hidden = e.changes.length - VISIBLE_CHANGES;
                const person = auditPerson(e, users);
                return (
                  <tr key={e.key}>
                    <td className="audit-time" title={e.at} data-label="Timestamp">
                      {formatAuditTime(e.at)}
                    </td>
                    <td className="audit-actor" data-label="User">
                      {person.name && <span className="audit-user">{person.name}</span>}
                      {person.email && <small className="audit-email">{person.email}</small>}
                    </td>
                    <td data-label="Action">
                      <span className={`status-badge ${TONES[e.tone]}`}>
                        <i />
                        {e.action}
                      </span>
                    </td>
                    <td data-label="Resource">
                      <span className="audit-resource">{e.resource}</span>
                      {e.rowKey && <small className="audit-record">#{e.rowKey}</small>}
                    </td>
                    <td className="audit-details" data-label="Details">
                      {e.changes.length > 0 && (
                        <ul>
                          {(open || !folds ? e.changes : e.changes.slice(0, VISIBLE_CHANGES)).map(
                            (c) => (
                              <li key={c.field}>
                                <strong>{c.field}</strong>
                                {c.from !== EMPTY_VALUE && (
                                  <span className="audit-old">{c.from}</span>
                                )}
                                {c.from !== EMPTY_VALUE && c.to !== EMPTY_VALUE && (
                                  <ArrowRight size={12} aria-label="changed to" />
                                )}
                                {c.to !== EMPTY_VALUE && <span className="audit-new">{c.to}</span>}
                              </li>
                            ),
                          )}
                        </ul>
                      )}
                      {folds && (
                        <button
                          type="button"
                          className="audit-more"
                          aria-expanded={Boolean(open)}
                          onClick={() => setExpanded((x) => ({ ...x, [e.key]: !open }))}
                        >
                          {open ? "Show less" : `Show ${hidden} more`}
                        </button>
                      )}
                      {e.note && <p>{e.note}</p>}
                      {e.ip && <small>IP {e.ip}</small>}
                      {!e.changes.length && !e.note && !e.ip && "—"}
                    </td>
                  </tr>
                );
              })}
              {!entries.length && (
                <tr>
                  <td colSpan={5} className="empty-state">
                    {empty}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      {(samples || !isError) && (
        <TablePagination
          page={page}
          pageSize={size}
          total={total}
          onPage={setPage}
          onPageSize={(s) => {
            setSize(s);
            setPage(1);
          }}
          pageSizes={[25, 50, 100]}
          noun="entries"
        />
      )}
    </section>
  );
}
