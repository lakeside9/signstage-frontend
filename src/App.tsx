import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { LoginView } from './pages/LoginView';
import { Dashboard } from './pages/Dashboard';
import { ProfileView } from './pages/ProfileView';
import { AdminLayout } from './layouts/AdminLayout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { SnackbarHost } from './components/SnackbarHost';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginView />} />

        <Route
          path="/"
          element={
            <ProtectedRoute>
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="profile" element={<ProfileView />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <SnackbarHost />
    </BrowserRouter>
  );
}

export default App;
