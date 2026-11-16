import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { snackbar } from "@/components/ui/snackbar";
import { DebitAdviceRegister } from "./debit-advice";
import { DebitAdviceForm } from "./debit-advice-form";
import {
  newDebitAdvice,
  blankTranche,
  syncTptEntries,
  tptEntriesFor,
  type DebitAdvice,
} from "@/lib/debit-advice";
import { toGsmOxLedgerRequest } from "@/lib/debit-advice-api";
import { isUuid } from "@/lib/shipment-create";
import { describeApiError } from "@/lib/shipment-api";
import { useCreateLedgerMutation, useUpdateLedgerMutation } from "@/store/api";
import type { LedgerEntry } from "@/lib/fsc-finance";
import type { LedgerServerPage } from "@/lib/page";
import "./accountant-ledger.css";

export const LEDGER_ENTRY_TAB = "Add GSM - OX Entry";

/**
 * The Add Ledger Entry form and the Debit Advice table, shared by the Accountant's and the Owner's ledger
 * screens so they cannot drift apart. Each screen owns its tabs and places the two parts itself, and calls
 * `openNew` when its Add Ledger Entry tab is clicked. A new entry's draft lives here, so what was typed
 * survives moving between tabs; an edit is kept apart from it and is dropped once the user opens Add.
 */
export function useLedgerEntry({
  entries,
  onEntries,
  debitAdvices,
  onDebitAdvices,
  showForm,
  showTable,
  serverPage,
}: {
  entries: LedgerEntry[];
  onEntries: (entries: LedgerEntry[]) => void;
  debitAdvices: DebitAdvice[];
  onDebitAdvices: (advices: DebitAdvice[]) => void;
  showForm: () => void;
  showTable: () => void;
  /** Server pagination for the Debit Advice register footer. */
  serverPage?: LedgerServerPage;
}) {
  const [createLedger] = useCreateLedgerMutation();
  const [updateLedger] = useUpdateLedgerMutation();
  const [newDraft, setNewDraft] = useState(newDebitAdvice);
  const [editDraft, setEditDraft] = useState<DebitAdvice | null>(null);
  const draft = editDraft ?? newDraft;
  const setDraft: Dispatch<SetStateAction<DebitAdvice>> = (update) => {
    if (!editDraft) return setNewDraft(update);
    setEditDraft((d) => (d === null ? null : typeof update === "function" ? update(d) : update));
  };
  const draftIndex = debitAdvices.findIndex((a) => a.id === draft.id);
  const isNew = draftIndex < 0;
  // The table sits below other content, so bring it into view after a save to show the new entry.
  const tableRef = useRef<HTMLDivElement>(null);
  const scrollToTable = useRef(false);
  useEffect(() => {
    if (!scrollToTable.current || !tableRef.current) return;
    scrollToTable.current = false;
    tableRef.current.scrollIntoView?.({ behavior: "smooth", block: "start" });
  });
  const form = (
    <DebitAdviceForm
      key={draft.id}
      form={draft}
      setForm={setDraft}
      isNew={isNew}
      onCancel={() => {
        if (editDraft) {
          setEditDraft(null);
          showTable();
        } else setNewDraft(newDebitAdvice());
      }}
      onSave={async (saved) => {
        // Persist to the backend: PUT updateLedger when the entry already has a server UUID, else POST
        // createLedger (a hardcoded sheet row has no server id, so it saves as a new entry).
        const isUpdate = !isNew && isUuid(saved.id);
        const body = toGsmOxLedgerRequest(saved, isUpdate);
        const result = isUpdate ? await updateLedger(body) : await createLedger(body);
        if ("error" in result) {
          const status = (result.error as { status?: unknown }).status;
          snackbar.error(
            status === 409
              ? "This entry was changed elsewhere. Reopen it and try again."
              : describeApiError(result.error) || "Could not save the ledger entry.",
          );
          return; // keep the form open so nothing typed is lost
        }
        // The reply carries the server id (there is no list endpoint to re-fetch, so the table stays local).
        const serverId = result.data?.id;
        const persisted = serverId && isUuid(serverId) ? { ...saved, id: serverId } : saved;
        onDebitAdvices(
          isNew
            ? [...debitAdvices, { ...persisted, added: true }]
            : debitAdvices.map((a) => (a.id === saved.id ? persisted : a)),
        );
        onEntries(syncTptEntries(entries, persisted.id, tptEntriesFor(persisted)));
        if (editDraft) setEditDraft(null);
        else setNewDraft(newDebitAdvice());
        scrollToTable.current = true;
        // Both a new entry and an edit return to the table, which lists a new entry first.
        showTable();
        snackbar.success("Ledger entry saved; available in shipment payments");
      }}
    />
  );
  const table = (
    <div ref={tableRef}>
      <DebitAdviceRegister
        advices={debitAdvices}
        onAdvices={onDebitAdvices}
        entries={entries}
        onEntries={onEntries}
        {...(serverPage ? { serverPage } : {})}
        onEdit={(advice) => {
          // An advance has no amount yet, so give it the one row the form offers; left blank, it is not saved.
          setEditDraft(advice.tranches.length ? advice : { ...advice, tranches: [blankTranche()] });
          showForm();
        }}
      />
    </div>
  );
  // The Add Ledger Entry tab always means a new entry, so leave any edit that was not saved.
  const openNew = () => setEditDraft(null);
  return { form, table, openNew };
}
