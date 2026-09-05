import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getInternationalizationPreferences } from '../utils/internationalization';

const resources = {
  ko: {
    translation: {
      common: {
        user: '사용자', admin: '관리자', logout: '로그아웃', settings: '설정',
        collapseSidebar: '사이드바 접기', expandSidebar: '사이드바 펼치기',
        requestFailed: '요청 처리에 실패했습니다.', fileLoadFailed: '파일을 불러오지 못했습니다.',
        sessionExpired: '인증이 만료되었습니다. 다시 로그인해주세요.',
      },
      navigation: {
        dashboard: '대시보드', ceremonies: '행사 관리', organization: '회사정보관리', profile: '내 정보',
        partners: '파트너관리', partnerRequests: '파트너등록요청관리', users: '회원 관리',
        adminAccounts: '관리자 계정', billingCatalog: '과금 카탈로그', billingSimulator: '과금 시뮬레이터',
        purchaseRequests: '추가구매 요청', auditLogs: '감사 로그',
      },
      permission: {
        management: '권한 관리',
        action: {
          accountCreate: '관리자 계정 생성', accountRoleChange: '관리자 등급 변경', accountRevoke: '관리자 권한 해제',
          userForceWithdraw: '회원 강제 탈퇴', memberForceControl: '회원 상태 제어(상태 변경/잠금 해제/비밀번호 재설정)',
          partnerCreate: '파트너 등록', partnerStatusChange: '파트너 상태 변경', partnerInfoEdit: '파트너 정보 수정',
          billingCatalogManage: '과금 카탈로그 등록/수정',
        },
      },
      auth: {
        signInGuide: '관리자 계정으로 로그인하세요', changePasswordGuide: '처음 로그인 시 비밀번호를 변경해야 합니다',
        loginId: '아이디', password: '비밀번호', signIn: '로그인', signingIn: '로그인 중...',
        showPassword: '비밀번호 표시', hidePassword: '비밀번호 숨기기',
        noAccount: '계정이 없으신가요?', signUp: '회원가입',
        enterCredentials: '아이디와 비밀번호를 입력해주세요.', firstLogin: '최초 로그인입니다. 비밀번호를 변경해주세요.',
        signedIn: '로그인되었습니다.', communicationFailed: '서버와의 통신 중 오류가 발생했습니다.',
        newPassword: '새 비밀번호', confirmNewPassword: '새 비밀번호 확인',
        enterNewPassword: '새 비밀번호를 입력해주세요.', passwordMismatch: '새 비밀번호가 일치하지 않습니다.',
        passwordChanged: '비밀번호가 변경되었습니다. 새 비밀번호로 다시 로그인해주세요.',
        passwordChangeFailed: '비밀번호 변경에 실패했습니다.', changePassword: '비밀번호 변경', changingPassword: '변경 중...',
        backToSignIn: '로그인으로 돌아가기',
      },
      profile: {
        title: '내 정보', description: '프로필과 비밀번호를 수정할 수 있습니다.', profile: '프로필', loginId: '로그인 아이디',
        name: '이름', email: '이메일', phone: '전화번호', optional: '선택 입력', language: '언어',
        formatLocale: '날짜·숫자 표시 형식', timeZone: '시간대', save: '저장', saving: '저장 중...', loading: '불러오는 중...',
        emailLocked: '로그인 아이디로도 사용되고 있어 변경할 수 없습니다.', loadFailed: '내 정보를 불러오지 못했습니다.',
        required: '이름과 이메일은 필수입니다.', saved: '내 정보가 수정되었습니다.', saveFailed: '내 정보 수정에 실패했습니다.',
        passwordChange: '비밀번호 변경', currentPassword: '현재 비밀번호', passwordFieldsRequired: '비밀번호 항목을 모두 입력해주세요.',
        passwordMismatch: '새 비밀번호가 일치하지 않습니다.', passwordChanged: '비밀번호가 변경되었습니다.',
        passwordChangeFailed: '비밀번호 변경에 실패했습니다.', changing: '변경 중...',
      },
      error: {
        invalid: { request: '요청 값이 올바르지 않습니다.' }, unauthorized: '인증이 필요합니다.',
        access: { denied: '접근 권한이 없습니다.' }, internal: { server: { error: '서버 오류가 발생했습니다.' } },
        identity: {
          invalid: { credential: '아이디 또는 비밀번호가 올바르지 않습니다.', reset: { token: '비밀번호 변경 요청이 유효하지 않습니다. 다시 로그인해주세요.' } },
          account: { locked: '계정이 잠겼습니다. 잠시 후 다시 시도해주세요.', pending: { approval: '가입 승인 대기 중입니다. 승인 후 로그인할 수 있습니다.' }, disabled: '비활성화된 계정입니다. 관리자에게 문의하세요.' },
          duplicate: { login: { id: '이미 존재하는 아이디입니다.' }, email: '이미 사용 중인 이메일입니다.' },
          email: { change: { not: { allowed: '이메일은 로그인 아이디로도 쓰이고 있어 변경할 수 없습니다.' } } },
        },
      },
      validation: {
        notblank: '{{field}} 항목은 필수입니다.', notnull: '{{field}} 항목은 필수입니다.',
        email: '{{field}} 항목은 올바른 이메일 형식이어야 합니다.', pattern: '{{field}} 항목의 형식이 올바르지 않습니다.',
        size: '{{field}} 항목의 길이가 올바르지 않습니다.', min: '{{field}} 항목이 허용된 최솟값보다 작습니다.',
        max: '{{field}} 항목이 허용된 최댓값보다 큽니다.', invalid: '{{field}} 항목이 올바르지 않습니다.',
      },
    },
  },
  en: {
    translation: {
      common: {
        user: 'User', admin: 'Administrator', logout: 'Sign out', settings: 'Settings',
        collapseSidebar: 'Collapse sidebar', expandSidebar: 'Expand sidebar',
        requestFailed: 'The request could not be completed.', fileLoadFailed: 'The file could not be loaded.',
        sessionExpired: 'Your session has expired. Please sign in again.',
      },
      navigation: {
        dashboard: 'Dashboard', ceremonies: 'Ceremonies', organization: 'Company settings', profile: 'My profile',
        partners: 'Partners', partnerRequests: 'Partner requests', users: 'Users', adminAccounts: 'Admin accounts',
        billingCatalog: 'Billing catalog', billingSimulator: 'Billing simulator', purchaseRequests: 'Purchase requests',
        auditLogs: 'Audit logs',
      },
      permission: {
        management: 'Permission management',
        action: {
          accountCreate: 'Create admin account', accountRoleChange: 'Change admin grade', accountRevoke: 'Revoke admin privileges',
          userForceWithdraw: 'Force withdraw user', memberForceControl: 'Control member status (status change / unlock / password reset)',
          partnerCreate: 'Create partner', partnerStatusChange: 'Change partner status', partnerInfoEdit: 'Edit partner info',
          billingCatalogManage: 'Manage billing catalog',
        },
      },
      auth: {
        signInGuide: 'Sign in with your administrator account', changePasswordGuide: 'Change your password to continue',
        loginId: 'Login ID', password: 'Password', signIn: 'Sign in', signingIn: 'Signing in...',
        showPassword: 'Show password', hidePassword: 'Hide password', noAccount: "Don't have an account?", signUp: 'Sign up',
        enterCredentials: 'Enter your login ID and password.', firstLogin: 'This is your first sign-in. Change your password to continue.',
        signedIn: 'Signed in.', communicationFailed: 'A communication error occurred.',
        newPassword: 'New password', confirmNewPassword: 'Confirm new password', enterNewPassword: 'Enter a new password.',
        passwordMismatch: 'The new passwords do not match.', passwordChanged: 'Your password has been changed. Sign in with the new password.',
        passwordChangeFailed: 'The password could not be changed.', changePassword: 'Change password', changingPassword: 'Changing...',
        backToSignIn: 'Back to sign in',
      },
      profile: {
        title: 'My profile', description: 'Update your profile and password.', profile: 'Profile', loginId: 'Login ID',
        name: 'Name', email: 'Email', phone: 'Phone', optional: 'Optional', language: 'Language',
        formatLocale: 'Date and number format', timeZone: 'Time zone', save: 'Save', saving: 'Saving...', loading: 'Loading...',
        emailLocked: 'This address is also your login ID and cannot be changed.', loadFailed: 'Your profile could not be loaded.',
        required: 'Name and email are required.', saved: 'Your profile has been updated.', saveFailed: 'Your profile could not be updated.',
        passwordChange: 'Change password', currentPassword: 'Current password', passwordFieldsRequired: 'Complete all password fields.',
        passwordMismatch: 'The new passwords do not match.', passwordChanged: 'Your password has been changed.',
        passwordChangeFailed: 'The password could not be changed.', changing: 'Changing...',
      },
      error: {
        invalid: { request: 'The request contains an invalid value.' }, unauthorized: 'Authentication is required.',
        access: { denied: 'You do not have permission to perform this action.' }, internal: { server: { error: 'An internal server error occurred.' } },
        identity: {
          invalid: { credential: 'The login ID or password is incorrect.', reset: { token: 'The password reset request is no longer valid. Please sign in again.' } },
          account: { locked: 'The account is locked. Please try again later.', pending: { approval: 'Your registration is awaiting approval. You can sign in after approval.' }, disabled: 'This account is disabled. Please contact an administrator.' },
          duplicate: { login: { id: 'This login ID is already in use.' }, email: 'This email address is already in use.' },
          email: { change: { not: { allowed: 'The email address is also used as the login ID and cannot be changed.' } } },
        },
      },
      validation: {
        notblank: '{{field}} is required.', notnull: '{{field}} is required.', email: '{{field}} must be a valid email address.',
        pattern: '{{field}} has an invalid format.', size: '{{field}} has an invalid length.',
        min: '{{field}} is below the allowed minimum.', max: '{{field}} exceeds the allowed maximum.', invalid: '{{field}} is invalid.',
      },
    },
  },
} as const;

void i18n.use(initReactI18next).init({
  resources,
  lng: getInternationalizationPreferences().languageCode,
  fallbackLng: 'ko',
  interpolation: { escapeValue: false },
  returnNull: false,
});

window.addEventListener('signstage:language-change', ((event: CustomEvent<string>) => {
  void i18n.changeLanguage(event.detail);
}) as EventListener);

export default i18n;
