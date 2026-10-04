import type { AdminCaseEvidence } from '../types/cases';
import { formatBytes, formatUtcTimestamp } from '../utils/format';
import { Badge } from './badges';

/**
 * Evidence for one component: web uploads (from a browser — no GPS or watermark) and
 * photos captured in the mobile app (with their document type). The badges say which,
 * and flag a capture the app reported under a mocked location.
 */
export function CaseEvidenceList({ evidence }: { readonly evidence: readonly AdminCaseEvidence[] }) {
  if (evidence.length === 0) {
    return <p className="text-sm text-slate-500 dark:text-slate-400">No evidence for this component.</p>;
  }

  return (
    <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
      {evidence.map((item) => (
        <li key={item.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-3 py-2 text-sm">
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate font-medium">{item.fileName}</span>
            {item.source === 'mobile_capture' ? (
              <Badge tone="info">App capture</Badge>
            ) : (
              <Badge tone="neutral">Web upload</Badge>
            )}
            {item.isMockLocation ? <Badge tone="danger">Mock location</Badge> : null}
          </span>
          <span className="text-slate-500 dark:text-slate-400">
            {item.documentTypeCode ? `${item.documentTypeCode} · ` : null}
            {formatBytes(item.sizeBytes)} · {item.uploadedBy.name} ({item.uploadedBy.username}) ·{' '}
            <time dateTime={item.uploadedAt}>{formatUtcTimestamp(item.uploadedAt)}</time>
          </span>
        </li>
      ))}
    </ul>
  );
}
