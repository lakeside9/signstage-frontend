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
import { UserDashboard } from './pages/UserDashboard';
import { UserOrganizationList } from './pages/UserOrganizationList';
import { UserOrganizationDetail } from './pages/UserOrganizationDetail';
import { UserOrganizationRequests } from './pages/UserOrganizationRequests';
import { AdminOrganizationRequestList } from './pages/AdminOrganizationRequestList';
import { UserCeremonyEntry } from './pages/UserCeremonyEntry';
import { UserCeremonyList } from './pages/UserCeremonyList';
import { UserCeremonyCreate } from './pages/UserCeremonyCreate';
import { UserCeremonyDetail } from './pages/UserCeremonyDetail';
import { UserCeremonyEventCreate } from './pages/UserCeremonyEventCreate';
import { UserCeremonyEventDetail } from './pages/UserCeremonyEventDetail';
import { UserSignerList } from './pages/UserSignerList';
import { UserTemplateList } from './pages/UserTemplateList';
import { UserTemplateDetail } from './pages/UserTemplateDetail';
import { SignerPortalView } from './pages/SignerPortalView';
import { AdminLayout } from './layouts/AdminLayout';
import { UserLayout } from './layouts/UserLayout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { SnackbarHost } from './components/SnackbarHost';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginView />} />
        <Route path="/signup" element={<SignupView />} />
        <Route path="/portal/:eventAccessKey/:signerAccessKey" element={<SignerPortalView />} />

        <Route
          path="/org"
          element={
            <ProtectedRoute>
              <UserLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<UserDashboard />} />
          <Route path="organizations" element={<UserOrganizationList />} />
          <Route path="organizations/:organizationId" element={<UserOrganizationDetail />} />
          <Route path="organization-requests" element={<UserOrganizationRequests />} />
          <Route path="ceremonies" element={<UserCeremonyEntry />} />
          <Route path="ceremonies/:organizationId" element={<UserCeremonyList />} />
          <Route path="ceremonies/:organizationId/new" element={<UserCeremonyCreate />} />
          <Route path="ceremonies/:organizationId/:ceremonyId" element={<UserCeremonyDetail />} />
          <Route path="ceremonies/:organizationId/:ceremonyId/events/new" element={<UserCeremonyEventCreate />} />
          <Route
            path="ceremonies/:organizationId/:ceremonyId/events/:eventId"
            element={<UserCeremonyEventDetail />}
          />
          <Route path="ceremonies/:organizationId/:ceremonyId/signers" element={<UserSignerList />} />
          <Route path="ceremonies/:organizationId/:ceremonyId/templates" element={<UserTemplateList />} />
          <Route
            path="ceremonies/:organizationId/:ceremonyId/templates/:templateId"
            element={<UserTemplateDetail />}
          />
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
