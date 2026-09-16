import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { AssignmentDetail as AssignmentDetailModel } from '../types/assignment';
import { formatAddressType, formatResidenceType, formatUtcTimestamp, formatWallClock } from '../utils/format';
import { BucketBadge, StatusLabel } from './status-badge';

function DetailItem({ label, children }: { readonly label: string; readonly children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium tracking-wide text-slate-500 uppercase dark:text-slate-400">{label}</dt>
      <dd className="mt-1 text-sm break-words text-slate-900 dark:text-slate-100">{children}</dd>
    </div>
  );
}

function Section({ title, children }: { readonly title: string; readonly children: ReactNode }) {
  const headingId = `section-${title.toLowerCase().replace(/\W+/g, '-')}`;
  return (
    <section aria-labelledby={headingId} className="card p-5">
      <h2 id={headingId} className="text-base font-semibold">
        {title}
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function orDash(value: string): string {
  return value.trim() || '—';
}

export function AssignmentDetail({ detail }: { readonly detail: AssignmentDetailModel }) {
  const addressType = formatAddressType(detail.addressType);

  return (
    <div className="grid gap-5">
      <div className="card flex flex-wrap items-start justify-between gap-4 p-5">
        <div className="min-w-0">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {detail.caseRef} · {detail.clientName}
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">{detail.candidateName}</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            {detail.verificationType}
            {addressType ? ` · ${addressType}` : ''}
          </p>
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          <BucketBadge bucket={detail.bucket} />
          <StatusLabel label={detail.componentStatusLabel} />
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Section title="Status">
          <dl className="grid gap-4 sm:grid-cols-2">
            <DetailItem label="Category">
              <BucketBadge bucket={detail.bucket} />
            </DetailItem>
            <DetailItem label="Component status">{detail.componentStatusLabel}</DetailItem>
            <DetailItem label="TAT due">
              <time dateTime={detail.tatDueAt}>{formatWallClock(detail.tatDueAt)}</time>
            </DetailItem>
            <DetailItem label="Last updated">
              <time dateTime={detail.updatedAt}>{formatUtcTimestamp(detail.updatedAt)}</time>
            </DetailItem>
          </dl>
        </Section>

        <Section title="Location">
          <dl className="grid gap-4">
            <DetailItem label="Address">{orDash(detail.address)}</DetailItem>
            <div className="grid gap-4 sm:grid-cols-2">
              <DetailItem label="Locality">{orDash(detail.location)}</DetailItem>
              <DetailItem label="Residence type">{formatResidenceType(detail.residenceType)}</DetailItem>
            </div>
          </dl>
        </Section>

        <Section title="Candidate">
          <dl className="grid gap-4 sm:grid-cols-2">
            <DetailItem label="Name">{detail.candidateName}</DetailItem>
            <DetailItem label="Father / spouse">{orDash(detail.fatherOrSpouseName)}</DetailItem>
            <DetailItem label="Employer">{orDash(detail.employerName)}</DetailItem>
            <DetailItem label="Client">{detail.clientName}</DetailItem>
          </dl>
        </Section>

        <Section title="Client instructions">
          <p className="text-sm whitespace-pre-line text-slate-700 dark:text-slate-300">
            {orDash(detail.clientInstructions)}
          </p>
        </Section>
      </div>

      {detail.siblingComponents.length > 0 ? (
        <Section title="Other checks on this case">
          <ul className="divide-y divide-slate-200 dark:divide-slate-800">
            {detail.siblingComponents.map((sibling) => {
              const siblingAddressType = formatAddressType(sibling.addressType);
              const label = `${sibling.verificationType}${siblingAddressType ? ` · ${siblingAddressType}` : ''}`;

              return (
                <li key={sibling.componentId} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                  {sibling.isAssignedToYou ? (
                    <Link
                      to={`/assignments/${encodeURIComponent(sibling.componentId)}`}
                      className="text-sm font-medium text-brand-600 underline-offset-2 hover:underline dark:text-brand-100"
                    >
                      {label}
                    </Link>
                  ) : (
                    <span className="text-sm text-slate-700 dark:text-slate-300">
                      {label} <span className="text-slate-500">(not assigned to you)</span>
                    </span>
                  )}
                  <StatusLabel label={sibling.componentStatusLabel} />
                </li>
              );
            })}
          </ul>
        </Section>
      ) : null}
    </div>
  );
}
