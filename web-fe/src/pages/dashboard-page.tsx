import { useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Alert } from '../components/alert';
import { AssignmentList } from '../components/assignment-list';
import { Spinner } from '../components/spinner';
import { useAssignmentStore } from '../stores/assignment-store';
import { useAuthStore } from '../stores/auth-store';
import type { AssignmentBucket } from '../types/assignment';
import {
  countAssignments,
  findDueSoon,
  findNeedsAttention,
  flattenAssignmentGroups,
} from '../utils/assignment-filters';
import { useDocumentTitle } from '../utils/use-document-title';

interface StatCardProps {
  readonly label: string;
  readonly value: number;
  readonly hint: string;
  readonly to: string;
  readonly accentClass: string;
}

function StatCard({ label, value, hint, to, accentClass }: StatCardProps) {
  return (
    <Link
      to={to}
      className="card group block p-5 transition-shadow hover:shadow-md focus-visible:shadow-md"
    >
      <span className={`block h-1 w-8 rounded-full ${accentClass}`} aria-hidden="true" />
      <p className="mt-3 text-sm font-medium text-slate-600 dark:text-slate-300">{label}</p>
      <p className="mt-1 text-3xl font-bold tracking-tight tabular-nums">{value}</p>
      <p className="mt-1 text-xs text-slate-500 group-hover:text-brand-600 dark:text-slate-400">{hint}</p>
    </Link>
  );
}

const BUCKET_CARDS: readonly { readonly bucket: AssignmentBucket; readonly label: string; readonly hint: string; readonly accentClass: string }[] = [
  { bucket: 'pending', label: 'Pending', hint: 'Open work within TAT', accentClass: 'bg-amber-500' },
  { bucket: 'beyond_tat', label: 'Beyond TAT', hint: 'Past the deadline', accentClass: 'bg-red-600' },
  { bucket: 'completed', label: 'Completed', hint: 'Verification submitted', accentClass: 'bg-emerald-600' },
];

export function DashboardPage() {
  useDocumentTitle('Dashboard');
  const fieldExecutive = useAuthStore((state) => state.fieldExecutive);
  const groups = useAssignmentStore((state) => state.groups);
  const listStatus = useAssignmentStore((state) => state.listStatus);
  const listError = useAssignmentStore((state) => state.listError);
  const listLoadedAt = useAssignmentStore((state) => state.listLoadedAt);
  const fetchAssignments = useAssignmentStore((state) => state.fetchAssignments);

  useEffect(() => {
    void fetchAssignments();
  }, [fetchAssignments]);

  const { counts, dueSoonCount, needsAttention } = useMemo(() => {
    const assignments = flattenAssignmentGroups(groups);
    return {
      counts: countAssignments(groups),
      dueSoonCount: findDueSoon(assignments, new Date()).length,
      needsAttention: findNeedsAttention(assignments),
    };
    // listLoadedAt re-derives "due soon" against the current time on every refresh.
  }, [groups, listLoadedAt]);

  const hasData = listLoadedAt !== null;

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {fieldExecutive ? `Hello, ${fieldExecutive.name.split(' ')[0]}` : 'Dashboard'}
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Your assignments at a glance
            {listLoadedAt ? ` · updated ${new Date(listLoadedAt).toLocaleTimeString([], { timeStyle: 'short' })}` : ''}
          </p>
        </div>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => void fetchAssignments()}
          disabled={listStatus === 'loading'}
        >
          {listStatus === 'loading' ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {listStatus === 'error' && listError ? (
        <Alert
          variant="error"
          action={
            <button type="button" className="btn-secondary" onClick={() => void fetchAssignments()}>
              Retry
            </button>
          }
        >
          {listError}
        </Alert>
      ) : null}

      {!hasData && listStatus === 'loading' ? (
        <Spinner label="Loading your assignments…" />
      ) : hasData ? (
        <>
          <section aria-label="Assignment summary" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {BUCKET_CARDS.map((card) => (
              <StatCard
                key={card.bucket}
                label={card.label}
                value={counts[card.bucket]}
                hint={card.hint}
                to={`/assignments?bucket=${card.bucket}`}
                accentClass={card.accentClass}
              />
            ))}
            <StatCard
              label="Due in 24 hours"
              value={dueSoonCount}
              hint="Pending, TAT within a day"
              to="/assignments?bucket=pending"
              accentClass="bg-brand-500"
            />
          </section>

          <section aria-labelledby="needs-attention-heading" className="grid gap-3">
            <div className="flex items-baseline justify-between gap-2">
              <h2 id="needs-attention-heading" className="text-lg font-semibold">
                Needs attention
              </h2>
              <Link to="/assignments" className="text-sm font-medium text-brand-600 hover:underline dark:text-brand-100">
                View all
              </Link>
            </div>
            <AssignmentList assignments={needsAttention} emptyMessage="Nothing open right now — you're all caught up." />
          </section>
        </>
      ) : null}
    </div>
  );
}
