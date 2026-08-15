import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { LoginView } from './pages/LoginView';
import { SignupView } from './pages/SignupView';
import { Dashboard } from './pages/Dashboard';
import { AdminOrganizationList } from './pages/AdminOrganizationList';
import { AdminOrganizationCreate } from './pages/AdminOrganizationCreate';
import { AdminOrganizationDetail } from './pages/AdminOrganizationDetail';
import { ProfileView } from './pages/ProfileView';
import { AdminUserList } from './pages/AdminUserList';
import { AdminUserDetail } from './pages/AdminUserDetail';
import { AdminUserCreate } from './pages/AdminUserCreate';
import { AdminAccountList } from './pages/AdminAccountList';
import { AdminAccountCreate } from './pages/AdminAccountCreate';
import { AdminAuditLogList } from './pages/AdminAuditLogList';
import { OrgOrganizationCreate } from './pages/OrgOrganizationCreate';
import { AdminLayout } from './layouts/AdminLayout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { SnackbarHost } from './components/SnackbarHost';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginView />} />
        <Route path="/signup" element={<SignupView />} />

        <Route
          path="/org/new"
          element={
            <ProtectedRoute>
              <OrgOrganizationCreate />
            </ProtectedRoute>
          }
        />

        <Route
          path="/"
          element={
            <ProtectedRoute requireAdmin>
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="organizations" element={<AdminOrganizationList />} />
          <Route path="organizations/new" element={<AdminOrganizationCreate />} />
          <Route path="organizations/:organizationId" element={<AdminOrganizationDetail />} />
          <Route path="users" element={<AdminUserList />} />
          <Route path="users/new" element={<AdminUserCreate />} />
          <Route path="users/:userId" element={<AdminUserDetail />} />
          <Route path="accounts" element={<AdminAccountList />} />
          <Route path="accounts/new" element={<AdminAccountCreate />} />
          <Route path="audit-logs" element={<AdminAuditLogList />} />
          <Route path="profile" element={<ProfileView />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <SnackbarHost />
    </BrowserRouter>
  );
}

export default App;
