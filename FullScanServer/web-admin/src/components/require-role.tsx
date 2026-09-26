import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../stores/auth-store';
import type { AdminRole } from '../types/auth';
import { useDocumentTitle } from '../utils/use-document-title';

interface RequireRoleProps {
  readonly roles: readonly AdminRole[];
  readonly children: ReactNode;
}

function NoAccess() {
  useDocumentTitle('No access');
  return (
    <div className="card mx-auto max-w-md p-8 text-center">
      <h1 className="text-xl font-semibold">Not available for your role</h1>
      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
        This page is for super admins. Ask a super admin if you need access.
      </p>
      <Link to="/cases" className="btn-primary mt-6">
        Go to cases
      </Link>
    </div>
  );
}

/** Hides a page from roles that cannot use it. The server enforces the same rule on the API. */
export function RequireRole({ roles, children }: RequireRoleProps) {
  const role = useAuthStore((state) => state.adminUser?.role);
  return role && roles.includes(role) ? <>{children}</> : <NoAccess />;
}
