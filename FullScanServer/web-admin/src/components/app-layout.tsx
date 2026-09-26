import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { toErrorMessage } from '../api/client';
import { useAuthStore } from '../stores/auth-store';
import { toInitials } from '../utils/format';
import { ROLE_LABELS } from '../utils/labels';
import { getNavSections } from '../utils/navigation';
import { Alert } from './alert';
import { Icon } from './icon';

function navLinkClass({ isActive }: { readonly isActive: boolean }): string {
  return `flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors ${
    isActive ? 'bg-brand-500/25 text-white' : 'text-slate-300 hover:bg-white/10 hover:text-white'
  }`;
}

/**
 * Drawer layout matching the static portal: docked at `lg` and wider; below that
 * it slides in over the page from a menu button and closes on navigation, the
 * scrim or Escape. While closed off-canvas it is `inert`, so it is out of the tab order.
 */
export function AppLayout() {
  const adminUser = useAuthStore((state) => state.adminUser);
  const logout = useAuthStore((state) => state.logout);
  const navigate = useNavigate();
  const location = useLocation();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLElement>(null);
  const [isDocked, setIsDocked] = useState(() => window.matchMedia('(min-width: 1024px)').matches);

  useEffect(() => {
    const query = window.matchMedia('(min-width: 1024px)');
    const update = (): void => setIsDocked(query.matches);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    setIsDrawerOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!isDrawerOpen) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        setIsDrawerOpen(false);
        menuButtonRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isDrawerOpen]);

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

  const isDrawerHidden = !isDocked && !isDrawerOpen;

  // React 18 has no `inert` prop; set the DOM property directly.
  useEffect(() => {
    if (drawerRef.current) {
      drawerRef.current.inert = isDrawerHidden;
    }
  }, [isDrawerHidden]);

  if (!adminUser) {
    return null;
  }

  return (
    <div className="min-h-screen lg:pl-68">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-brand-700"
      >
        Skip to content
      </a>

      {isDrawerOpen && !isDocked ? (
        <div className="fixed inset-0 z-30 bg-slate-950/50" aria-hidden="true" onClick={() => setIsDrawerOpen(false)} />
      ) : null}

      <aside
        ref={drawerRef}
        id="app-drawer"
        className={`fixed inset-y-0 left-0 z-40 flex w-68 flex-col bg-ink text-white transition-transform motion-reduce:transition-none ${
          isDrawerHidden ? '-translate-x-full' : 'translate-x-0'
        }`}
      >
        <div className="flex items-center justify-between px-5 py-4">
          <span className="text-lg font-bold tracking-tight">
            Full<span className="text-brand-500">Scan</span> <span className="font-medium text-slate-400">Admin</span>
          </span>
          {!isDocked ? (
            <button
              type="button"
              className="btn-ghost min-h-10 px-2 text-slate-300 hover:bg-white/10"
              onClick={() => {
                setIsDrawerOpen(false);
                menuButtonRef.current?.focus();
              }}
            >
              <Icon name="close" />
              <span className="sr-only">Close menu</span>
            </button>
          ) : null}
        </div>

        <div className="mx-4 flex items-center gap-3 rounded-xl bg-white/5 px-3 py-3">
          <span
            aria-hidden="true"
            className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-500 text-sm font-semibold"
          >
            {toInitials(adminUser.name)}
          </span>
          <span className="min-w-0 text-sm leading-tight">
            <span className="block truncate font-medium">{adminUser.name}</span>
            <span className="block text-slate-400">{ROLE_LABELS[adminUser.role]}</span>
          </span>
        </div>

        <nav aria-label="Main" className="mt-4 flex-1 overflow-y-auto px-3">
          {getNavSections(adminUser.role).map((section) => (
            <div key={section.label} className="mb-4">
              <p className="px-3 pb-1 text-xs font-semibold tracking-wider text-slate-500 uppercase">{section.label}</p>
              <ul className="grid grid-cols-1 gap-0.5">
                {section.items.map((item) => (
                  <li key={item.path}>
                    <NavLink to={item.path} end className={navLinkClass}>
                      <Icon name={item.icon} />
                      {item.label}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <div className="border-t border-white/10 p-3">
          <button
            type="button"
            onClick={() => void signOut()}
            disabled={isSigningOut}
            className="btn w-full justify-start gap-3 text-slate-300 hover:bg-white/10 hover:text-white"
          >
            <Icon name="logout" />
            {isSigningOut ? 'Signing out…' : 'Sign out'}
          </button>
        </div>
      </aside>

      {!isDocked ? (
        <header className="sticky top-0 z-20 flex items-center gap-3 bg-ink px-4 py-2 text-white">
          <button
            ref={menuButtonRef}
            type="button"
            className="btn-ghost min-h-11 px-2 text-slate-200 hover:bg-white/10"
            aria-controls="app-drawer"
            aria-expanded={isDrawerOpen}
            onClick={() => setIsDrawerOpen(true)}
          >
            <Icon name="menu" />
            <span className="sr-only">Open menu</span>
          </button>
          <span className="font-bold tracking-tight">
            Full<span className="text-brand-500">Scan</span> Admin
          </span>
        </header>
      ) : null}

      <main id="main" tabIndex={-1} className="mx-auto max-w-7xl px-4 py-6 focus:outline-none sm:px-6 sm:py-8">
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
