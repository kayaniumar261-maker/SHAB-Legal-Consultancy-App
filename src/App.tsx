import {
  Navigate,
  Route,
  Routes,
} from 'react-router-dom';

import { ProtectedRoute } from './components/ProtectedRoute';
import { AppLayout } from './layouts/AppLayout';

import { CaseDetails } from './pages/CaseDetails';
import { CaseFormPage } from './pages/CaseFormPage';
import { Cases } from './pages/Cases';
import { ClientDetails } from './pages/ClientDetails';
import { Clients } from './pages/Clients';
import { Dashboard } from './pages/Dashboard';
import { Calendar } from './pages/Calendar';
import { Documents } from './pages/Documents';
import { Hearings } from './pages/Hearings';
import { Login } from './pages/Login';
import { Payments } from './pages/Payments';
import { PlaceholderPage } from './pages/PlaceholderPage';
import { Staff } from './pages/Staff';
import { Tasks } from './pages/Tasks';

function App() {
  return (
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
  );
}

export default App;