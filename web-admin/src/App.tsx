import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom';
import { AppLayout } from './components/app-layout';
import { ProtectedRoute } from './components/protected-route';
import { RequireRole } from './components/require-role';
import { AdminUsersPage } from './pages/admin-users-page';
import { EditCaseRoute, NewCaseRoute } from './pages/case-editor-page';
import { CasesPage } from './pages/cases-page';
import { DeviceChangeRequestsPage } from './pages/device-change-requests-page';
import { FieldExecutiveHistoryPage } from './pages/field-executive-history-page';
import { LoginPage } from './pages/login-page';
import { MobileAppSettingsPage } from './pages/mobile-app-settings-page';
import { NotFoundPage } from './pages/not-found-page';
import { APP_BASE_PATH } from './utils/safe-next-path';

const router = createBrowserRouter(
  [
    { path: '/login', element: <LoginPage /> },
    {
      element: <ProtectedRoute />,
      children: [
        {
          element: <AppLayout />,
          children: [
            { index: true, element: <Navigate to="/cases" replace /> },
            { path: 'cases', element: <CasesPage /> },
            { path: 'cases/new', element: <NewCaseRoute /> },
            { path: 'cases/:caseId', element: <EditCaseRoute /> },
            { path: 'field-executive-history', element: <FieldExecutiveHistoryPage /> },
            { path: 'device-change-requests', element: <DeviceChangeRequestsPage /> },
            {
              path: 'mobile-app-settings',
              element: (
                <RequireRole roles={['super_admin']}>
                  <MobileAppSettingsPage />
                </RequireRole>
              ),
            },
            {
              path: 'admin-users',
              element: (
                <RequireRole roles={['super_admin']}>
                  <AdminUsersPage />
                </RequireRole>
              ),
            },
            { path: '*', element: <NotFoundPage /> },
          ],
        },
      ],
    },
  ],
  { basename: APP_BASE_PATH },
);

export function App() {
  return <RouterProvider router={router} />;
}
