import { useEffect, useId, useMemo, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import {
  EMPTY_COMPONENT_EVIDENCE,
  IDLE_UPLOAD,
  useEvidenceStore,
} from '../stores/evidence-store';
import { EVIDENCE_MIME_TYPES, MAX_EVIDENCE_FILE_BYTES, MAX_EVIDENCE_FILES } from '../types/evidence';
import { formatBytes, formatUtcTimestamp } from '../utils/format';
import { validateEvidenceSelection } from '../utils/validation';
import { Alert } from './alert';
import { Spinner } from './spinner';
import { StatusLabel } from './status-badge';

interface EvidenceUploadProps {
  /** The assignment (case component) every upload from this panel is stored against. */
  readonly componentId: string;
  readonly canUpload: boolean;
}

interface SelectedFile {
  readonly key: string;
  readonly file: File;
}

function toFileKey(file: File): string {
  return `${file.name}:${file.size}:${file.lastModified}`;
}

export function EvidenceUpload({ componentId, canUpload }: EvidenceUploadProps) {
  const inputId = useId();
  const hintId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [selected, setSelected] = useState<readonly SelectedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  const evidence = useEvidenceStore((state) => state.byComponent[componentId] ?? EMPTY_COMPONENT_EVIDENCE);
  const upload = useEvidenceStore((state) => state.uploads[componentId] ?? IDLE_UPLOAD);
  const fetchEvidence = useEvidenceStore((state) => state.fetchEvidence);
  const uploadEvidence = useEvidenceStore((state) => state.uploadEvidence);
  const cancelUpload = useEvidenceStore((state) => state.cancelUpload);
  const dismissUpload = useEvidenceStore((state) => state.dismissUpload);

  const isUploading = upload.status === 'uploading';

  useEffect(() => {
    void fetchEvidence(componentId);
    setSelected([]);
  }, [componentId, fetchEvidence]);

  const selectionErrors = useMemo(
    () => (selected.length > 0 ? validateEvidenceSelection(selected.map((entry) => entry.file)) : []),
    [selected],
  );
  const totalSelectedBytes = selected.reduce((sum, entry) => sum + entry.file.size, 0);
  const canSubmit = canUpload && !isUploading && selected.length > 0 && selectionErrors.length === 0;

  const addFiles = (files: FileList | null): void => {
    if (!files || files.length === 0) {
      return;
    }
    // Copy now: a FileList is live, and clearing the input afterwards empties it
    // before the state updater below runs.
    const incoming = Array.from(files);
    dismissUpload(componentId);
    setSelected((current) => {
      const known = new Set(current.map((entry) => entry.key));
      const additions: SelectedFile[] = [];
      for (const file of incoming) {
        const key = toFileKey(file);
        if (!known.has(key)) {
          known.add(key);
          additions.push({ key, file });
        }
      }
      return [...current, ...additions];
    });
  };

  const onInputChange = (event: ChangeEvent<HTMLInputElement>): void => {
    addFiles(event.target.files);
    // Reset so choosing the same file again after removing it still fires `change`.
    event.target.value = '';
  };

  const onDrop = (event: DragEvent<HTMLLabelElement>): void => {
    event.preventDefault();
    setIsDragging(false);
    if (canUpload && !isUploading) {
      addFiles(event.dataTransfer.files);
    }
  };

  const removeFile = (key: string): void => {
    setSelected((current) => current.filter((entry) => entry.key !== key));
  };

  const submit = async (): Promise<void> => {
    if (!canSubmit) {
      return;
    }
    const isStored = await uploadEvidence(
      componentId,
      selected.map((entry) => entry.file),
    );
    if (isStored) {
      setSelected([]);
      inputRef.current?.focus();
    }
  };

  return (
    <section aria-labelledby={`${inputId}-heading`} className="card p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id={`${inputId}-heading`} className="text-base font-semibold">
          Evidence
        </h2>
        <span className="text-xs text-slate-500 dark:text-slate-400">Assignment {componentId}</span>
      </div>

      {canUpload ? (
        <div className="mt-4 grid gap-4">
          <Alert variant="info">
            Files uploaded here are recorded as <strong>web uploads</strong>, separate from camera captures made in the
            FullScan mobile app. They carry no GPS location or watermark.
          </Alert>

          <label
            htmlFor={inputId}
            onDragOver={(event) => {
              event.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={onDrop}
            className={`flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors ${
              isDragging
                ? 'border-brand-500 bg-brand-50 dark:bg-brand-700/20'
                : 'border-slate-300 hover:border-brand-500 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800/50'
            } ${isUploading ? 'pointer-events-none opacity-60' : ''}`}
          >
            <span className="text-sm font-semibold text-brand-600 dark:text-brand-100">Choose images</span>
            <span className="text-sm text-slate-600 dark:text-slate-300">or drag and drop them here</span>
            <span id={hintId} className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              JPEG, PNG or WebP · up to {MAX_EVIDENCE_FILES} images · {formatBytes(MAX_EVIDENCE_FILE_BYTES)} each
            </span>
          </label>
          <input
            ref={inputRef}
            id={inputId}
            type="file"
            multiple
            accept={EVIDENCE_MIME_TYPES.join(',')}
            aria-describedby={hintId}
            className="sr-only"
            onChange={onInputChange}
            disabled={isUploading}
          />

          {selected.length > 0 ? (
            <div>
              <p className="text-sm font-medium">
                {selected.length} selected · {formatBytes(totalSelectedBytes)}
              </p>
              <ul className="mt-2 divide-y divide-slate-200 rounded-lg border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
                {selected.map((entry) => (
                  <li key={entry.key} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                    <span className="min-w-0 truncate">{entry.file.name}</span>
                    <span className="flex shrink-0 items-center gap-2">
                      <span className="text-slate-500">{formatBytes(entry.file.size)}</span>
                      <button
                        type="button"
                        className="btn-ghost min-h-9 px-2"
                        onClick={() => removeFile(entry.key)}
                        disabled={isUploading}
                        aria-label={`Remove ${entry.file.name}`}
                      >
                        Remove
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {selectionErrors.length > 0 ? (
            <Alert variant="error" title="Fix these before uploading">
              <ul className="list-disc pl-5">
                {selectionErrors.map((message) => (
                  <li key={message}>{message}</li>
                ))}
              </ul>
            </Alert>
          ) : null}

          {isUploading && upload.progress ? (
            <div className="grid gap-1.5">
              <progress
                className="progress"
                max={100}
                value={upload.progress.percent}
                aria-label="Upload progress"
              />
              <p className="text-sm text-slate-600 dark:text-slate-300" aria-live="polite">
                Uploading… {upload.progress.percent}% · {formatBytes(upload.progress.loadedBytes)} of{' '}
                {formatBytes(upload.progress.totalBytes)}
              </p>
            </div>
          ) : null}

          {upload.status === 'success' ? (
            <Alert variant="success">
              {upload.uploadedCount === 1 ? '1 image uploaded.' : `${upload.uploadedCount} images uploaded.`}
            </Alert>
          ) : null}
          {upload.status === 'error' && upload.error ? <Alert variant="error">{upload.error}</Alert> : null}

          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-primary" disabled={!canSubmit} onClick={() => void submit()}>
              {isUploading
                ? 'Uploading…'
                : selected.length > 0
                  ? `Upload ${selected.length} ${selected.length === 1 ? 'image' : 'images'}`
                  : 'Upload'}
            </button>
            {isUploading ? (
              <button type="button" className="btn-secondary" onClick={() => cancelUpload(componentId)}>
                Cancel
              </button>
            ) : selected.length > 0 ? (
              <button type="button" className="btn-secondary" onClick={() => setSelected([])}>
                Clear
              </button>
            ) : null}
          </div>
        </div>
      ) : (
        <Alert variant="info" className="mt-4">
          This assignment is completed, so no more evidence can be added.
        </Alert>
      )}

      <div className="mt-6">
        <h3 className="text-sm font-semibold">Uploaded</h3>
        {evidence.status === 'loading' && evidence.items.length === 0 ? (
          <Spinner className="mt-3" label="Loading uploaded evidence…" />
        ) : evidence.status === 'error' ? (
          <Alert
            variant="error"
            className="mt-3"
            action={
              <button type="button" className="btn-secondary" onClick={() => void fetchEvidence(componentId)}>
                Retry
              </button>
            }
          >
            {evidence.error}
          </Alert>
        ) : evidence.items.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Nothing uploaded yet.</p>
        ) : (
          <ul className="mt-2 divide-y divide-slate-200 dark:divide-slate-800">
            {evidence.items.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2.5 text-sm">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="min-w-0 truncate font-medium">{item.fileName}</span>
                  {item.source === 'mobile_capture' ? <StatusLabel label="App capture" /> : null}
                </span>
                <span className="text-slate-500 dark:text-slate-400">
                  {item.documentTypeCode ? `${item.documentTypeCode} · ` : null}
                  {formatBytes(item.sizeBytes)} ·{' '}
                  <time dateTime={item.uploadedAt}>{formatUtcTimestamp(item.uploadedAt)}</time>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
