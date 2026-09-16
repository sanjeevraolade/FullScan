import { Link } from 'react-router-dom';
import type { Assignment } from '../types/assignment';
import { formatAddressType, formatUtcTimestamp, formatWallClock } from '../utils/format';
import { BucketBadge, StatusLabel } from './status-badge';

interface AssignmentListProps {
  readonly assignments: readonly Assignment[];
  readonly emptyMessage: string;
}

/** Every assignment is a link to its detail page, so the whole list is keyboard- and screen-reader-navigable. */
export function AssignmentList({ assignments, emptyMessage }: AssignmentListProps) {
  if (assignments.length === 0) {
    return (
      <p className="card px-4 py-10 text-center text-sm text-slate-500 dark:text-slate-400">{emptyMessage}</p>
    );
  }

  return (
    <ul className="card divide-y divide-slate-200 overflow-hidden dark:divide-slate-800">
      {assignments.map((assignment) => {
        const addressType = formatAddressType(assignment.addressType);

        return (
          <li key={assignment.componentId}>
            <Link
              to={`/assignments/${encodeURIComponent(assignment.componentId)}`}
              className="grid gap-x-6 gap-y-2 px-4 py-4 transition-colors hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-offset-[-2px] sm:grid-cols-[minmax(0,1.3fr)_minmax(0,2fr)_auto] sm:items-center sm:px-5 dark:hover:bg-slate-800/60 dark:focus-visible:bg-slate-800/60"
            >
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-slate-900 dark:text-slate-100">{assignment.candidateName}</span>
                  <BucketBadge bucket={assignment.bucket} />
                </p>
                <p className="mt-0.5 truncate text-sm text-slate-500 dark:text-slate-400">
                  {assignment.caseRef} · {assignment.clientName}
                </p>
              </div>

              <div className="min-w-0 text-sm">
                <p className="font-medium text-slate-700 dark:text-slate-300">
                  {assignment.verificationType}
                  {addressType ? <span className="font-normal text-slate-500"> · {addressType}</span> : null}
                </p>
                <p className="mt-0.5 line-clamp-2 text-slate-500 dark:text-slate-400">{assignment.address || '—'}</p>
              </div>

              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm sm:flex-col sm:items-end">
                <StatusLabel label={assignment.componentStatusLabel} />
                {assignment.bucket === 'completed' ? (
                  <span className="text-slate-500 dark:text-slate-400">
                    Updated <time dateTime={assignment.updatedAt}>{formatUtcTimestamp(assignment.updatedAt)}</time>
                  </span>
                ) : (
                  <span className="text-slate-500 dark:text-slate-400">
                    TAT <time dateTime={assignment.tatDueAt}>{formatWallClock(assignment.tatDueAt)}</time>
                  </span>
                )}
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
