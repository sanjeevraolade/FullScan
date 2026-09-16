interface PaginationProps {
  readonly offset: number;
  readonly pageSize: number;
  readonly shownCount: number;
  readonly total: number;
  readonly isBusy: boolean;
  readonly onChange: (offset: number) => void;
}

export function Pagination({ offset, pageSize, shownCount, total, isBusy, onChange }: PaginationProps) {
  const first = total === 0 ? 0 : offset + 1;
  const last = Math.min(offset + shownCount, total);

  return (
    <nav aria-label="Pagination" className="mt-4 flex flex-wrap items-center justify-end gap-3">
      <span className="text-sm text-slate-500 dark:text-slate-400" aria-live="polite">
        {first}–{last} of {total}
      </span>
      <button
        type="button"
        className="btn-secondary"
        disabled={isBusy || offset === 0}
        onClick={() => onChange(Math.max(0, offset - pageSize))}
      >
        Previous
      </button>
      <button
        type="button"
        className="btn-secondary"
        disabled={isBusy || last >= total}
        onClick={() => onChange(offset + pageSize)}
      >
        Next
      </button>
    </nav>
  );
}
