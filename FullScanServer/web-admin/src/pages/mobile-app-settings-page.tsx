import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { settingsApi } from '../api/settings-api';
import { toErrorMessage } from '../api/client';
import { Alert } from '../components/alert';
import { PageHeader } from '../components/page-header';
import { Spinner } from '../components/spinner';
import type { MobileAppSetting } from '../types/settings';
import { formatUtcTimestamp } from '../utils/format';
import { pluralize } from '../utils/labels';
import {
  collectSettingChanges,
  groupSettingsByCategory,
  toInputValues,
  toSettingUpdates,
  type SettingInputValue,
} from '../utils/settings-form';
import { useApiResource } from '../utils/use-api-resource';

const CATEGORY_META: Readonly<Record<string, { readonly title: string; readonly subtitle: string }>> = {
  general: { title: 'General', subtitle: 'Versioning, language and app-wide availability.' },
  security: { title: 'Security', subtitle: 'Sign-in, session and location-integrity controls.' },
  evidence: { title: 'Evidence Capture', subtitle: 'Geo-fencing and photo rules applied to captured evidence.' },
  sync: { title: 'Synchronization', subtitle: 'How the offline queue drains to the server.' },
};

function SettingControl({
  setting,
  value,
  onChange,
}: {
  readonly setting: MobileAppSetting;
  readonly value: SettingInputValue;
  readonly onChange: (value: SettingInputValue) => void;
}) {
  const id = `setting-${setting.key}`;
  const describedBy = `${id}-description`;

  if (setting.valueType === 'boolean') {
    const isOn = value === true;
    return (
      <label htmlFor={id} className="inline-flex min-h-11 cursor-pointer items-center gap-3">
        <input
          id={id}
          type="checkbox"
          role="switch"
          className="peer sr-only"
          checked={isOn}
          aria-describedby={describedBy}
          onChange={(event) => onChange(event.target.checked)}
        />
        <span
          aria-hidden="true"
          className="relative h-6 w-11 rounded-full bg-slate-300 transition-colors peer-checked:bg-brand-500 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand-500 after:absolute after:top-0.5 after:left-0.5 after:size-5 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:after:translate-x-5 dark:bg-slate-700"
        />
        <span className="text-sm">{isOn ? 'Enabled' : 'Disabled'}</span>
      </label>
    );
  }

  const text = typeof value === 'string' ? value : String(value);

  if (setting.valueType === 'enum') {
    return (
      <select id={id} className="select" value={text} aria-describedby={describedBy} onChange={(event) => onChange(event.target.value)}>
        {(setting.options ?? []).map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    );
  }

  return (
    <input
      id={id}
      type={setting.valueType === 'number' ? 'number' : 'text'}
      inputMode={setting.valueType === 'number' ? 'numeric' : undefined}
      min={setting.minValue ?? undefined}
      max={setting.maxValue ?? undefined}
      maxLength={setting.valueType === 'string' ? 500 : undefined}
      className="input"
      value={text}
      aria-describedby={describedBy}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

/**
 * Fully data-driven, like the static page: each setting's `valueType`, `options`
 * and `min`/`max` decide its control, so a seeded setting appears with no code
 * change. Only changed settings are sent; the response becomes the new baseline.
 */
export function MobileAppSettingsPage() {
  const resource = useApiResource((signal) => settingsApi.fetchSettings(signal), [], {
    fallbackError: 'Could not load mobile app settings.',
  });
  const settings = resource.data;

  const [inputs, setInputs] = useState<Record<string, SettingInputValue>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ readonly variant: 'success' | 'error'; readonly message: string } | null>(null);

  useEffect(() => {
    if (settings) {
      setInputs(toInputValues(settings));
    }
  }, [settings]);

  const changes = useMemo(() => (settings ? collectSettingChanges(settings, inputs) : []), [settings, inputs]);
  const problems = changes.filter((change) => change.problem !== null);
  const isDirty = changes.length > 0;

  const save = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    const [firstProblem] = problems;
    if (firstProblem) {
      setFeedback({ variant: 'error', message: firstProblem.problem ?? 'Fix the highlighted setting.' });
      document.getElementById(`setting-${firstProblem.setting.key}`)?.focus();
      return;
    }
    if (!isDirty || isSaving) {
      return;
    }

    setIsSaving(true);
    setFeedback(null);
    try {
      const updated = await settingsApi.updateSettings(toSettingUpdates(changes));
      resource.setData(updated);
      setFeedback({
        variant: 'success',
        message: `Saved. ${pluralize(changes.length, 'setting')} updated — mobile clients pick this up on their next sync.`,
      });
    } catch (error) {
      setFeedback({ variant: 'error', message: toErrorMessage(error, 'Settings could not be saved.') });
    } finally {
      setIsSaving(false);
    }
  };

  const header = (
    <PageHeader title="Mobile App Settings" subtitle="Remote configuration the FullScan mobile app applies for every field executive." />
  );

  if (resource.status === 'error') {
    return (
      <>
        {header}
        <Alert
          variant="error"
          action={
            <button type="button" className="btn-secondary" onClick={() => void resource.reload()}>
              Retry
            </button>
          }
        >
          {resource.error}
        </Alert>
      </>
    );
  }

  if (!settings) {
    return (
      <>
        {header}
        <Spinner label="Loading settings…" />
      </>
    );
  }

  if (settings.length === 0) {
    return (
      <>
        {header}
        <p className="card px-4 py-10 text-center text-sm text-slate-500">No mobile app settings are configured yet.</p>
      </>
    );
  }

  const problemKeys = new Set(problems.map((change) => change.setting.key));

  return (
    <>
      {header}
      <form className="grid grid-cols-1 gap-5 pb-24" onSubmit={(event) => void save(event)} noValidate>
        {feedback ? <Alert variant={feedback.variant}>{feedback.message}</Alert> : null}

        {groupSettingsByCategory(settings).map((group) => {
          const meta = CATEGORY_META[group.category] ?? { title: group.category.replace(/[-_]/g, ' '), subtitle: '' };
          const headingId = `settings-${group.category}`;
          return (
            <section key={group.category} aria-labelledby={headingId} className="card">
              <header className="border-b border-slate-200 px-5 py-4 dark:border-slate-800">
                <h2 id={headingId} className="text-base font-semibold capitalize">
                  {meta.title}
                </h2>
                {meta.subtitle ? <p className="text-sm text-slate-500 dark:text-slate-400">{meta.subtitle}</p> : null}
              </header>
              <div className="divide-y divide-slate-200 dark:divide-slate-800">
                {group.settings.map((setting) => {
                  const id = `setting-${setting.key}`;
                  const hasProblem = problemKeys.has(setting.key);
                  return (
                    <div key={setting.key} className="grid grid-cols-1 gap-3 px-5 py-4 md:grid-cols-[minmax(0,1fr)_minmax(0,18rem)] md:items-center">
                      <div id={`${id}-description`} className="min-w-0">
                        <label htmlFor={id} className="text-sm font-medium">
                          {setting.label}
                        </label>
                        {setting.description ? <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{setting.description}</p> : null}
                        {setting.valueType === 'number' && (setting.minValue !== null || setting.maxValue !== null) ? (
                          <p className="field-hint">
                            Allowed range: {setting.minValue ?? '—'} to {setting.maxValue ?? '—'}
                          </p>
                        ) : null}
                        {setting.updatedAt ? <p className="field-hint">Last changed {formatUtcTimestamp(setting.updatedAt)}</p> : null}
                        {hasProblem ? (
                          <p className="field-error">{problems.find((change) => change.setting.key === setting.key)?.problem}</p>
                        ) : null}
                      </div>
                      <div>
                        <SettingControl
                          setting={setting}
                          value={inputs[setting.key] ?? (setting.valueType === 'boolean' ? false : '')}
                          onChange={(value) => {
                            setInputs((current) => ({ ...current, [setting.key]: value }));
                            setFeedback(null);
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}

        <div className="fixed inset-x-0 bottom-0 z-10 border-t border-slate-200 bg-white/95 backdrop-blur lg:left-68 dark:border-slate-800 dark:bg-slate-950/95">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-end gap-3 px-4 py-3 sm:px-6">
            <span className={`mr-auto text-sm ${isDirty ? 'font-medium text-amber-700 dark:text-amber-300' : 'text-slate-500'}`} aria-live="polite">
              {isDirty ? `${pluralize(changes.length, 'unsaved change')}` : 'No unsaved changes'}
            </span>
            <button
              type="button"
              className="btn-secondary"
              disabled={!isDirty || isSaving}
              onClick={() => {
                setInputs(toInputValues(settings));
                setFeedback(null);
              }}
            >
              Discard changes
            </button>
            <button type="submit" className="btn-primary" disabled={!isDirty || isSaving}>
              {isSaving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </div>
      </form>
    </>
  );
}
