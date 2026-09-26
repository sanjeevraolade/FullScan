import type { MockLocationHistoryEvent } from '../types/field-executives';
import { describeDetectionDevice, formatCoordinates } from '../utils/device';
import { formatUtcTimestamp } from '../utils/format';
import { DETECTION_STAGE_LABELS } from '../utils/labels';
import { Badge } from './badges';

function Detail({ label, value }: { readonly label: string; readonly value: string | null }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className="text-sm break-words">{value || '—'}</dd>
    </div>
  );
}

/** One mock-location detection. Every device value is whatever the handset reported. */
export function MockLocationEvent({ event }: { readonly event: MockLocationHistoryEvent }) {
  const { device } = event;

  return (
    <li className="rounded-lg border border-red-200 bg-red-50/50 p-4 dark:border-red-900/60 dark:bg-red-950/20">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="danger">Mock location</Badge>
        <span className="text-sm font-medium">{formatUtcTimestamp(event.detectedAt)}</span>
        <span className="text-sm text-slate-500 dark:text-slate-400">
          {DETECTION_STAGE_LABELS[event.detectionStage] ?? event.detectionStage}
        </span>
      </div>
      <dl className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
        <Detail label="Mock enabled at (device clock)" value={formatUtcTimestamp(event.detectedAt)} />
        <Detail label="Reported to server at" value={formatUtcTimestamp(event.reportedAt)} />
        <Detail label="Claimed coordinates" value={formatCoordinates(event)} />
        <Detail label="Fix source" value={event.fixSource === 'lastKnown' ? 'Last known' : event.fixSource} />
        <Detail label="Fix captured at" value={event.fixCapturedAt ? formatUtcTimestamp(event.fixCapturedAt) : null} />
        <Detail label="Handset" value={describeDetectionDevice(device)} />
        <Detail label="Device id" value={device.deviceId} />
        <Detail label="Device name" value={device.deviceName} />
        <Detail
          label="App version"
          value={[device.appVersion, device.appBuildNumber ? `(${device.appBuildNumber})` : null].filter(Boolean).join(' ')}
        />
        <Detail label="Installed from" value={device.installerPackageName} />
        <Detail label="Emulator" value={device.isEmulator ? 'Yes' : 'No'} />
        <Detail label="Device time zone" value={device.timeZone} />
      </dl>
    </li>
  );
}
