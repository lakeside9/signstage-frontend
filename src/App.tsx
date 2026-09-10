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
import { AdminBillingPlanList } from './pages/AdminBillingPlanList';
import { AdminBillingPlanCreate } from './pages/AdminBillingPlanCreate';
import { AdminBillingPlanDetail } from './pages/AdminBillingPlanDetail';
import { AdminBillingPlanEdit } from './pages/AdminBillingPlanEdit';
import { AdminUnitProductList } from './pages/AdminUnitProductList';
import { AdminUnitProductCreate } from './pages/AdminUnitProductCreate';
import { AdminUnitProductDetail } from './pages/AdminUnitProductDetail';
import { AdminUnitProductEdit } from './pages/AdminUnitProductEdit';
import { AdminBillingSimulator } from './pages/AdminBillingSimulator';
import { AdminCeremonyPurchaseRequests } from './pages/AdminCeremonyPurchaseRequests';
import { AdminCeremonyDiscounts } from './pages/AdminCeremonyDiscounts';
import { AdminCeremonyDiscountDetail } from './pages/AdminCeremonyDiscountDetail';
import { AdminOrganizationDiscountOverrides } from './pages/AdminOrganizationDiscountOverrides';
import { AdminOrganizationDiscountOverrideDetail } from './pages/AdminOrganizationDiscountOverrideDetail';
import { AdminPermissionMatrix } from './pages/AdminPermissionMatrix';
import { AdminMenuManager } from './pages/AdminMenuManager';
import { AdminDemoCeremonies } from './pages/AdminDemoCeremonies';
import { CeremonyEffectManagement } from './pages/CeremonyEffectManagement';
import { CeremonyEffectRegister } from './pages/CeremonyEffectRegister';
import { CeremonyEffectEdit } from './pages/CeremonyEffectEdit';
import { UserDashboard } from './pages/UserDashboard';
import { UserOrganizationList } from './pages/UserOrganizationList';
import { UserOrganizationDetail } from './pages/UserOrganizationDetail';
import { UserOrganizationRequests } from './pages/UserOrganizationRequests';
import { AdminOrganizationRequestList } from './pages/AdminOrganizationRequestList';
import { UserCeremonyEntry } from './pages/UserCeremonyEntry';
import { UserCeremonyList } from './pages/UserCeremonyList';
import { UserCeremonyCreate } from './pages/UserCeremonyCreate';
import { UserCeremonyDetail } from './pages/UserCeremonyDetail';
import { UserCeremonyEdit } from './pages/UserCeremonyEdit';
import { UserCeremonyEventCreate } from './pages/UserCeremonyEventCreate';
import { UserCeremonyEventControl } from './pages/UserCeremonyEventControl';
import { UserCeremonyEventMapping } from './pages/UserCeremonyEventMapping';
import { UserSignerPortalQrWindow } from './pages/UserSignerPortalQrWindow';
import { UserTemplateDetail } from './pages/UserTemplateDetail';
import { SignerPortalView } from './pages/SignerPortalView';
import { DocumentVerificationView } from './pages/DocumentVerificationView';
import { ProjectorView } from './pages/ProjectorView';
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
        <Route path="/verify" element={<DocumentVerificationView />} />
        <Route path="/projector/:eventAccessKey" element={<ProjectorView />} />
        <Route
          path="/ceremonies/:organizationId/:ceremonyId/events/:eventId/signer-portal-qrs"
          element={
            <ProtectedRoute>
              <UserSignerPortalQrWindow />
            </ProtectedRoute>
          }
        />

        <Route
          path="/"
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
          <Route path="ceremonies/:organizationId/:ceremonyId/edit" element={<UserCeremonyEdit />} />
          <Route path="ceremonies/:organizationId/:ceremonyId/events/new" element={<UserCeremonyEventCreate />} />
          <Route
            path="ceremonies/:organizationId/:ceremonyId/events/:eventId/control"
            element={<UserCeremonyEventControl />}
          />
          <Route
            path="ceremonies/:organizationId/:ceremonyId/events/:eventId/mapping"
            element={<UserCeremonyEventMapping />}
          />
          <Route
            path="ceremonies/:organizationId/:ceremonyId/templates/:templateId"
            element={<UserTemplateDetail />}
          />
          <Route path="profile" element={<ProfileView />} />
        </Route>

        <Route
          path="/admin"
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
          <Route path="billing-catalog/plans" element={<AdminBillingPlanList />} />
          <Route path="billing-catalog/plans/new" element={<AdminBillingPlanCreate />} />
          <Route path="billing-catalog/plans/:id" element={<AdminBillingPlanDetail />} />
          <Route path="billing-catalog/plans/:id/edit" element={<AdminBillingPlanEdit />} />
          <Route path="billing-catalog/unit-products" element={<AdminUnitProductList />} />
          <Route path="billing-catalog/unit-products/new" element={<AdminUnitProductCreate />} />
          <Route path="billing-catalog/unit-products/:id" element={<AdminUnitProductDetail />} />
          <Route path="billing-catalog/unit-products/:id/edit" element={<AdminUnitProductEdit />} />
          <Route path="billing-simulator" element={<AdminBillingSimulator />} />
          <Route path="purchase-requests" element={<AdminCeremonyPurchaseRequests />} />
          <Route path="ceremony-discounts" element={<AdminCeremonyDiscounts />} />
          <Route path="ceremony-discounts/:organizationId/:ceremonyId" element={<AdminCeremonyDiscountDetail />} />
          <Route path="organization-discount-overrides" element={<AdminOrganizationDiscountOverrides />} />
          <Route
            path="organization-discount-overrides/:organizationId/:billingPlanId"
            element={<AdminOrganizationDiscountOverrideDetail />}
          />
          <Route path="demo-ceremonies" element={<AdminDemoCeremonies />} />
          <Route path="permissions" element={<AdminPermissionMatrix />} />
          <Route path="menus" element={<AdminMenuManager />} />
          <Route path="effects" element={<CeremonyEffectManagement />} />
          <Route path="effects/new" element={<CeremonyEffectRegister />} />
          <Route path="effects/:id/edit" element={<CeremonyEffectEdit />} />
          <Route path="profile" element={<ProfileView />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <SnackbarHost />
    </BrowserRouter>
  );
}

export default App;
