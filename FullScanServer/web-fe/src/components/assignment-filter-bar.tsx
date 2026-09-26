import { useId } from 'react';
import { ASSIGNMENT_BUCKETS, type AssignmentBucketFilter, type AssignmentFilter } from '../types/assignment';
import type { AssignmentCounts } from '../utils/assignment-filters';
import { BUCKET_LABELS } from './status-badge';

interface AssignmentFilterBarProps {
  readonly filter: AssignmentFilter;
  readonly counts: AssignmentCounts;
  readonly onChange: (changes: Partial<AssignmentFilter>) => void;
}

const BUCKET_OPTIONS: readonly AssignmentBucketFilter[] = ['all', ...ASSIGNMENT_BUCKETS];

export function AssignmentFilterBar({ filter, counts, onChange }: AssignmentFilterBarProps) {
  const searchId = useId();
  const total = counts.pending + counts.beyond_tat + counts.completed;

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
      <fieldset>
        <legend className="sr-only">Show assignments</legend>
        <div className="flex flex-wrap gap-2">
          {BUCKET_OPTIONS.map((bucket) => {
            const isSelected = filter.bucket === bucket;
            const count = bucket === 'all' ? total : counts[bucket];
            const label = bucket === 'all' ? 'All' : BUCKET_LABELS[bucket];

            return (
              <button
                key={bucket}
                type="button"
                aria-pressed={isSelected}
                onClick={() => onChange({ bucket })}
                className={`btn min-h-10 rounded-full border px-3.5 ${
                  isSelected
                    ? 'border-brand-500 bg-brand-500 text-white'
                    : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800'
                }`}
              >
                {label}
                <span
                  className={`rounded-full px-1.5 text-xs ${isSelected ? 'bg-white/25' : 'bg-slate-100 dark:bg-slate-800'}`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="w-full lg:max-w-xs">
        <label htmlFor={searchId} className="label">
          Search
        </label>
        <input
          id={searchId}
          type="search"
          className="input"
          placeholder="Case ref, candidate, client, address…"
          value={filter.query}
          onChange={(event) => onChange({ query: event.target.value })}
          autoComplete="off"
        />
      </div>
    </div>
  );
}
