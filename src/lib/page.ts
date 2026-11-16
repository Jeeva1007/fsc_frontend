/** Controlled server pagination handed to a table: the pager drives the backend `page`/`size`. 1-based. */
export type ServerPage = {
  page: number; // 1-based (UI); convert to zero-based when building query args
  size: number;
  total: number; // totalElements from the server
  onPage: (page: number) => void;
  onPageSize?: (size: number) => void;
};

/**
 * The ledger register's server page plus its server-side filters (GET /gsmOxLedger/ledgerList `party` =
 * Party Name, `shipper` = Shipper of any BE line), so choosing one searches every page, not just the rows
 * on screen.
 */
export type LedgerServerPage = ServerPage & {
  party?: string;
  onParty?: (party: string) => void;
  shipper?: string;
  onShipper?: (shipper: string) => void;
};

/** A page of server rows plus the paging metadata the table footer needs. */
export type Page<T> = {
  items: T[];
  total: number; // totalElements across all pages
  page: number; // zero-based, as the backend reports it
  size: number;
  totalPages: number;
};

/**
 * Normalises a backend reply into a `Page<T>`. Accepts either a paged envelope
 * `{ content, totalElements, page, size, totalPages }` (already unwrapped by baseApi) or a bare array.
 */
export function toPage<T>(reply: unknown): Page<T> {
  if (Array.isArray(reply)) {
    return { items: reply as T[], total: reply.length, page: 0, size: reply.length, totalPages: 1 };
  }
  const r = (reply ?? {}) as {
    content?: unknown;
    totalElements?: unknown;
    page?: unknown;
    size?: unknown;
    totalPages?: unknown;
  };
  const items = Array.isArray(r.content) ? (r.content as T[]) : [];
  const num = (v: unknown, d: number) => (Number.isFinite(Number(v)) ? Number(v) : d);
  const total = num(r.totalElements, items.length);
  const size = num(r.size, items.length || 10);
  return {
    items,
    total,
    page: num(r.page, 0),
    size,
    totalPages: num(r.totalPages, Math.max(1, Math.ceil(total / Math.max(1, size)))),
  };
}
