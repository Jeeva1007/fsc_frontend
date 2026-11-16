import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { pageWindow } from "@/lib/pagination";
import { SearchableSelect } from "@/components/common/form";

/** Reusable table footer: result range, rows-per-page, first/prev/numbers/next/last. Pages are 1-based. */
export function TablePagination({
  page,
  pageSize,
  total,
  onPage,
  onPageSize,
  pageSizes = [10, 25, 50, 100],
  noun = "records",
}: {
  page: number;
  pageSize: number;
  total: number;
  onPage: (page: number) => void;
  /** Omit to hide the rows-per-page selector. */
  onPageSize?: (size: number) => void;
  pageSizes?: number[];
  noun?: string;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  // The current size is always on the list, so it shows as selected.
  const sizes = [...new Set([...pageSizes, pageSize])].sort((a, b) => a - b);
  const current = Math.min(page, pages);
  const from = total ? (current - 1) * pageSize + 1 : 0;
  const to = Math.min(current * pageSize, total);
  const nav = (label: string, target: number, disabled: boolean, icon: React.ReactNode) => (
    <Button
      variant="ghost"
      size="icon"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={() => onPage(target)}
    >
      {icon}
    </Button>
  );
  return (
    <div className="table-footer pager">
      <span className="pager-range">
        Showing <b>{from}</b>–<b>{to}</b> of <b>{total}</b> {noun}
      </span>
      <div className="pager-end">
        {onPageSize && (
          <label className="pager-size">
            <span>Rows per page</span>
            <SearchableSelect
              trigger="button"
              size="sm"
              ariaLabel="Rows per page"
              menuPlacement="fixed"
              searchable={false}
              options={sizes.map((n) => ({ value: String(n), label: String(n) }))}
              value={String(pageSize)}
              onChange={(v) => onPageSize(Number(v))}
            />
          </label>
        )}
        <nav className="pagination" aria-label="Pagination">
          {nav("First page", 1, current === 1, <ChevronsLeft size={14} />)}
          {nav("Previous page", current - 1, current === 1, <ChevronLeft size={14} />)}
          {pageWindow(current, pages).map((p, i) =>
            p === "gap" ? (
              <span className="pager-gap" key={`gap-${i}`} aria-hidden="true">
                …
              </span>
            ) : (
              <Button
                variant="ghost"
                key={p}
                className={current === p ? "current" : ""}
                aria-label={`Page ${p}`}
                aria-current={current === p ? "page" : undefined}
                onClick={() => onPage(p)}
              >
                {p}
              </Button>
            ),
          )}
          {nav("Next page", current + 1, current >= pages, <ChevronRight size={14} />)}
          {nav("Last page", pages, current >= pages, <ChevronsRight size={14} />)}
        </nav>
      </div>
    </div>
  );
}
