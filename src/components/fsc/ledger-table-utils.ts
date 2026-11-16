import { useState } from "react";

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
