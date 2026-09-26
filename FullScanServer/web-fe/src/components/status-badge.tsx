import type { AssignmentBucket } from '../types/assignment';

export const BUCKET_LABELS: Readonly<Record<AssignmentBucket, string>> = {
  pending: 'Pending',
  beyond_tat: 'Beyond TAT',
  completed: 'Completed',
};

const BUCKET_CLASSES: Readonly<Record<AssignmentBucket, string>> = {
  pending: 'bg-amber-100 text-amber-900 ring-amber-600/20 dark:bg-amber-950 dark:text-amber-200',
  beyond_tat: 'bg-red-100 text-red-800 ring-red-600/20 dark:bg-red-950 dark:text-red-200',
  completed: 'bg-emerald-100 text-emerald-800 ring-emerald-600/20 dark:bg-emerald-950 dark:text-emerald-200',
};

export function BucketBadge({ bucket }: { readonly bucket: AssignmentBucket }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ring-1 ring-inset ${BUCKET_CLASSES[bucket]}`}
    >
      {BUCKET_LABELS[bucket]}
    </span>
  );
}

export function StatusLabel({ label }: { readonly label: string }) {
  return (
    <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
      {label}
    </span>
  );
}
