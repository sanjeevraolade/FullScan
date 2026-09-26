import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { toErrorMessage } from '../api/client';
import { useAuthStore } from '../stores/auth-store';
import { toInitials } from '../utils/format';
import { Alert } from './alert';

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/assignments', label: 'Assignments', end: false },
] as const;

function navLinkClass({ isActive }: { readonly isActive: boolean }): string {
  return `inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-medium transition-colors ${
    isActive
      ? 'bg-white/15 text-white'
      : 'text-slate-300 hover:bg-white/10 hover:text-white'
  }`;
}

export function AppLayout() {
  const fieldExecutive = useAuthStore((state) => state.fieldExecutive);
  const logout = useAuthStore((state) => state.logout);
  const navigate = useNavigate();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);

  const signOut = async (): Promise<void> => {
    setIsSigningOut(true);
    setSignOutError(null);
    try {
      await logout();
      navigate('/login', { replace: true });
    } catch (error) {
      setSignOutError(toErrorMessage(error, 'Could not sign out. Please try again.'));
      setIsSigningOut(false);
    }
  };

  return (
    <div className="min-h-screen">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-brand-700"
      >
        Skip to content
      </a>

      <header className="bg-ink text-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-2 sm:px-6">
          <span className="text-lg font-bold tracking-tight">
            Full<span className="text-brand-500">Scan</span>
          </span>

          <nav aria-label="Main" className="order-3 flex w-full gap-1 sm:order-none sm:w-auto">
            {NAV_ITEMS.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.end} className={navLinkClass}>
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-3">
            {fieldExecutive ? (
              <div className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className="flex size-9 items-center justify-center rounded-full bg-brand-500 text-sm font-semibold"
                >
                  {toInitials(fieldExecutive.name)}
                </span>
                <span className="hidden text-sm leading-tight md:block">
                  <span className="block font-medium">{fieldExecutive.name}</span>
                  <span className="block text-slate-400">{fieldExecutive.role}</span>
                </span>
              </div>
            ) : null}
            <button
              type="button"
              onClick={() => void signOut()}
              disabled={isSigningOut}
              className="btn border border-white/20 text-white hover:bg-white/10"
            >
              {isSigningOut ? 'Signing out…' : 'Sign out'}
            </button>
          </div>
        </div>
      </header>

      <main id="main" tabIndex={-1} className="mx-auto max-w-6xl px-4 py-6 focus:outline-none sm:px-6 sm:py-8">
        {signOutError ? (
          <Alert variant="error" className="mb-4">
            {signOutError}
          </Alert>
        ) : null}
        <Outlet />
      </main>
    </div>
  );
}
