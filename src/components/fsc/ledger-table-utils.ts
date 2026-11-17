import { useState } from "react";

/**
 * Balance column colour (user request, 2026-11-16): positive green, negative red, zero plain. Used on every
 * statement Balance cell (shipper, fallback and Rob), opening and closing rows included.
 */
export const balanceClass = (n: number) =>
  `font-semibold${n > 0 ? " amt-positive" : n < 0 ? " amt-negative" : ""}`;

/** True when any of `values`, joined, contains the search query (case-insensitive). */
export const contains = (values: unknown[], query: string) =>
  values.join(" ").toLowerCase().includes(query.trim().toLowerCase());

/** Page state that goes back to page 1 whenever the rows are narrowed. */
export function usePages<T>(rows: T[]) {
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(10);
  const lastPage = Math.max(1, Math.ceil(rows.length / size));
  const current = Math.min(page, lastPage);
  return {
    visible: rows.slice((current - 1) * size, current * size),
    reset: () => setPage(1),
    pagination: {
      page: current,
      pageSize: size,
      total: rows.length,
      onPage: setPage,
      onPageSize: (n: number) => {
        setSize(n);
        setPage(1);
      },
    },
  };
}
