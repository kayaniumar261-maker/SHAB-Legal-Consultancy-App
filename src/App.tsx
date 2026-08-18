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

import { AdministratorRoute } from './components/AdministratorRoute';
import { AppErrorBoundary } from './components/AppErrorBoundary';
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

const Settings = lazyNamed(
  () => import('./pages/Settings'),
  'Settings',
);

const Imports = lazyNamed(
  () => import('./pages/Imports'),
  'Imports',
);

const Payments = lazyNamed(
  () => import('./pages/Payments'),
  'Payments',
);

const VendorBills = lazyNamed(
  () => import('./pages/VendorBills'),
  'VendorBills',
);

const Expenses = lazyNamed(
  () => import('./pages/Expenses'),
  'Expenses',
);

const Vendors = lazyNamed(
  () => import('./pages/Vendors'),
  'Vendors',
);

const Accounting = lazyNamed(
  () => import('./pages/Accounting'),
  'Accounting',
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

const AuthSetup = lazyNamed(
  () => import('./pages/AuthSetup'),
  'AuthSetup',
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
    <AppErrorBoundary>
      <Suspense fallback={<RouteLoadingScreen />}>
      <Routes>
        <Route
          path="/login"
          element={<Login />}
        />

        <Route
          path="/auth/setup"
          element={<AuthSetup />}
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

            <Route element={<AdministratorRoute />}>
              <Route path="/imports" element={<Imports />} />
              <Route path="/payments" element={<Payments />} />
              <Route path="/payments/vendor-bills" element={<VendorBills />} />
              <Route path="/expenses" element={<Expenses />} />
              <Route path="/vendors" element={<Vendors />} />
              <Route path="/accounting" element={<Accounting />} />
              <Route path="/staff" element={<Staff />} />
              <Route path="/staff/:id" element={<StaffDetails />} />
              <Route path="/settings" element={<Settings />} />
            </Route>
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
    </AppErrorBoundary>
  );
}

export default App;
