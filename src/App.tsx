import {
  lazy,
  Suspense,
  type ComponentType,
} from 'react';

import {
  Navigate,
  Route,
  Routes,
} from 'react-router-dom';

import { ProtectedRoute } from './components/ProtectedRoute';
import { AppLayout } from './layouts/AppLayout';

type ModuleWithComponent<TProps extends object> = Record<
  string,
  ComponentType<TProps>
>;

function lazyNamed<TProps extends object>(
  loader: () => Promise<ModuleWithComponent<TProps>>,
  exportName: string,
) {
  return lazy(async () => {
    const module = await loader();
    const component = module[exportName];

    if (!component) {
      throw new Error(
        `Lazy-loaded export "${exportName}" was not found.`,
      );
    }

    return {
      default: component,
    };
  });
}

const Dashboard = lazyNamed(
  () => import('./pages/Dashboard'),
  'Dashboard',
);

const Clients = lazyNamed(
  () => import('./pages/Clients'),
  'Clients',
);

const ClientDetails = lazyNamed(
  () => import('./pages/ClientDetails'),
  'ClientDetails',
);

const Cases = lazyNamed(
  () => import('./pages/Cases'),
  'Cases',
);

const CaseFormPage = lazyNamed(
  () => import('./pages/CaseFormPage'),
  'CaseFormPage',
);

const CaseDetails = lazyNamed(
  () => import('./pages/CaseDetails'),
  'CaseDetails',
);

const Tasks = lazyNamed(
  () => import('./pages/Tasks'),
  'Tasks',
);

const Hearings = lazyNamed(
  () => import('./pages/Hearings'),
  'Hearings',
);

const Calendar = lazyNamed(
  () => import('./pages/Calendar'),
  'Calendar',
);

const Documents = lazyNamed(
  () => import('./pages/Documents'),
  'Documents',
);

const Payments = lazyNamed(
  () => import('./pages/Payments'),
  'Payments',
);

const Staff = lazyNamed(
  () => import('./pages/Staff'),
  'Staff',
);

const StaffDetails = lazyNamed(
  () => import('./pages/StaffDetails'),
  'StaffDetails',
);

const Login = lazyNamed(
  () => import('./pages/Login'),
  'Login',
);

const PlaceholderPage = lazyNamed<{
  title: string;
}>(
  () => import('./pages/PlaceholderPage'),
  'PlaceholderPage',
);

function RouteLoadingScreen() {
  return (
    <div className="route-loading-screen">
      <div className="route-loading-spinner" />

      <strong>Loading SHAB workspace…</strong>
    </div>
  );
}

function App() {
  return (
    <Suspense fallback={<RouteLoadingScreen />}>
      <Routes>
        <Route
          path="/login"
          element={<Login />}
        />

        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route
              path="/"
              element={<Dashboard />}
            />

            <Route
              path="/clients"
              element={<Clients />}
            />

            <Route
              path="/clients/:id"
              element={<ClientDetails />}
            />

            <Route
              path="/cases"
              element={<Cases />}
            />

            <Route
              path="/cases/new"
              element={<CaseFormPage />}
            />

            <Route
              path="/cases/:id/edit"
              element={<CaseFormPage />}
            />

            <Route
              path="/cases/:id"
              element={<CaseDetails />}
            />

            <Route
              path="/tasks"
              element={<Tasks />}
            />

            <Route
              path="/hearings"
              element={<Hearings />}
            />

            <Route
              path="/calendar"
              element={<Calendar />}
            />

            <Route
              path="/documents"
              element={<Documents />}
            />

            <Route
              path="/payments"
              element={<Payments />}
            />

            <Route
              path="/staff"
              element={<Staff />}
            />

            <Route
              path="/staff/:id"
              element={<StaffDetails />}
            />

            <Route
              path="/settings"
              element={
                <PlaceholderPage title="Settings" />
              }
            />
          </Route>
        </Route>

        <Route
          path="*"
          element={
            <Navigate
              to="/"
              replace
            />
          }
        />
      </Routes>
    </Suspense>
  );
}

export default App;
