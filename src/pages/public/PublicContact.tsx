import { useState } from 'react';
import type { FC, FormEvent, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Loader2, Send } from 'lucide-react';
import { useSnackbarStore } from '../../store/useSnackbarStore';
import { api } from '../../utils/api';
import { CONTACT_INQUIRY_TYPE_LABEL } from './contactInquiryLabels';
import type { ContactInquiryType, SubmitContactInquiryRequest } from '../../types';

interface ContactDraft {
  inquiryType: ContactInquiryType;
  companyName: string;
  contactName: string;
  email: string;
  phone: string;
  eventDate: string;
  expectedSigners: string;
  message: string;
  privacyConsented: boolean;
  /** 사람에게는 보이지 않는 칸 — 봇이 채우면 서버가 저장하지 않는다. */
  website: string;
}

const emptyDraft = (): ContactDraft => ({
  inquiryType: 'INTRODUCTION',
  companyName: '',
  contactName: '',
  email: '',
  phone: '',
  eventDate: '',
  expectedSigners: '',
  message: '',
  privacyConsented: false,
  website: '',
});

const inputClass =
  'w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-950 placeholder:text-gray-400 focus:border-gray-950 focus:outline-none focus:ring-1 focus:ring-gray-950 disabled:bg-gray-50';

/**
 * 고객 문의하기(공개, `/contact`, 2026-11-13) — 로그인 없이 도입·요금·현장 지원을 문의한다. 접수하면 플랫폼 담당자에게
 * 알림이 가고, 담당자가 전화·메일로 연락한다. 같은 접속 주소에서 10분에 5건까지 받는다.
 */
export const PublicContact: FC = () => {
  const showSnackbar = useSnackbarStore((state) => state.showSnackbar);
  const [draft, setDraft] = useState<ContactDraft>(emptyDraft);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const update = <K extends keyof ContactDraft>(key: K, value: ContactDraft[K]) =>
    setDraft((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!draft.companyName.trim() || !draft.contactName.trim() || !draft.email.trim() || !draft.message.trim()) {
      showSnackbar('필수 항목을 입력해주세요.', 'error');
      return;
    }
    if (!draft.privacyConsented) {
      showSnackbar('개인정보 수집·이용에 동의해주세요.', 'error');
      return;
    }
    const request: SubmitContactInquiryRequest = {
      inquiryType: draft.inquiryType,
      companyName: draft.companyName.trim(),
      contactName: draft.contactName.trim(),
      email: draft.email.trim(),
      phone: draft.phone.trim() || null,
      eventDate: draft.eventDate || null,
      expectedSigners: draft.expectedSigners ? Number(draft.expectedSigners) : null,
      message: draft.message.trim(),
      privacyConsented: draft.privacyConsented,
      website: draft.website || null,
    };
    setIsSubmitting(true);
    try {
      await api.post('/public/contact-inquiries', request);
      setIsSubmitted(true);
    } catch (err) {
      showSnackbar(err instanceof Error ? err.message : '문의 접수에 실패했습니다. 잠시 후 다시 시도해주세요.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className="mx-auto max-w-xl px-4 sm:px-8 py-24 text-center">
        <CheckCircle2 size={48} className="mx-auto text-emerald-600" />
        <h1 className="mt-5 text-2xl font-bold text-gray-950">문의가 접수되었습니다</h1>
        <p className="mt-3 text-sm text-gray-500">
          담당자가 확인한 뒤 남겨주신 연락처로 안내해 드립니다. 영업일 기준 1~2일 정도 걸릴 수 있습니다.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link
            to="/"
            className="inline-flex items-center bg-gray-950 hover:bg-gray-800 text-white font-bold px-5 py-2.5 rounded-lg transition-colors shadow-sm text-sm"
          >
            홈으로
          </Link>
          <button
            type="button"
            onClick={() => {
              setDraft(emptyDraft());
              setIsSubmitted(false);
            }}
            className="inline-flex items-center bg-white hover:bg-gray-100 text-gray-950 font-bold px-5 py-2.5 rounded-lg transition-colors shadow-sm border border-gray-200 text-sm"
          >
            다른 문의 남기기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-gray-50">
      <div className="mx-auto max-w-3xl px-4 sm:px-8 py-14 sm:py-20">
        <div className="text-center">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-950">문의하기</h1>
          <p className="mt-3 text-sm sm:text-base text-gray-500">
            행사 일정과 규모를 알려주시면 담당자가 진행 방식과 견적을 안내해 드립니다.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-10 space-y-5 rounded-lg border border-gray-200 bg-white p-6 sm:p-8 shadow-sm">
          <FormField label="문의 유형" required>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(CONTACT_INQUIRY_TYPE_LABEL) as ContactInquiryType[]).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => update('inquiryType', type)}
                  disabled={isSubmitting}
                  aria-pressed={draft.inquiryType === type}
                  className={`rounded-full border px-4 py-1.5 text-sm transition-colors ${
                    draft.inquiryType === type
                      ? 'border-gray-950 bg-gray-950 text-white'
                      : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {CONTACT_INQUIRY_TYPE_LABEL[type]}
                </button>
              ))}
            </div>
          </FormField>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <FormField label="회사·기관명" required>
              <input value={draft.companyName} onChange={(e) => update('companyName', e.target.value)} disabled={isSubmitting}
                maxLength={100} placeholder="예) 싸인스테이지 주식회사" className={inputClass} />
            </FormField>
            <FormField label="담당자" required>
              <input value={draft.contactName} onChange={(e) => update('contactName', e.target.value)} disabled={isSubmitting}
                maxLength={50} placeholder="이름" className={inputClass} />
            </FormField>
            <FormField label="이메일" required>
              <input type="email" value={draft.email} onChange={(e) => update('email', e.target.value)} disabled={isSubmitting}
                maxLength={200} placeholder="name@company.com" className={inputClass} />
            </FormField>
            <FormField label="연락처">
              <input type="tel" value={draft.phone} onChange={(e) => update('phone', e.target.value)} disabled={isSubmitting}
                maxLength={50} placeholder="010-0000-0000" className={inputClass} />
            </FormField>
            <FormField label="행사 예정일">
              <input type="date" value={draft.eventDate} onChange={(e) => update('eventDate', e.target.value)} disabled={isSubmitting}
                className={inputClass} />
            </FormField>
            <FormField label="예상 서명자 수">
              <input type="number" min={1} max={100000} value={draft.expectedSigners}
                onChange={(e) => update('expectedSigners', e.target.value)} disabled={isSubmitting} placeholder="예) 10" className={inputClass} />
            </FormField>
          </div>

          <FormField label="문의 내용" required>
            <textarea value={draft.message} onChange={(e) => update('message', e.target.value)} disabled={isSubmitting}
              rows={6} maxLength={2000} placeholder="행사 성격, 장소, 필요한 장비·현장 지원 등 알려주실 내용을 적어주세요."
              className={`${inputClass} resize-y`} />
            <p className="mt-1 text-right text-xs text-gray-400">{draft.message.length.toLocaleString()} / 2,000</p>
          </FormField>

          {/* 봇 걸러내기용 숨은 칸 — 화면과 보조기기 모두에서 숨긴다. */}
          <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
            <label>
              웹사이트
              <input tabIndex={-1} autoComplete="off" value={draft.website} onChange={(e) => update('website', e.target.value)} />
            </label>
          </div>

          <div className="rounded-lg bg-gray-50 p-4 text-xs leading-relaxed text-gray-500">
            <p className="font-bold text-gray-700">개인정보 수집·이용 안내</p>
            <ul className="mt-2 list-disc space-y-0.5 pl-4">
              <li>수집 항목: 회사·기관명, 담당자 이름, 이메일, 연락처(선택), 접속 주소</li>
              <li>이용 목적: 문의 확인과 답변, 상담 안내</li>
              <li>보유 기간: 문의 처리 완료 후 1년, 이후 파기</li>
            </ul>
            <p className="mt-2">동의하지 않을 수 있으며, 동의하지 않으면 문의를 접수할 수 없습니다.</p>
            <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm text-gray-950">
              <input type="checkbox" checked={draft.privacyConsented} onChange={(e) => update('privacyConsented', e.target.checked)}
                disabled={isSubmitting} className="h-4 w-4 rounded border-gray-300" />
              개인정보 수집·이용에 동의합니다. <span className="text-red-500">(필수)</span>
            </label>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="flex w-full items-center justify-center gap-1.5 bg-gray-950 hover:bg-gray-800 disabled:bg-gray-400 text-white font-bold px-6 py-3 rounded-lg transition-colors shadow-sm text-sm"
          >
            {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            {isSubmitting ? '접수 중...' : '문의 보내기'}
          </button>
        </form>
      </div>
    </div>
  );
};

const FormField: FC<{ label: string; required?: boolean; children: ReactNode }> = ({ label, required, children }) => (
  <div>
    <label className="mb-1.5 block text-sm font-medium text-gray-700">
      {label}
      {required && <span className="ml-0.5 text-red-500">*</span>}
    </label>
    {children}
  </div>
);
