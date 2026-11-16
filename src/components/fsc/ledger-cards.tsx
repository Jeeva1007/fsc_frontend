import type { ReactNode } from "react";
import "./ledger-cards.css";

/** The accent of a card: its top bar, icon chip and (for "warning"/"success"/"danger") its figure. */
export type LedgerCardTone = "primary" | "success" | "warning" | "danger" | "neutral";

export type LedgerCardItem = {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  icon: ReactNode;
  tone?: LedgerCardTone;
};

/**
 * The ledger screens' summary cards (GSM - OX Deal Ledger, Rob ledger and each shipper's ledger), in one
 * shared design: an accent bar, an icon chip, the label, the figure and a short note. All the cards sit in
 * ONE row on every screen; sizes scale with the width of the card area (so both rows on a screen match),
 * and where the area is too narrow to read (a phone) the same row scrolls sideways.
 * Colours come from the theme tokens, so light and dark mode both work.
 */
export function LedgerCards({ items, label }: { items: LedgerCardItem[]; label: string }) {
  return (
    // .lc-wrap is the size container: every row on a screen sizes its text from the same width.
    <div className="lc-wrap">
      <div className="lc-grid" role="list" aria-label={label}>
        {items.map((item) => (
          <div key={item.label} role="listitem" className={`lc-card lc-${item.tone ?? "primary"}`}>
            <div className="lc-head">
              <span className="lc-icon" aria-hidden="true">
                {item.icon}
              </span>
              <span className="lc-label">{item.label}</span>
            </div>
            <strong className="lc-value">{item.value}</strong>
            {item.sub ? <small className="lc-sub">{item.sub}</small> : null}
          </div>
        ))}
      </div>
    </div>
  );
}
