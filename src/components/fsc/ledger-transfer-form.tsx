import { uid } from "@/lib/id";
import type { Dispatch, SetStateAction } from "react";
import { Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { snackbar } from "@/components/ui/snackbar";
import { entryTypes } from "@/lib/fsc";
import type { LedgerEntry } from "@/lib/fsc-finance";
import { Combo, TextField } from "./fields";
import { useMasterOptions } from "./receiver-directory";
import { currencyOptions } from "@/lib/currencies";
import { blankEntry } from "./ledger-data";
import { useAddTptEntryMutation } from "@/store/api";
import { toTptTransferRequest } from "@/lib/tpt-reserve";
import { dropdownId } from "@/lib/shipment-create";
import { describeApiError } from "@/lib/shipment-api";
import "./accountant-ledger.css";

export type TransferDraft = typeof blankEntry;

/**
 * The Add Entry tab of a shipper's account ledger (Rob's and the others'), laid out like the Add Ledger Entry
 * form: a header, the fields in titled cards, and Clear / Save in the footer. The draft is owned by the
 * caller, so what was typed survives switching to the ledger's other tabs.
 */
export function LedgerTransferForm({
  ledgerName,
  shipperCode,
  entry,
  setEntry,
  onAdd,
}: {
  ledgerName: string;
  /** The ledger's shipper; Rob's ledger leaves it out and keeps the draft's own value, as before. */
  shipperCode?: string;
  entry: TransferDraft;
  setEntry: Dispatch<SetStateAction<TransferDraft>>;
  onAdd: (entry: LedgerEntry) => void;
}) {
  const master = useMasterOptions();
  const [addTptEntry] = useAddTptEntryMutation();
  const field = (key: keyof TransferDraft) => ({
    value: entry[key],
    onChange: (v: string) => setEntry((e) => ({ ...e, [key]: v })),
  });
  return (
    <section className="tpt-form ledger-transfer-form">
      <div className="tpt-form-header">
        <div>
          <h2>Add TPT Entry</h2>
          <p>Record a transfer in the {ledgerName}. It becomes available in shipment payments.</p>
        </div>
      </div>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          // Save to the server first (POST /tptReserve/addEntry), then add it to the on-screen ledger.
          const shipperId = dropdownId(master, "shippers", shipperCode ?? entry.shipper);
          // entryCategory is the short code ("TPT"), not the display label "TPT (Transfer)".
          const body = toTptTransferRequest(entry, shipperId, entryTypes[0].split(" (")[0]);
          if (!body) {
            snackbar.error("Cannot save TPT entry", {
              description: "A known shipper, a date and an amount above zero are required.",
            });
            return;
          }
          const result = await addTptEntry(body);
          if ("error" in result) {
            snackbar.error("TPT entry not saved", { description: describeApiError(result.error) });
            return; // keep the form so nothing typed is lost
          }
          onAdd({
            id: uid(),
            date: entry.date,
            description: entry.notes || `Transfer via ${entry.via}`,
            reference: entry.reference,
            type: entryTypes[0],
            debit: 0,
            credit: Number(entry.amount),
            currency: entry.currency,
            shipper: shipperCode ?? entry.shipper,
            file: entry.file,
            via: entry.via,
          });
          setEntry(blankEntry);
          snackbar.success("TPT entry saved; available in shipment payments");
        }}
      >
        <div className="tpt-form-body">
          <section className="tpt-entry-card">
            <div className="form-grid">
              <div className="form-section-title">
                <Receipt />
                Transfer details
              </div>
              <Combo
                label="Entry type"
                value={entryTypes[0]}
                options={[...entryTypes]}
                create={false}
                disabled
                onChange={() => { }}
              />
              <TextField label="Date" type="date" {...field("date")} />
              <Combo
                label="Currency"
                placeholder="Select currency"
                create={false}
                options={currencyOptions}
                {...field("currency")}
              />
              <TextField label="Amount" type="number" {...field("amount")} />
              <TextField label="Route" placeholder="e.g. KAM, VG, Direct" {...field("via")} />
              <TextField
                label="TPT reference"
                placeholder="e.g. TPT-KAM-2026-001"
                {...field("reference")}
              />
            </div>
          </section>
        </div>
        <div className="tpt-form-footer">
          <Button type="button" variant="outline" onClick={() => setEntry(blankEntry)}>
            Clear
          </Button>
          <Button type="submit">Save</Button>
        </div>
      </form>
    </section>
  );
}
