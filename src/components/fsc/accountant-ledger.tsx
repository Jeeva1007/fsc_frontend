import { useStoredView } from "@/lib/stored-view";
import { LedgerCards } from "./ledger-cards";
import { dealLedgerStats, statCards } from "./ledger-card-items";
import { useLedgerCardsQuery } from "@/store/api/ledger.api";
import { Button } from "@/components/ui/button";
import { LEDGER_ENTRY_TAB, useLedgerEntry } from "./ledger-entry";
import type { DebitAdvice } from "@/lib/debit-advice";
import { money } from "@/lib/fsc";
import type { LedgerEntry } from "@/lib/fsc-finance";
import type { LedgerServerPage } from "@/lib/page";

const DEAL_TAB = "GSM - OX Deal Ledger";
/**
 * The Accountant's own ledger screen, kept apart from `Ledger` so it can change without touching the
 * Owner's or Shippers' screens. Two tabs: the deal summary cards and tables, and the form that adds or edits a TPT entry.
 */
export function AccountantLedger({
  entries,
  onEntries,
  debitAdvices,
  onDebitAdvices,
  ledgerPage,
}: {
  entries: LedgerEntry[];
  onEntries: (entries: LedgerEntry[]) => void;
  debitAdvices: DebitAdvice[];
  onDebitAdvices: (advices: DebitAdvice[]) => void;
  ledgerPage?: LedgerServerPage;
}) {
  // The open tab survives a page refresh (user request, 2026-11-16).
  const [tab, setTab] = useStoredView(
    "ledger.accountantTab",
    DEAL_TAB,
    (v) => v === DEAL_TAB || v === LEDGER_ENTRY_TAB,
  );
  const { form, table, openNew } = useLedgerEntry({
    entries,
    onEntries,
    debitAdvices,
    onDebitAdvices,
    showForm: () => setTab(LEDGER_ENTRY_TAB),
    showTable: () => setTab(DEAL_TAB),
    ...(ledgerPage ? { serverPage: ledgerPage } : {}),
  });
  // The five deal cards come from GET /gsmOxLedger/cards (a dash until it loads).
  const { data: cards } = useLedgerCardsQuery();
  const stats = dealLedgerStats(cards);
  return (
    <>
      <div className="tab-bar ledger-tabs">
        {[DEAL_TAB, LEDGER_ENTRY_TAB].map((name) => (
          <Button
            variant="ghost"
            key={name}
            className={tab === name ? "selected" : ""}
            onClick={() => {
              if (name === LEDGER_ENTRY_TAB) openNew();
              setTab(name);
            }}
          >
            {name}
          </Button>
        ))}
      </div>
      {tab === LEDGER_ENTRY_TAB ? (
        form
      ) : (
        <>
          <h2 className="ledger-title">{DEAL_TAB}</h2>
          <LedgerCards label={`${DEAL_TAB} summary`} items={statCards(stats)} />
          {table}
        </>
      )}
    </>
  );
}
