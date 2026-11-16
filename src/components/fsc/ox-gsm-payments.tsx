import { useState } from "react";
import { Download, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { snackbar } from "@/components/ui/snackbar";
import { displayDate, parseIsoDate } from "@/lib/date-value";
import type { FieldErrors } from "@/lib/login-schema";
import { money } from "@/lib/fsc";
import { exportTable } from "@/lib/export-table";
import {
  blankOxPayment,
  OX_STAGES,
  oxToGsmRows,
  oxToGsmTotals,
  validateOxPayment,
  type OxPayment,
} from "@/lib/ox-gsm";
import { Combo, FilterSelect, SearchInput, TextField } from "./fields";
import { TablePagination } from "./table-pagination";

const COLUMNS = [
  "Description",
  "Reference",
  "Payment stage",
  "Final payment due date",
  "Sell scheduled",
  "Sell received",
  "OX Date",
  "Due from OX",
];
const showDate = (v: string) => {
  const d = parseIsoDate(v);
  return d ? displayDate(d) : v || "—";
};

/**
 * OX to GSM payments under the Accountant's deal cards, in the Shipments table's design: search, filters,
 * export, pop-up add / edit, confirmed delete and paging. Sample data: nothing here reaches the server.
 */
export function OxGsmPayments({
  payments,
  onPayments,
}: {
  payments: OxPayment[];
  onPayments: (payments: OxPayment[]) => void;
}) {
  const [query, setQuery] = useState("");
  const [stage, setStage] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(10);
  const [draft, setDraftState] = useState<OxPayment | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [removing, setRemoving] = useState<OxPayment | null>(null);
  const setDraft = (p: OxPayment | null) => {
    setDraftState(p);
    setErrors({});
  };
  const edit = (key: keyof OxPayment, value: string) => {
    if (!draft) return;
    setDraftState({ ...draft, [key]: value });
    setErrors(({ [key]: _cleared, ...rest }) => rest);
  };
  const filtered = oxToGsmRows(payments).filter(
    (r) =>
      (!stage || r.stage === stage) &&
      (!status || (status === "Received") === Boolean(r.received)) &&
      Object.values(r).join(" ").toLowerCase().includes(query.toLowerCase()),
  );
  const lastPage = Math.max(1, Math.ceil(filtered.length / size));
  const currentPage = Math.min(page, lastPage);
  const visible = filtered.slice((currentPage - 1) * size, currentPage * size);
  const totals = oxToGsmTotals(filtered);
  const isNew = Boolean(draft && !payments.some((p) => p.id === draft.id));
  const save = () => {
    if (!draft) return;
    const found = validateOxPayment(draft);
    if (found) {
      setErrors(found);
      snackbar.error("Fill in the required payment fields", {
        description: Object.values(found)[0] ?? "Check the payment details",
      });
      return;
    }
    onPayments(isNew ? [...payments, draft] : payments.map((p) => (p.id === draft.id ? draft : p)));
    setDraft(null);
    snackbar.success("Payment saved");
  };
  return (
    <div className="panel shipments-panel ox-gsm-panel">
      <div className="panel-header">
        <div>
          <h2>
            OX to GSM Payments <span className="count">{payments.length}</span>
          </h2>
          <p>Changes stay on this screen until you sign out or refresh; they are not saved yet.</p>
        </div>
        <span className="audit-sample-tag">Sample data</span>
      </div>
      <div className="table-toolbar">
        <SearchInput
          placeholder="Search payments…"
          value={query}
          onChange={(v) => {
            setQuery(v);
            setPage(1);
          }}
        />
        <FilterSelect
          ariaLabel="Filter payment stage"
          allLabel="All stages"
          options={OX_STAGES}
          value={stage}
          onChange={(v) => {
            setStage(v);
            setPage(1);
          }}
        />
        <FilterSelect
          ariaLabel="Filter status"
          allLabel="All statuses"
          options={["Received", "Pending"]}
          value={status}
          onChange={(v) => {
            setStatus(v);
            setPage(1);
          }}
        />
        {(query || stage || status) && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setQuery("");
              setStage("");
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
                fileName: "ox-to-gsm-payments",
                title: "OX to GSM Payments",
                columns: [
                  "Description",
                  "Reference",
                  "Payment stage",
                  { header: "Final payment due date", type: "date" },
                  { header: "Sell scheduled", type: "money", total: true },
                  { header: "Sell received", type: "money", total: true },
                  { header: "OX Date", type: "date" },
                  { header: "Due from OX", type: "money", total: true },
                ],
                rows: filtered.map((r) => [
                  r.description,
                  r.reference,
                  r.stage,
                  r.due,
                  r.scheduled,
                  r.received,
                  r.oxDate,
                  r.balance,
                ]),
                totalsLabel: "Total",
              })
            }
          >
            <Download />
            Export
          </Button>
          <Button size="sm" onClick={() => setDraft(blankOxPayment())}>
            <Plus />
            Add Payment
          </Button>
        </div>
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              {[...COLUMNS, "Actions"].map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => (
              <tr key={r.id}>
                <td>{r.description}</td>
                <td>{r.reference}</td>
                <td>{r.stage}</td>
                <td>{showDate(r.due)}</td>
                <td>{money(r.scheduled)}</td>
                <td>{r.received ? money(r.received) : "—"}</td>
                <td>{showDate(r.oxDate)}</td>
                <td>{money(r.balance)}</td>
                <td>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={`Edit ${r.stage} of ${r.reference}`}
                    onClick={() => {
                      const { balance: _balance, ...payment } = r;
                      setDraft(payment);
                    }}
                  >
                    <Pencil size={14} />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="text-destructive"
                    aria-label={`Delete ${r.stage} of ${r.reference}`}
                    onClick={() => setRemoving(r)}
                  >
                    <Trash2 size={14} />
                  </Button>
                </td>
              </tr>
            ))}
            {!visible.length && (
              <tr>
                <td colSpan={COLUMNS.length + 1} className="empty-state">
                  No matching payments
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="payment-summary pay-summary" aria-label="OX to GSM summary">
        {(
          [
            ["Sell scheduled", totals.scheduled],
            ["Sell received", totals.received],
            ["Due from OX", totals.due],
          ] as const
        ).map(([label, value]) => (
          <div key={label} className={label === "Due from OX" ? "pay-remaining" : undefined}>
            <span>{label}</span>
            <strong>{money(value)}</strong>
          </div>
        ))}
      </div>
      <TablePagination
        page={currentPage}
        pageSize={size}
        total={filtered.length}
        onPage={setPage}
        onPageSize={(n) => {
          setSize(n);
          setPage(1);
        }}
        noun="payments"
      />
      <Dialog open={Boolean(draft)} onOpenChange={(v) => !v && setDraft(null)}>
        <DialogContent className="ox-gsm-dialog">
          <DialogTitle>{isNew ? "Add Payment" : "Edit Payment"}</DialogTitle>
          <DialogDescription>Fields marked * are required.</DialogDescription>
          {draft && (
            <form
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                save();
              }}
            >
              <div className="form-grid two-col">
                <TextField
                  label="Description"
                  required
                  value={draft.description}
                  error={errors["description"]}
                  onChange={(v) => edit("description", v)}
                />
                <TextField
                  label="Reference"
                  required
                  value={draft.reference}
                  error={errors["reference"]}
                  onChange={(v) => edit("reference", v)}
                />
                <Combo
                  label="Payment stage"
                  required
                  create={false}
                  options={OX_STAGES}
                  value={draft.stage}
                  error={errors["stage"]}
                  onChange={(v) => edit("stage", v)}
                />
                <TextField
                  label="Final payment due date"
                  type="date"
                  value={draft.due}
                  onChange={(v) => edit("due", v)}
                />
                <TextField
                  label="Sell scheduled"
                  type="number"
                  required
                  value={draft.scheduled}
                  error={errors["scheduled"]}
                  onChange={(v) => edit("scheduled", v)}
                />
                <TextField
                  label="Sell received"
                  type="number"
                  value={draft.received}
                  error={errors["received"]}
                  onChange={(v) => edit("received", v)}
                />
                <TextField
                  label="OX Date"
                  type="date"
                  value={draft.oxDate}
                  error={errors["oxDate"]}
                  onChange={(v) => edit("oxDate", v)}
                />
              </div>
              <div className="flex justify-end gap-2 mt-5">
                <Button type="button" variant="outline" onClick={() => setDraft(null)}>
                  Cancel
                </Button>
                <Button type="submit">Save</Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={Boolean(removing)} onOpenChange={(v) => !v && setRemoving(null)}>
        <DialogContent>
          <DialogTitle>Delete payment?</DialogTitle>
          <DialogDescription>
            This removes {removing?.stage} of {removing?.reference} from the table.
          </DialogDescription>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setRemoving(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                onPayments(payments.filter((p) => p.id !== removing?.id));
                setRemoving(null);
                snackbar.success("Payment removed");
              }}
            >
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
