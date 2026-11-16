import type { MasterOptions, PortCha, ProductRow } from "@/types/api";

/** A dropdown entry: `value` is what the form stores (the master code), `label` is what the user sees. */
export type Choice = { value: string; label: string };

/** Built-in Linked Agencies, used until the server's linked agency list has loaded. */
export const DEFAULT_AGENCIES = ["FS", "PQ", "OE", "Enhancement"];

const asChoice = (value: string): Choice => ({ value, label: value });

/**
 * Dropdown entries for one GET /masters/options list (e.g. "shippers", "ports").
 * Falls back to the built-in list while the master data is not available (not signed in, loading, or failed).
 * `fromMaster` tells the caller whether the list is authoritative (then free-typed values are not allowed).
 */
export function masterChoices(
  master: MasterOptions | undefined,
  key: string,
  fallback: string[],
): { choices: Choice[]; fromMaster: boolean } {
  const list = master?.[key];
  if (!list?.length) return { choices: fallback.map(asChoice), fromMaster: false };
  const seen = new Set<string>();
  const choices: Choice[] = [];
  for (const o of list) {
    const value = (o.code || o.name || "").trim();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    const name = (o.name || "").trim();
    choices.push({ value, label: name && name !== value ? `${name} (${value})` : value });
  }
  return { choices, fromMaster: true };
}

/**
 * Names from one dropdown list (e.g. `parties` = receiverDropdown, `shippers` = shipperDropdown) for a field
 * that stores the NAME as free text on the backend (the ledger's Party Name / Party / Shipper). Blank and
 * repeated names are dropped (the code stands in for a missing name) and the list is sorted. Falls back to
 * `fallback` (typing allowed) until the list has loaded.
 */
export function masterNameChoices(
  master: MasterOptions | undefined,
  key: string,
  fallback: string[],
): { choices: string[]; fromMaster: boolean } {
  const names = [...new Set((master?.[key] ?? []).map((o) => (o.name || o.code || "").trim()))]
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
  return names.length
    ? { choices: names, fromMaster: true }
    : { choices: fallback, fromMaster: false };
}
/** Receiver names (receiverDropdown); see masterNameChoices. */
export const receiverNameChoices = (master: MasterOptions | undefined, fallback: string[]) =>
  masterNameChoices(master, "parties", fallback);
/** Shipper names (shipperDropdown); see masterNameChoices. */
export const shipperNameChoices = (master: MasterOptions | undefined, fallback: string[]) =>
  masterNameChoices(master, "shippers", fallback);

/** A port's code from its code or name ("Chennai" or "CHN" -> "CHN"); "" when it is not on the list. */
export function portCode(master: MasterOptions | undefined, value: string | undefined): string {
  const wanted = (value ?? "").trim().toLowerCase();
  if (!wanted) return "";
  const hit = master?.["ports"]?.find(
    (p) => p.code?.trim().toLowerCase() === wanted || p.name?.trim().toLowerCase() === wanted,
  );
  return hit?.code?.trim() ?? "";
}

export type ChaChoice = Choice & { chaId: number | string };

/** One dropdown entry per CHA for GET /ports/{portCode}/chas rows; `value` is the code the form stores. */
export function portChaChoices(rows: PortCha[]): ChaChoice[] {
  const seen = new Set<number | string>();
  const choices: ChaChoice[] = [];
  for (const row of rows) {
    const value = (row.chaCode || row.chaName || "").trim();
    if (row.chaId == null || !value || seen.has(row.chaId)) continue;
    seen.add(row.chaId);
    const name = (row.chaName || "").trim();
    choices.push({
      value,
      label: name && name !== value ? `${name} (${value})` : value,
      chaId: row.chaId,
    });
  }
  return choices;
}

/** Product names for the dropdown, in the server's order, without blanks or repeats. */
export function productNames(rows: ProductRow[] | undefined): string[] {
  const names = (Array.isArray(rows) ? rows : []).map((r) => (r.name ?? "").trim()).filter(Boolean);
  return [...new Set(names)];
}

/** A Linked Agency as the dropdown shows it: the stored code, with its name beside it when known. */
export type AgencyOption = { code: string; name: string };
/**
 * Linked Agencies from `linkedServices` (GET /shipments/linkedAgencyDropdown), e.g. { code: "EN", name:
 * "Enhancement" }. The code stays the stored value, as before; the name is only shown. The built-in
 * DEFAULT_AGENCIES (no names) until the list has loaded.
 */
export function agencyOptions(master: MasterOptions | undefined): AgencyOption[] {
  const list = master?.["linkedServices"];
  if (!list?.length) return DEFAULT_AGENCIES.map((code) => ({ code, name: "" }));
  const seen = new Set<string>();
  const out: AgencyOption[] = [];
  for (const o of list) {
    const code = (o.code || o.name || "").trim();
    if (!code || seen.has(code)) continue;
    seen.add(code);
    const name = (o.name || "").trim();
    out.push({ code, name: name === code ? "" : name });
  }
  return out;
}
/** "EN – Enhancement", or just the code when its name is unknown (an older value, or the list not loaded). */
export const agencyLabel = (code: string, options: AgencyOption[]) => {
  const name = options.find((o) => o.code === code)?.name;
  return name ? `${code} – ${name}` : code;
};
