import { Navigate, Route, Routes } from 'react-router-dom';

import { AppLayout } from './layouts/AppLayout';
import { Dashboard } from './pages/Dashboard';
import { PlaceholderPage } from './pages/PlaceholderPage';

function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route
          path="/"
          element={<Dashboard />}
        />

        <Route
          path="/clients"
          element={
            <PlaceholderPage title="Clients" />
          }
        />

        <Route
          path="/cases"
          element={
            <PlaceholderPage title="Cases" />
          }
        />

        <Route
          path="/tasks"
          element={
            <PlaceholderPage title="Tasks" />
          }
        />

        <Route
          path="/hearings"
          element={
            <PlaceholderPage title="Hearings" />
          }
        />

        <Route
          path="/calendar"
          element={
            <PlaceholderPage title="Calendar" />
          }
        />

        <Route
          path="/documents"
          element={
            <PlaceholderPage title="Documents" />
          }
        />

        <Route
          path="/payments"
          element={
            <PlaceholderPage title="Payments" />
          }
        />

        <Route
          path="/staff"
          element={
            <PlaceholderPage title="Staff" />
          }
        />

        <Route
          path="/settings"
          element={
            <PlaceholderPage title="Settings" />
          }
        />
      </Route>

      <Route
        path="*"
        element={<Navigate to="/" replace />}
      />
    </Routes>
  );
}

export default App;
