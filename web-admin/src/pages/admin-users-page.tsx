import { useId, useRef, useState, type FormEvent } from 'react';
import { adminUsersApi } from '../api/admin-users-api';
import { ApiError, toErrorMessage } from '../api/client';
import { Alert } from '../components/alert';
import { ActiveBadge, RoleBadge } from '../components/badges';
import { ConfirmDialog, type ConfirmRequest } from '../components/confirm-dialog';
import { SelectField, TextField } from '../components/form-fields';
import { PageHeader } from '../components/page-header';
import { Spinner } from '../components/spinner';
import { useAuthStore } from '../stores/auth-store';
import type { AdminRole } from '../types/auth';
import type { AdminUserSummary, CreateAdminUserResult, UpdateAdminUserInput } from '../types/admin-users';
import { formatUtcTimestamp } from '../utils/format';
import { ROLE_ACCESS, ROLE_LABELS } from '../utils/labels';
import { useApiResource } from '../utils/use-api-resource';
import { validateNewAdminForm, type FieldErrors, type NewAdminFormValues } from '../utils/validation';

const EMPTY_FORM: NewAdminFormValues = { name: '', email: '', role: 'admin' };

type AdminAction =
  | { readonly kind: 'role'; readonly role: AdminRole }
  | { readonly kind: 'status'; readonly isActive: boolean }
  | { readonly kind: 'delete' };

interface PlannedAction {
  readonly adminUser: AdminUserSummary;
  readonly action: AdminAction;
}

interface ActionPlan {
  /** Null runs without asking — reactivation only restores access someone already had. */
  readonly confirm: ConfirmRequest | null;
  readonly run: () => Promise<unknown>;
  readonly success: string;
}

function planAction({ adminUser, action }: PlannedAction): ActionPlan {
  const { name } = adminUser;
  const update = (changes: UpdateAdminUserInput) => () => adminUsersApi.updateAdminUser(adminUser.id, changes);

  if (action.kind === 'role') {
    return action.role === 'super_admin'
      ? {
          confirm: {
            title: `Make ${name} a super admin?`,
            message: 'They will be able to change Mobile App Settings and add, promote, deactivate or delete admins — including you.',
            confirmLabel: 'Make super admin',
          },
          run: update({ role: 'super_admin' }),
          success: `${name} is now a super admin.`,
        }
      : {
          confirm: {
            title: `Make ${name} an admin?`,
            message: 'They lose access to Mobile App Settings and Add New Admin on their next action.',
            confirmLabel: 'Make admin',
          },
          run: update({ role: 'admin' }),
          success: `${name} is now an admin.`,
        };
  }

  if (action.kind === 'status') {
    return action.isActive
      ? { confirm: null, run: update({ isActive: true }), success: `${name} was reactivated and can sign in again.` }
      : {
          confirm: {
            title: `Deactivate ${name}?`,
            message: 'They are signed out on their next action and cannot sign in until reactivated. Their history is kept.',
            confirmLabel: 'Deactivate',
            tone: 'danger',
          },
          run: update({ isActive: false }),
          success: `${name} was deactivated.`,
        };
  }

  return {
    confirm: {
      title: `Permanently delete ${name}?`,
      message: `${adminUser.email}\n\nThis cannot be undone. To remove their access but keep their history, deactivate the account instead.`,
      confirmLabel: 'Delete',
      tone: 'danger',
    },
    run: () => adminUsersApi.deleteAdminUser(adminUser.id),
    success: `${name} was deleted.`,
  };
}

function CredentialsCard({ created, onDone }: { readonly created: CreateAdminUserResult; readonly onDone: () => void }) {
  const secretRef = useRef<HTMLElement>(null);
  const [copyStatus, setCopyStatus] = useState('');
  const { adminUser, temporaryPassword } = created;

  const copy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(temporaryPassword);
      setCopyStatus('Password copied.');
    } catch {
      // Clipboard access can be refused — select the text instead.
      const selection = window.getSelection();
      if (secretRef.current && selection) {
        const range = document.createRange();
        range.selectNodeContents(secretRef.current);
        selection.removeAllRanges();
        selection.addRange(range);
      }
      setCopyStatus('Copy blocked by the browser — the password is selected, press Ctrl/Cmd+C.');
    }
  };

  const details: readonly [string, React.ReactNode][] = [
    ['Portal address', `${window.location.origin}/admin-app/login`],
    ['Sign-in email', adminUser.email],
    ['Role', ROLE_LABELS[adminUser.role]],
    [
      'Temporary password',
      <code ref={secretRef} className="rounded bg-slate-100 px-2 py-1 font-mono text-base select-all dark:bg-slate-800">
        {temporaryPassword}
      </code>,
    ],
  ];

  return (
    <section aria-labelledby="credentials-title" className="card border-emerald-300 dark:border-emerald-800">
      <header className="border-b border-slate-200 px-5 py-4 dark:border-slate-800">
        <h2 id="credentials-title" className="text-base font-semibold">
          Sign-in details for {adminUser.name}
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Share these securely. <strong>The temporary password is shown only this once</strong> — it is stored encrypted and
          cannot be displayed again.
        </p>
      </header>
      <dl className="grid grid-cols-1 gap-3 px-5 py-4 sm:grid-cols-2">
        {details.map(([label, value]) => (
          <div key={label} className="min-w-0">
            <dt className="text-xs text-slate-500 dark:text-slate-400">{label}</dt>
            <dd className="mt-1 text-sm break-all">{value}</dd>
          </div>
        ))}
      </dl>
      <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 px-5 py-3 dark:border-slate-800">
        <span className="mr-auto text-sm text-slate-500" aria-live="polite">
          {copyStatus}
        </span>
        <button type="button" className="btn-secondary" onClick={() => void copy()} autoFocus>
          Copy password
        </button>
        <button type="button" className="btn-primary" onClick={onDone}>
          Done
        </button>
      </footer>
    </section>
  );
}

export function AdminUsersPage() {
  const formId = useId();
  const currentAdminId = useAuthStore((state) => state.adminUser?.id);
  const list = useApiResource((signal) => adminUsersApi.listAdminUsers(signal), [], {
    fallbackError: 'Could not load admin accounts.',
  });

  const [values, setValues] = useState<NewAdminFormValues>(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors<keyof NewAdminFormValues>>({});
  const [isCreating, setIsCreating] = useState(false);
  const [created, setCreated] = useState<CreateAdminUserResult | null>(null);
  const [feedback, setFeedback] = useState<{ readonly variant: 'success' | 'error'; readonly message: string } | null>(null);
  const [planned, setPlanned] = useState<PlannedAction | null>(null);
  const [busyAdminId, setBusyAdminId] = useState<string | null>(null);

  const updateValue = <TField extends keyof NewAdminFormValues>(field: TField) => (value: NewAdminFormValues[TField]) => {
    setValues((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
  };

  const createAdmin = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (isCreating) {
      return;
    }
    setFeedback(null);
    const validation = validateNewAdminForm(values);
    if (!validation.isValid) {
      setFieldErrors(validation.errors);
      document.getElementById(`${formId}-${validation.errors.name ? 'name' : 'email'}`)?.focus();
      return;
    }

    setIsCreating(true);
    try {
      const result = await adminUsersApi.createAdminUser(validation.value);
      setCreated(result);
      setValues(EMPTY_FORM);
      setFeedback({ variant: 'success', message: `${result.adminUser.name} was added as ${ROLE_LABELS[result.adminUser.role].toLowerCase()}.` });
      await list.reload();
    } catch (error) {
      // The form stays as typed so a duplicate email can simply be corrected.
      if (error instanceof ApiError && error.status === 409) {
        setFieldErrors({ email: error.message });
        document.getElementById(`${formId}-email`)?.focus();
      }
      setFeedback({ variant: 'error', message: toErrorMessage(error, 'The admin could not be added.') });
    } finally {
      setIsCreating(false);
    }
  };

  const runAction = async (action: PlannedAction): Promise<void> => {
    const plan = planAction(action);
    setPlanned(null);
    setBusyAdminId(action.adminUser.id);
    setFeedback(null);
    try {
      await plan.run();
      if (action.action.kind === 'delete' && created?.adminUser.id === action.adminUser.id) {
        setCreated(null);
      }
      setFeedback({ variant: 'success', message: plan.success });
    } catch (error) {
      setFeedback({ variant: 'error', message: toErrorMessage(error, 'That change could not be made.') });
    } finally {
      setBusyAdminId(null);
      // Reload either way: after a failure the list may still have moved on.
      await list.reload();
    }
  };

  const request = (action: PlannedAction): void => {
    const plan = planAction(action);
    if (plan.confirm) {
      setPlanned(action);
    } else {
      void runAction(action);
    }
  };

  const adminUsers = list.data ?? [];

  return (
    <>
      <PageHeader title="Add New Admin" subtitle="Add admins by email, promote or demote them, and deactivate or delete accounts." />

      <div className="grid grid-cols-1 gap-6">
        {feedback ? <Alert variant={feedback.variant}>{feedback.message}</Alert> : null}
        {created ? <CredentialsCard created={created} onDone={() => setCreated(null)} /> : null}

        <form className="card" onSubmit={(event) => void createAdmin(event)} noValidate>
          <header className="border-b border-slate-200 px-5 py-4 dark:border-slate-800">
            <h2 className="text-base font-semibold">New admin</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Their email address becomes their sign-in. A temporary password is generated for you to share with them.
            </p>
          </header>
          <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
            <TextField inputId={`${formId}-name`} label="Full name" isRequired maxLength={100} value={values.name} onChange={updateValue('name')} error={fieldErrors.name} />
            <TextField inputId={`${formId}-email`} label="Email address" type="email" isRequired maxLength={254} value={values.email} onChange={updateValue('email')} error={fieldErrors.email} />
            <SelectField
              inputId={`${formId}-role`}
              label="Role"
              value={values.role}
              options={(['admin', 'super_admin'] as const).map((role) => ({ value: role, label: ROLE_LABELS[role] }))}
              onChange={(value) => updateValue('role')(value === 'super_admin' ? 'super_admin' : 'admin')}
              hint={ROLE_ACCESS[values.role]}
            />
          </div>
          <footer className="flex justify-end border-t border-slate-200 px-5 py-3 dark:border-slate-800">
            <button type="submit" className="btn-primary" disabled={isCreating}>
              {isCreating ? 'Adding…' : 'Add admin'}
            </button>
          </footer>
        </form>

        <section aria-labelledby="admin-list-title" className="grid grid-cols-1 gap-3">
          <div>
            <h2 id="admin-list-title" className="text-lg font-semibold">
              Admin accounts
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {adminUsers.length} {adminUsers.length === 1 ? 'account' : 'accounts'}. Role and status changes apply on the admin’s next
              action — no sign-out needed.
            </p>
          </div>

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
          {!list.data && list.status === 'loading' ? <Spinner label="Loading admin accounts…" /> : null}

          {list.data ? (
            <div className="table-frame" aria-busy={list.status === 'loading'}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th scope="col">Name</th>
                    <th scope="col">Email</th>
                    <th scope="col">Role</th>
                    <th scope="col">Status</th>
                    <th scope="col">Last sign-in</th>
                    <th scope="col">Added</th>
                    <th scope="col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {adminUsers.map((adminUser) => {
                    const isSelf = adminUser.id === currentAdminId;
                    const isBusy = busyAdminId !== null;
                    const isSuperAdmin = adminUser.role === 'super_admin';
                    return (
                      <tr key={adminUser.id}>
                        <td>
                          <span className="cell-strong">{adminUser.name}</span>
                          {adminUser.username !== adminUser.email ? <span className="cell-muted">{adminUser.username}</span> : null}
                        </td>
                        <td className="break-all">{adminUser.email}</td>
                        <td>
                          <RoleBadge role={adminUser.role} />
                        </td>
                        <td>
                          <ActiveBadge isActive={adminUser.isActive} />
                        </td>
                        <td className="whitespace-nowrap">
                          <span className="cell-muted">{adminUser.lastLoginAt ? formatUtcTimestamp(adminUser.lastLoginAt) : 'Never'}</span>
                        </td>
                        <td className="whitespace-nowrap">
                          <span className="cell-muted">{formatUtcTimestamp(adminUser.createdAt)}</span>
                        </td>
                        <td>
                          {isSelf ? (
                            <span className="cell-muted">You</span>
                          ) : (
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                className="btn-secondary btn-sm"
                                disabled={isBusy}
                                onClick={() => request({ adminUser, action: { kind: 'role', role: isSuperAdmin ? 'admin' : 'super_admin' } })}
                              >
                                {isSuperAdmin ? 'Make admin' : 'Make super admin'}
                                <span className="sr-only"> — {adminUser.name}</span>
                              </button>
                              <button
                                type="button"
                                className="btn-secondary btn-sm"
                                disabled={isBusy}
                                onClick={() => request({ adminUser, action: { kind: 'status', isActive: !adminUser.isActive } })}
                              >
                                {adminUser.isActive ? 'Deactivate' : 'Reactivate'}
                                <span className="sr-only"> — {adminUser.name}</span>
                              </button>
                              <button
                                type="button"
                                className="btn-danger-ghost btn-sm"
                                disabled={isBusy}
                                onClick={() => request({ adminUser, action: { kind: 'delete' } })}
                              >
                                Delete<span className="sr-only"> — {adminUser.name}</span>
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>
      </div>

      <ConfirmDialog
        request={planned ? planAction(planned).confirm : null}
        onConfirm={() => {
          if (planned) {
            void runAction(planned);
          }
        }}
        onCancel={() => setPlanned(null)}
      />
    </>
  );
}
