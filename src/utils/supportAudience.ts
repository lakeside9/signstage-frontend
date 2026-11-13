import type { SupportAudience } from '../types';

/** FAQ·공지사항 대상 이름과 노출 위치 — 관리자 목록 탭, 등록·수정 화면이 같이 쓴다. */
export const SUPPORT_AUDIENCES: SupportAudience[] = ['PARTNER', 'CUSTOMER'];

export const SUPPORT_AUDIENCE_LABEL: Record<SupportAudience, string> = {
  PARTNER: '파트너용',
  CUSTOMER: '고객용',
};

export const SUPPORT_AUDIENCE_DESCRIPTION: Record<SupportAudience, string> = {
  PARTNER: '로그인한 파트너 화면의 FAQ·공지사항 메뉴에 노출됩니다.',
  CUSTOMER: '로그인 없이 보는 공개 화면(홈의 자주 묻는 질문, 공지사항)에 노출됩니다.',
};

/** 주소의 ?audience= 값을 읽는다 — 없거나 틀리면 파트너용. */
export const parseSupportAudience = (value: string | null): SupportAudience =>
  value === 'CUSTOMER' ? 'CUSTOMER' : 'PARTNER';
