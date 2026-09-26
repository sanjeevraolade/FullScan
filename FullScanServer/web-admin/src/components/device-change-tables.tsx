import type { AdminDeviceChangeRequest, DeviceHistoryEntry, DeviceView } from '../types/device-change';
import { describeDevice } from '../utils/device';
import { formatUtcTimestamp } from '../utils/format';
import { RELEASE_REASON_LABELS } from '../utils/labels';
import { Badge, RequestStatusBadge } from './badges';

export function DeviceCell({ device }: { readonly device: DeviceView }) {
  const { title, details } = describeDevice(device);
  return (
    <>
      <span className="cell-strong">{title}</span>
      {details ? <span className="cell-muted">{details}</span> : null}
      <span className="cell-muted">ID {device.deviceId}</span>
    </>
  );
}

export function DecisionCell({
  request,
  showDecidedBy = false,
}: {
  readonly request: AdminDeviceChangeRequest;
  readonly showDecidedBy?: boolean;
}) {
  return (
    <>
      <RequestStatusBadge status={request.status} />
      {request.status === 'pending' ? (
        <span className="cell-muted mt-1">Waiting for admin</span>
      ) : (
        <>
          <span className="cell-muted mt-1">
            {request.status === 'approved' ? 'Approved' : 'Rejected'} {formatUtcTimestamp(request.decidedAt)}
            {showDecidedBy && request.decidedBy ? ` by ${request.decidedBy.name}` : ''}
          </span>
          {request.decisionNote ? <span className="cell-muted">Note: {request.decisionNote}</span> : null}
        </>
      )}
    </>
  );
}

export function NewDeviceCell({ request }: { readonly request: AdminDeviceChangeRequest }) {
  if (request.newDevice) {
    return (
      <>
        <DeviceCell device={request.newDevice} />
        <span className="cell-muted">First sign-in {formatUtcTimestamp(request.newDevice.boundAt)}</span>
      </>
    );
  }
  return (
    <span className="cell-muted">{request.status === 'approved' ? 'Not signed in on a phone yet' : '—'}</span>
  );
}

/** Requests, newest first: when, the phone given up, reason, outcome, the phone that followed. */
export function RequestHistoryTable({ requests }: { readonly requests: readonly AdminDeviceChangeRequest[] }) {
  return (
    <div className="table-frame">
      <table className="data-table">
        <thead>
          <tr>
            <th scope="col">Requested</th>
            <th scope="col">Phone at request</th>
            <th scope="col">Reason</th>
            <th scope="col">Status</th>
            <th scope="col">New phone</th>
          </tr>
        </thead>
        <tbody>
          {requests.map((request) => (
            <tr key={request.id}>
              <td className="whitespace-nowrap">
                <span className="cell-muted">{formatUtcTimestamp(request.requestedAt)}</span>
              </td>
              <td>
                <DeviceCell device={request.deviceAtRequest} />
              </td>
              <td className="max-w-xs break-words">{request.reason || <span className="cell-muted">—</span>}</td>
              <td>
                <DecisionCell request={request} showDecidedBy />
              </td>
              <td>
                <NewDeviceCell request={request} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Every phone ever linked to the account, newest first. */
export function DeviceHistoryTable({ entries }: { readonly entries: readonly DeviceHistoryEntry[] }) {
  return (
    <div className="table-frame">
      <table className="data-table">
        <thead>
          <tr>
            <th scope="col">Phone</th>
            <th scope="col">Linked (first app sign-in)</th>
            <th scope="col">Last app sign-in</th>
            <th scope="col">Status</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={entry.id}>
              <td>
                <DeviceCell device={entry.device} />
              </td>
              <td>
                <span className="cell-muted">
                  {entry.boundAt ? formatUtcTimestamp(entry.boundAt) : 'Before device history was kept'}
                </span>
              </td>
              <td>
                <span className="cell-muted">{formatUtcTimestamp(entry.lastLoginAt)}</span>
              </td>
              <td>
                {entry.isCurrent ? (
                  <Badge tone="success">Current</Badge>
                ) : (
                  <span className="cell-muted">
                    Unlinked {formatUtcTimestamp(entry.releasedAt)}{' '}
                    {entry.releaseReason ? RELEASE_REASON_LABELS[entry.releaseReason] : ''}
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
