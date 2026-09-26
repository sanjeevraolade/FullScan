import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { AppLayout } from './components/app-layout';
import { ProtectedRoute } from './components/protected-route';
import { AssignmentDetailPage } from './pages/assignment-detail-page';
import { AssignmentsPage } from './pages/assignments-page';
import { DashboardPage } from './pages/dashboard-page';
import { LoginPage } from './pages/login-page';
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
            { index: true, element: <DashboardPage /> },
            { path: 'assignments', element: <AssignmentsPage /> },
            { path: 'assignments/:componentId', element: <AssignmentDetailPage /> },
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
