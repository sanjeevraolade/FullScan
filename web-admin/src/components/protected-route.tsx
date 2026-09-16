import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/auth-store';
import { APP_BASE_PATH } from '../utils/safe-next-path';
import { Alert } from './alert';
import { FullPageSpinner } from './spinner';

/**
 * Keeps signed-out visitors off the app's pages. A convenience, not the security
 * boundary: the server guards `/admin-app/*` pages and every API route itself.
 */
export function ProtectedRoute() {
  const status = useAuthStore((state) => state.status);
  const checkSession = useAuthStore((state) => state.checkSession);
  const location = useLocation();

  if (status === 'checking') {
    return <FullPageSpinner label="Checking your session…" />;
  }

  if (status === 'unavailable') {
    return (
      <main className="mx-auto flex min-h-screen max-w-md items-center px-4">
        <Alert
          variant="error"
          title="Cannot reach FullScan"
          className="w-full"
          action={
            <button type="button" className="btn-secondary" onClick={() => void checkSession()}>
              Try again
            </button>
          }
        >
          Check your connection, then try again.
        </Alert>
      </main>
    );
  }

  if (status === 'anonymous') {
    const next = `${APP_BASE_PATH}${location.pathname}${location.search}`;
    return <Navigate to={`/login?next=${encodeURIComponent(next)}`} replace />;
  }

  return <Outlet />;
}
