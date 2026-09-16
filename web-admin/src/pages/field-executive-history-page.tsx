import { Fragment, useEffect, useId, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { fieldExecutivesApi } from '../api/field-executives-api';
import { Alert } from '../components/alert';
import { Badge } from '../components/badges';
import { DeviceHistoryTable, RequestHistoryTable } from '../components/device-change-tables';
import { Icon } from '../components/icon';
import { MockLocationEvent } from '../components/mock-location-event';
import { PageHeader } from '../components/page-header';
import { Spinner } from '../components/spinner';
import { useReferenceStore } from '../stores/reference-store';
import type { CaseBucket } from '../types/cases';
import type { FieldExecutiveCaseGroup, FieldExecutiveHistory } from '../types/field-executives';
import { formatUtcTimestamp, formatWallClock } from '../utils/format';
import { ADDRESS_TYPE_LABELS, labelFor, labelForCode, pluralize } from '../utils/labels';
import { useApiResource } from '../utils/use-api-resource';
import { useDebouncedValue } from '../utils/use-debounced-value';

const GROUP_META: Readonly<Record<CaseBucket, { readonly title: string; readonly empty: string }>> = {
  pending: { title: 'Pending', empty: 'No pending cases assigned.' },
  beyond_tat: { title: 'Beyond TAT', empty: 'No cases past their TAT.' },
  completed: { title: 'Completed', empty: 'No completed cases.' },
  new: { title: 'New (unclaimed)', empty: 'No unclaimed cases.' },
};

function Section({ title, meta, children }: { readonly title: string; readonly meta?: React.ReactNode; readonly children: React.ReactNode }) {
  return (
    <section className="grid grid-cols-1 gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-semibold">{title}</h2>
        {meta}
      </div>
      {children}
    </section>
  );
}

function CaseGroup({ group }: { readonly group: FieldExecutiveCaseGroup }) {
  const formOptions = useReferenceStore((state) => state.formOptions);
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const meta = GROUP_META[group.bucket];

  const toggle = (componentId: string): void => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(componentId)) {
        next.delete(componentId);
      } else {
        next.add(componentId);
      }
      return next;
    });
  };

  return (
    <Section
      title={meta.title}
      meta={
        <>
          <span className="text-sm text-slate-500">{pluralize(group.caseCount, 'case')}</span>
          {group.mockLocationEventCount > 0 ? (
            <Badge tone="danger">{pluralize(group.mockLocationEventCount, 'detection')}</Badge>
          ) : null}
        </>
      }
    >
      {group.caseCount === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">{meta.empty}</p>
      ) : (
        <div className="table-frame">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Case</th>
                <th scope="col">Candidate</th>
                <th scope="col">Component</th>
                <th scope="col">Address</th>
                <th scope="col">Status</th>
                <th scope="col">TAT due</th>
                <th scope="col">Detections</th>
              </tr>
            </thead>
            <tbody>
              {group.cases.map((entry) => {
                const hasEvents = entry.mockLocationEvents.length > 0;
                const isOpen = expanded.has(entry.componentId);
                const detailId = `detections-${entry.componentId}`;
                return (
                  <Fragment key={entry.componentId}>
                    <tr className={hasEvents ? 'bg-red-50/40 dark:bg-red-950/10' : undefined}>
                      <td>
                        <span className="cell-strong">{entry.caseRef}</span>
                        <span className="cell-muted">{entry.clientName}</span>
                      </td>
                      <td>{entry.candidateName}</td>
                      <td>
                        <span className="block">{entry.verificationType}</span>
                        {entry.addressType ? <span className="cell-muted">{labelFor(ADDRESS_TYPE_LABELS, entry.addressType)}</span> : null}
                      </td>
                      <td className="max-w-xs">{entry.address || '—'}</td>
                      <td>{formOptions ? labelForCode(formOptions.componentStatuses, entry.componentStatus) : entry.componentStatus}</td>
                      <td className="whitespace-nowrap">
                        <span className="cell-muted">{formatWallClock(entry.tatDueAt)}</span>
                      </td>
                      <td>
                        {hasEvents ? (
                          <button
                            type="button"
                            className="btn-danger-ghost btn-sm"
                            aria-expanded={isOpen}
                            aria-controls={detailId}
                            onClick={() => toggle(entry.componentId)}
                          >
                            <Icon name="chevron" className={`size-4 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
                            {entry.mockLocationEvents.length}
                            <span className="sr-only"> detections for {entry.caseRef}</span>
                          </button>
                        ) : (
                          <span className="cell-muted">—</span>
                        )}
                      </td>
                    </tr>
                    {hasEvents ? (
                      <tr id={detailId} hidden={!isOpen}>
                        <td colSpan={7}>
                          <ul className="grid grid-cols-1 gap-3">
                            {entry.mockLocationEvents.map((event) => (
                              <MockLocationEvent key={event.id} event={event} />
                            ))}
                          </ul>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );
}

function HistoryView({ history }: { readonly history: FieldExecutiveHistory }) {
  const { fieldExecutive: executive, summary } = history;
  const tiles = [
    { label: 'Cases assigned', value: String(summary.assignedComponentCount), isAlert: false },
    { label: 'Mock-location detections', value: String(summary.mockLocationEventCount), isAlert: summary.mockLocationEventCount > 0 },
    { label: 'Handsets involved', value: String(summary.distinctDeviceCount), isAlert: false },
    { label: 'First detected', value: summary.firstDetectedAt ? formatUtcTimestamp(summary.firstDetectedAt) : 'Never', isAlert: false },
    { label: 'Last detected', value: summary.lastDetectedAt ? formatUtcTimestamp(summary.lastDetectedAt) : 'Never', isAlert: false },
  ];

  return (
    <div className="grid grid-cols-1 gap-8">
      <section className="card p-5">
        <h2 className="text-lg font-semibold">{executive.name}</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {executive.username} · {executive.email} · {executive.isDeviceBound ? 'Device bound' : 'No device bound'}
        </p>
        <dl className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-5">
          {tiles.map((tile) => (
            <div
              key={tile.label}
              className={`rounded-lg border px-3 py-3 ${
                tile.isAlert
                  ? 'border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200'
                  : 'border-slate-200 dark:border-slate-800'
              }`}
            >
              <dt className="text-xs text-slate-500 dark:text-slate-400">{tile.label}</dt>
              <dd className="mt-1 text-lg font-semibold tabular-nums">{tile.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <Section title="Linked phones" meta={<span className="text-sm text-slate-500">{pluralize(history.deviceHistory.length, 'phone link')}</span>}>
        {history.deviceHistory.length === 0 ? (
          <p className="text-sm text-slate-500">No phone has been linked to this account yet.</p>
        ) : (
          <DeviceHistoryTable entries={history.deviceHistory} />
        )}
      </Section>

      <Section title="Device change requests" meta={<span className="text-sm text-slate-500">{pluralize(history.deviceChangeRequests.length, 'request')}</span>}>
        {history.deviceChangeRequests.length === 0 ? (
          <p className="text-sm text-slate-500">No device change requests.</p>
        ) : (
          <RequestHistoryTable requests={history.deviceChangeRequests} />
        )}
      </Section>

      {history.caseGroups.map((group) => (
        <CaseGroup key={group.bucket} group={group} />
      ))}

      {history.unlinkedMockLocationEvents.length > 0 ? (
        <Section title="Detections not tied to a case">
          <p className="-mt-2 text-sm text-slate-500">
            Reported at login or on resume, or against a case component that no longer exists.
          </p>
          <ul className="grid grid-cols-1 gap-3">
            {history.unlinkedMockLocationEvents.map((event) => (
              <MockLocationEvent key={event.id} event={event} />
            ))}
          </ul>
        </Section>
      ) : null}
    </div>
  );
}

export function FieldExecutiveHistoryPage() {
  const searchId = useId();
  const selectId = useId();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedId = searchParams.get('executive') ?? '';
  const ensureReference = useReferenceStore((state) => state.ensureLoaded);

  const [searchText, setSearchText] = useState('');
  const search = useDebouncedValue(searchText.trim());

  useEffect(() => {
    void ensureReference();
  }, [ensureReference]);

  const roster = useApiResource((signal) => fieldExecutivesApi.listFieldExecutives(search, signal), [search], {
    fallbackError: 'Could not load field executives.',
  });
  const history = useApiResource((signal) => fieldExecutivesApi.fetchHistory(selectedId, signal), [selectedId], {
    isEnabled: selectedId !== '',
    fallbackError: 'This history could not be loaded.',
  });

  const selectExecutive = (fieldExecutiveId: string): void => {
    const next = new URLSearchParams(searchParams);
    if (fieldExecutiveId) {
      next.set('executive', fieldExecutiveId);
    } else {
      next.delete('executive');
    }
    setSearchParams(next, { replace: true });
  };

  const executives = roster.data ?? [];
  // A search that hides the current selection still shows it, so the select never lies about what is open.
  const selectedMissing = selectedId !== '' && !executives.some((executive) => executive.id === selectedId);

  return (
    <>
      <PageHeader
        title="Field Executive History"
        subtitle="Case-wise activity for one field executive, including every mock-location detection."
      />

      <div className="grid grid-cols-1 gap-6">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          <div>
            <label htmlFor={searchId} className="label">
              Search
            </label>
            <input
              id={searchId}
              type="search"
              className="input"
              placeholder="Name, username or email"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
            />
          </div>
          <div>
            <label htmlFor={selectId} className="label">
              Field executive
            </label>
            <select id={selectId} className="select" value={selectedId} onChange={(event) => selectExecutive(event.target.value)}>
              <option value="">Select a field executive</option>
              {selectedMissing && history.data ? (
                <option value={selectedId}>
                  {history.data.fieldExecutive.name} ({history.data.fieldExecutive.username})
                </option>
              ) : null}
              {executives.map((executive) => (
                <option key={executive.id} value={executive.id}>
                  {executive.name} ({executive.username})
                  {executive.mockLocationEventCount > 0 ? ` — ${pluralize(executive.mockLocationEventCount, 'detection')}` : ''}
                </option>
              ))}
            </select>
            <p className="field-hint" aria-live="polite">
              {roster.status === 'loading' ? 'Searching…' : `${pluralize(executives.length, 'field executive')} listed`}
            </p>
          </div>
        </div>

        {roster.status === 'error' ? <Alert variant="error">{roster.error}</Alert> : null}

        {selectedId === '' ? (
          <p className="card px-4 py-10 text-center text-sm text-slate-500">
            Choose a field executive to see their case-wise history.
          </p>
        ) : history.status === 'error' ? (
          <Alert
            variant="error"
            action={
              <button type="button" className="btn-secondary" onClick={() => void history.reload()}>
                Retry
              </button>
            }
          >
            {history.error}
          </Alert>
        ) : history.data && history.data.fieldExecutive.id === selectedId ? (
          <HistoryView history={history.data} />
        ) : (
          <Spinner label="Loading history…" />
        )}
      </div>
    </>
  );
}

