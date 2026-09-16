import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { deviceChangeApi } from '../api/device-change-api';
import { toErrorMessage } from '../api/client';
import { Alert } from '../components/alert';
import { ConfirmDialog, type ConfirmRequest } from '../components/confirm-dialog';
import { DecisionCell, DeviceCell, NewDeviceCell } from '../components/device-change-tables';
import { FilterTabs } from '../components/filter-tabs';
import { PageHeader } from '../components/page-header';
import { Spinner } from '../components/spinner';
import type { AdminDeviceChangeRequest, DeviceChangeStatusFilter } from '../types/device-change';
import { describeDevice } from '../utils/device';
import { formatUtcTimestamp } from '../utils/format';
import { useApiResource } from '../utils/use-api-resource';
import { DECISION_NOTE_MAX_LENGTH } from '../utils/validation';

const STATUS_FILTERS: readonly DeviceChangeStatusFilter[] = ['pending', 'approved', 'rejected', 'all'];

const EMPTY_MESSAGES: Readonly<Record<DeviceChangeStatusFilter, string>> = {
  pending: 'No device change requests are waiting for a decision.',
  approved: 'No approved device change requests.',
  rejected: 'No rejected device change requests.',
  all: 'No device change requests yet.',
};

function isStatusFilter(value: string | null): value is DeviceChangeStatusFilter {
  return value !== null && (STATUS_FILTERS as readonly string[]).includes(value);
}

interface PendingDecision {
  readonly kind: 'approve' | 'reject';
  readonly item: AdminDeviceChangeRequest;
}

export function DeviceChangeRequestsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const statusParam = searchParams.get('status');
  const status: DeviceChangeStatusFilter = isStatusFilter(statusParam) ? statusParam : 'pending';

  const list = useApiResource((signal) => deviceChangeApi.listRequests(status, signal), [status], {
    fallbackError: 'Could not load device change requests.',
  });

  const [decision, setDecision] = useState<PendingDecision | null>(null);
  const [busyRequestId, setBusyRequestId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ readonly variant: 'success' | 'error'; readonly message: string } | null>(null);

  const selectStatus = (next: DeviceChangeStatusFilter): void => {
    setFeedback(null);
    setSearchParams(next === 'pending' ? {} : { status: next }, { replace: true });
  };

  const confirmRequest = (current: PendingDecision): ConfirmRequest => {
    const name = current.item.fieldExecutive.name;
    const phone = describeDevice(current.item.deviceAtRequest).title;
    return current.kind === 'approve'
      ? {
          title: `Approve the device change for ${name}?`,
          message: `Their account will be unlinked from ${phone}. They can then sign in to the FullScan app on any phone, including ${phone}, and that phone becomes linked.`,
          confirmLabel: 'Approve',
        }
      : {
          title: `Reject the device change for ${name}?`,
          message: 'Their current phone stays linked.',
          confirmLabel: 'Reject',
          tone: 'danger',
          note: { label: 'Note for the field executive (optional)', maxLength: DECISION_NOTE_MAX_LENGTH },
        };
  };

  const runDecision = async (current: PendingDecision, note: string): Promise<void> => {
    setDecision(null);
    setBusyRequestId(current.item.id);
    setFeedback(null);
    const name = current.item.fieldExecutive.name;

    try {
      if (current.kind === 'approve') {
        await deviceChangeApi.approve(current.item.id);
        setFeedback({ variant: 'success', message: `Approved. ${name} can now sign in to the FullScan app on any phone.` });
      } else {
        await deviceChangeApi.reject(current.item.id, note);
        setFeedback({ variant: 'success', message: `Rejected. ${name}'s current phone stays linked.` });
      }
    } catch (error) {
      setFeedback({ variant: 'error', message: toErrorMessage(error, 'The decision could not be saved.') });
    } finally {
      setBusyRequestId(null);
      // Reload either way: after a failure another admin may already have decided it.
      await list.reload();
    }
  };

  const counts = list.data?.counts;

  return (
    <>
      <PageHeader
        title="Device Change Requests"
        subtitle="Field executives asking to use the FullScan app on another phone — approve or reject."
      />

      <div className="grid grid-cols-1 gap-4">
        <FilterTabs<DeviceChangeStatusFilter>
          label="Request status"
          selected={status}
          onSelect={selectStatus}
          tabs={[
            { value: 'pending', label: 'Pending', count: counts?.pending },
            { value: 'approved', label: 'Approved', count: counts?.approved },
            { value: 'rejected', label: 'Rejected', count: counts?.rejected },
            { value: 'all', label: 'All', count: counts?.all },
          ]}
        />

        {feedback ? <Alert variant={feedback.variant}>{feedback.message}</Alert> : null}
        {list.status === 'error' ? (
          <Alert
            variant="error"
            action={
              <button type="button" className="btn-secondary" onClick={() => void list.reload()}>
                Retry
              </button>
            }
          >
            {list.error}
          </Alert>
        ) : null}

        {!list.data && list.status === 'loading' ? <Spinner label="Loading requests…" /> : null}

        {list.data ? (
          list.data.items.length === 0 ? (
            <p className="card px-4 py-10 text-center text-sm text-slate-500">{EMPTY_MESSAGES[status]}</p>
          ) : (
            <div className="table-frame" aria-busy={list.status === 'loading'}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th scope="col">Field executive</th>
                    <th scope="col">Phone at request</th>
                    <th scope="col">Reason</th>
                    <th scope="col">Requested</th>
                    <th scope="col">Status</th>
                    <th scope="col">New phone</th>
                    <th scope="col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {list.data.items.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <span className="cell-strong">{item.fieldExecutive.name}</span>
                        <span className="cell-muted">{item.fieldExecutive.username}</span>
                      </td>
                      <td>
                        <DeviceCell device={item.deviceAtRequest} />
                      </td>
                      <td className="max-w-xs break-words">{item.reason || <span className="cell-muted">—</span>}</td>
                      <td className="whitespace-nowrap">
                        <span className="cell-muted">{formatUtcTimestamp(item.requestedAt)}</span>
                      </td>
                      <td>
                        <DecisionCell request={item} showDecidedBy />
                      </td>
                      <td>
                        <NewDeviceCell request={item} />
                      </td>
                      <td>
                        {item.status === 'pending' ? (
                          <div className="flex gap-2">
                            <button
                              type="button"
                              className="btn-primary btn-sm"
                              disabled={busyRequestId !== null}
                              onClick={() => setDecision({ kind: 'approve', item })}
                            >
                              Approve<span className="sr-only"> {item.fieldExecutive.name}</span>
                            </button>
                            <button
                              type="button"
                              className="btn-danger-ghost btn-sm"
                              disabled={busyRequestId !== null}
                              onClick={() => setDecision({ kind: 'reject', item })}
                            >
                              Reject<span className="sr-only"> {item.fieldExecutive.name}</span>
                            </button>
                          </div>
                        ) : (
                          <span className="cell-muted">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : null}
      </div>

      <ConfirmDialog
        request={decision ? confirmRequest(decision) : null}
        onConfirm={(note) => {
          if (decision) {
            void runDecision(decision, note);
          }
        }}
        onCancel={() => setDecision(null)}
      />
    </>
  );
}
