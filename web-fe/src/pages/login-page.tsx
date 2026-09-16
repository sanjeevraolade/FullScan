import { useId, useState, type ChangeEvent, type FormEvent } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { ApiError, toErrorMessage } from '../api/client';
import { Alert } from '../components/alert';
import { FullPageSpinner } from '../components/spinner';
import { useAuthStore } from '../stores/auth-store';
import { toSafeAppRoute } from '../utils/safe-next-path';
import { useDocumentTitle } from '../utils/use-document-title';
import { validateLoginForm, type LoginFormErrors, type LoginFormValues } from '../utils/validation';

const EMPTY_FORM: LoginFormValues = { username: '', password: '' };

function toLoginErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.status === 400) {
    return 'Check your username and password.';
  }
  return toErrorMessage(error, 'Could not sign in. Please try again.');
}

export function LoginPage() {
  useDocumentTitle('Sign in');
  const formId = useId();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const status = useAuthStore((state) => state.status);
  const login = useAuthStore((state) => state.login);

  const [values, setValues] = useState<LoginFormValues>(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState<LoginFormErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const nextRoute = toSafeAppRoute(searchParams.get('next')) ?? '/';

  if (status === 'checking') {
    return <FullPageSpinner label="Checking your session…" />;
  }

  if (status === 'authenticated' && !isSubmitting) {
    return <Navigate to={nextRoute} replace />;
  }

  const updateField =
    (field: keyof LoginFormValues) =>
    (event: ChangeEvent<HTMLInputElement>): void => {
      setValues((current) => ({ ...current, [field]: event.target.value }));
      setFieldErrors((current) => ({ ...current, [field]: undefined }));
    };

  const submit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (isSubmitting) {
      return;
    }

    setFormError(null);
    const validation = validateLoginForm(values);
    if (!validation.isValid) {
      setFieldErrors(validation.errors);
      document.getElementById(`${formId}-${validation.errors.username ? 'username' : 'password'}`)?.focus();
      return;
    }

    setIsSubmitting(true);
    try {
      await login(validation.value);
      navigate(nextRoute, { replace: true });
    } catch (error) {
      setFormError(toLoginErrorMessage(error));
      setValues((current) => ({ ...current, password: '' }));
      setIsSubmitting(false);
    }
  };

  const usernameErrorId = `${formId}-username-error`;
  const passwordErrorId = `${formId}-password-error`;

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <p className="text-center text-2xl font-bold tracking-tight">
          Full<span className="text-brand-500">Scan</span>
        </p>
        <div className="card mt-6 p-6 sm:p-8">
          <h1 className="text-xl font-semibold">Field executive sign in</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Use the same username and password as the FullScan mobile app.
          </p>

          {status === 'unavailable' ? (
            <Alert variant="warning" className="mt-5">
              The server could not be reached. You can still try to sign in.
            </Alert>
          ) : null}

          {formError ? (
            <Alert variant="error" className="mt-5">
              {formError}
            </Alert>
          ) : null}

          <form className="mt-6 grid gap-5" onSubmit={(event) => void submit(event)} noValidate>
            <div>
              <label htmlFor={`${formId}-username`} className="label">
                Username
              </label>
              <input
                id={`${formId}-username`}
                name="username"
                type="text"
                className="input"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                value={values.username}
                onChange={updateField('username')}
                aria-invalid={fieldErrors.username ? true : undefined}
                aria-describedby={fieldErrors.username ? usernameErrorId : undefined}
                disabled={isSubmitting}
                autoFocus
              />
              {fieldErrors.username ? (
                <p id={usernameErrorId} className="mt-1.5 text-sm text-red-700 dark:text-red-300">
                  {fieldErrors.username}
                </p>
              ) : null}
            </div>

            <div>
              <label htmlFor={`${formId}-password`} className="label">
                Password
              </label>
              <input
                id={`${formId}-password`}
                name="password"
                type="password"
                className="input"
                autoComplete="current-password"
                value={values.password}
                onChange={updateField('password')}
                aria-invalid={fieldErrors.password ? true : undefined}
                aria-describedby={fieldErrors.password ? passwordErrorId : undefined}
                disabled={isSubmitting}
              />
              {fieldErrors.password ? (
                <p id={passwordErrorId} className="mt-1.5 text-sm text-red-700 dark:text-red-300">
                  {fieldErrors.password}
                </p>
              ) : null}
            </div>

            <button type="submit" className="btn-primary w-full" disabled={isSubmitting}>
              {isSubmitting ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
