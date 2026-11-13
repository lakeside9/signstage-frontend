import type { ContactInquiryStatus, ContactInquiryType } from '../../types';

/** 고객 문의 유형 — 공개 문의하기 화면과 관리자 고객 문의 화면이 같이 쓴다. */
export const CONTACT_INQUIRY_TYPE_LABEL: Record<ContactInquiryType, string> = {
  INTRODUCTION: '도입 상담',
  PRICING: '요금·견적',
  ONSITE_SUPPORT: '현장 지원',
  OTHER: '기타',
};

export const CONTACT_INQUIRY_STATUS_LABEL: Record<ContactInquiryStatus, string> = {
  RECEIVED: '접수',
  IN_PROGRESS: '상담 중',
  DONE: '처리 완료',
};

export const CONTACT_INQUIRY_STATUS_BADGE_CLASS: Record<ContactInquiryStatus, string> = {
  RECEIVED: 'bg-amber-50 text-amber-700 border-amber-200',
  IN_PROGRESS: 'bg-blue-50 text-blue-700 border-blue-200',
  DONE: 'bg-gray-100 text-gray-500 border-gray-200',
};
