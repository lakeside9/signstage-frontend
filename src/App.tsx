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
import { OrgDashboard } from './pages/OrgDashboard';
import { OrgOrganizationList } from './pages/OrgOrganizationList';
import { OrgOrganizationRequestList } from './pages/OrgOrganizationRequestList';
import { OrgOrganizationRequestCreate } from './pages/OrgOrganizationRequestCreate';
import { AdminOrganizationRequestList } from './pages/AdminOrganizationRequestList';
import { AdminLayout } from './layouts/AdminLayout';
import { OrgLayout } from './layouts/OrgLayout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { SnackbarHost } from './components/SnackbarHost';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginView />} />
        <Route path="/signup" element={<SignupView />} />

        <Route
          path="/org"
          element={
            <ProtectedRoute>
              <OrgLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<OrgDashboard />} />
          <Route path="organizations" element={<OrgOrganizationList />} />
          <Route path="organizations/requests" element={<OrgOrganizationRequestList />} />
          <Route path="organizations/requests/new" element={<OrgOrganizationRequestCreate />} />
          <Route path="profile" element={<ProfileView />} />
        </Route>

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
          <Route path="organization-requests" element={<AdminOrganizationRequestList />} />
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
