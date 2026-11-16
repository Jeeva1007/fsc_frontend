/**
 * Currency choices for every currency dropdown (ledger entry Currency / BE Currency / Paid Currency and the
 * TPT entry Currency), shown as "United States (USD)" and stored as the ISO 4217 code. Only USD is offered
 * (user request, 2026-11-13: Turkey (TRY) removed). A saved record with another code still shows it.
 */
const CURRENCIES = [["United States", "USD"]] as const;

export const currencyOptions = CURRENCIES.map(([country, code]) => ({
  value: code,
  label: `${country} (${code})`,
}));
