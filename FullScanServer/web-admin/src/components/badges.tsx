import type { AdminRole } from '../types/auth';
import type { CaseBucket } from '../types/cases';
import type { DeviceChangeRequestStatus } from '../types/device-change';
import { BUCKET_LABELS, REQUEST_STATUS_LABELS, ROLE_LABELS } from '../utils/labels';

type Tone = 'neutral' | 'info' | 'warning' | 'danger' | 'success' | 'brand';

const TONE_CLASSES: Readonly<Record<Tone, string>> = {
  neutral: 'bg-slate-100 text-slate-700 ring-slate-500/20 dark:bg-slate-800 dark:text-slate-300',
  info: 'bg-sky-100 text-sky-800 ring-sky-600/20 dark:bg-sky-950 dark:text-sky-200',
  warning: 'bg-amber-100 text-amber-900 ring-amber-600/20 dark:bg-amber-950 dark:text-amber-200',
  danger: 'bg-red-100 text-red-800 ring-red-600/20 dark:bg-red-950 dark:text-red-200',
  success: 'bg-emerald-100 text-emerald-800 ring-emerald-600/20 dark:bg-emerald-950 dark:text-emerald-200',
  brand: 'bg-brand-50 text-brand-700 ring-brand-500/20 dark:bg-brand-700/30 dark:text-brand-100',
};

export function Badge({ tone, children }: { readonly tone: Tone; readonly children: React.ReactNode }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ring-1 ring-inset ${TONE_CLASSES[tone]}`}
    >
      {children}
    </span>
  );
}

const BUCKET_TONES: Readonly<Record<CaseBucket, Tone>> = {
  new: 'info',
  pending: 'warning',
  beyond_tat: 'danger',
  completed: 'success',
};

export function BucketBadge({ bucket }: { readonly bucket: CaseBucket }) {
  return <Badge tone={BUCKET_TONES[bucket]}>{BUCKET_LABELS[bucket]}</Badge>;
}

const REQUEST_TONES: Readonly<Record<DeviceChangeRequestStatus, Tone>> = {
  pending: 'warning',
  approved: 'success',
  rejected: 'danger',
};

export function RequestStatusBadge({ status }: { readonly status: DeviceChangeRequestStatus }) {
  return <Badge tone={REQUEST_TONES[status]}>{REQUEST_STATUS_LABELS[status]}</Badge>;
}

export function RoleBadge({ role }: { readonly role: AdminRole }) {
  return <Badge tone={role === 'super_admin' ? 'brand' : 'neutral'}>{ROLE_LABELS[role]}</Badge>;
}

export function ActiveBadge({ isActive }: { readonly isActive: boolean }) {
  return <Badge tone={isActive ? 'success' : 'neutral'}>{isActive ? 'Active' : 'Deactivated'}</Badge>;
}
