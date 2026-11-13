import { useEffect, useState } from 'react';
import type { FC, FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Inbox } from 'lucide-react';
import { ListContainer } from '../components/ListContainer';
import { Modal } from '../components/Modal';
import { SearchBar, SearchField } from '../components/SearchBar';
import { usePermissionStore } from '../store/usePermissionStore';
import { useSnackbarStore } from '../store/useSnackbarStore';
import { api } from '../utils/api';
import { formatDateTime } from '../utils/internationalization';
import { Field, FormActions } from './billingCatalog/components';
import { inputClass } from './billingCatalog/constants';
import {
  CONTACT_INQUIRY_STATUS_BADGE_CLASS,
  CONTACT_INQUIRY_STATUS_LABEL,
  CONTACT_INQUIRY_TYPE_LABEL,
} from './public/contactInquiryLabels';
import type { ContactInquiry, ContactInquiryStatus, PageResponse } from '../types';

const ENDPOINT = '/platform-admin/contact-inquiries';
const PAGE_SIZE = 20;
const STATUSES: ContactInquiryStatus[] = ['RECEIVED', 'IN_PROGRESS', 'DONE'];

interface SearchValues {
  status: ContactInquiryStatus | 'ALL';
  keyword: string;
}

const EMPTY_SEARCH: SearchValues = { status: 'ALL', keyword: '' };

/**
 * 고객 문의(플랫폼 관리자, 2026-11-13) — 공개 화면 "문의하기"로 들어온 문의. 답변은 전화·메일로 하고, 여기서는 처리 상태와
 * 내부 메모만 기록한다(고객에게 따로 알리지 않는다). 새 문의 알림을 누르면 `?inquiryId=`로 그 문의가 바로 열린다.
 */
export const AdminContactInquiries: FC = () => {
  const canManage = usePermissionStore((state) => state.hasPermission('ACTION_CONTACT_INQUIRY_MANAGE'));
  const showSnackbar = useSnackbarStore((state) => state.showSnackbar);
  const [urlParams, setUrlParams] = useSearchParams();

  const [formValues, setFormValues] = useState<SearchValues>(EMPTY_SEARCH);
  const [searchParams, setSearchParams] = useState<SearchValues>(EMPTY_SEARCH);
  const [page, setPage] = useState(0);
  const [pageData, setPageData] = useState<PageResponse<ContactInquiry> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selected, setSelected] = useState<ContactInquiry | null>(null);

  const fetchInquiries = async () => {
    const query = new URLSearchParams();
    if (searchParams.status !== 'ALL') query.set('status', searchParams.status);
    if (searchParams.keyword.trim()) query.set('keyword', searchParams.keyword.trim());
    query.set('page', String(page));
    query.set('size', String(PAGE_SIZE));
    const response = await api.get(`${ENDPOINT}?${query.toString()}`);
    return response.data as PageResponse<ContactInquiry>;
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchInquiries();
        if (!cancelled) setPageData(data);
      } catch (err) {
        if (!cancelled) showSnackbar(err instanceof Error ? err.message : '고객 문의를 불러오지 못했습니다.', 'error');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, page]);

  // 알림에서 들어오면 그 문의를 바로 연다.
  const linkedInquiryId = urlParams.get('inquiryId');
  useEffect(() => {
    if (!linkedInquiryId) return;
    let cancelled = false;
    api.get(`${ENDPOINT}/${linkedInquiryId}`)
      .then((response) => {
        if (!cancelled) setSelected(response.data as ContactInquiry);
      })
      .catch((err) => {
        if (!cancelled) showSnackbar(err instanceof Error ? err.message : '문의를 불러오지 못했습니다.', 'error');
      });
    return () => {
      cancelled = true;
    };
  }, [linkedInquiryId, showSnackbar]);

  const closeDetail = () => {
    setSelected(null);
    if (linkedInquiryId) setUrlParams({}, { replace: true });
  };

  const handleSearch = (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setPage(0);
    setSearchParams({ ...formValues });
  };

  const handleReset = () => {
    setIsLoading(true);
    setFormValues(EMPTY_SEARCH);
    setPage(0);
    setSearchParams({ ...EMPTY_SEARCH });
  };

  const handleSaved = async () => {
    closeDetail();
    setPageData(await fetchInquiries());
  };

  const inquiries = pageData?.content ?? [];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-950 flex items-center gap-2">
          <Inbox size={20} className="text-gray-400" />
          고객 문의
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          공개 화면 "문의하기"로 접수된 문의입니다. 답변은 전화·메일로 하고, 여기에는 처리 상태와 내부 메모를 남깁니다.
        </p>
      </div>

      <SearchBar onSubmit={handleSearch} onReset={handleReset}>
        <SearchField label="처리 상태">
          <select
            value={formValues.status}
            onChange={(e) => setFormValues((prev) => ({ ...prev, status: e.target.value as SearchValues['status'] }))}
            className="px-3 py-1.5 border border-gray-200 rounded-md text-sm bg-white focus:ring-2 focus:ring-gray-950/10 focus:border-gray-400 outline-none"
          >
            <option value="ALL">전체</option>
            {STATUSES.map((status) => (
              <option key={status} value={status}>{CONTACT_INQUIRY_STATUS_LABEL[status]}</option>
            ))}
          </select>
        </SearchField>
        <SearchField label="검색어" className="w-64">
          <input
            value={formValues.keyword}
            onChange={(e) => setFormValues((prev) => ({ ...prev, keyword: e.target.value }))}
            placeholder="회사명, 담당자, 이메일 또는 내용"
            className="w-full px-3 py-1.5 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-gray-950/10 focus:border-gray-400 outline-none"
          />
        </SearchField>
      </SearchBar>

      <ListContainer
        isLoading={isLoading}
        isEmpty={inquiries.length === 0}
        emptyMessage="해당 조건의 고객 문의가 없습니다."
        pagination={
          pageData
            ? {
                page: pageData.page,
                totalPages: pageData.totalPages,
                hasNext: pageData.hasNext,
                totalElements: pageData.totalElements,
                onPageChange: (nextPage) => {
                  setIsLoading(true);
                  setPage(nextPage);
                },
              }
            : undefined
        }
      >
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-3 font-medium whitespace-nowrap">접수일시</th>
              <th className="text-left px-4 py-3 font-medium">유형</th>
              <th className="text-left px-4 py-3 font-medium">회사·담당자</th>
              <th className="text-left px-4 py-3 font-medium">연락처</th>
              <th className="text-left px-4 py-3 font-medium whitespace-nowrap">행사 예정일</th>
              <th className="text-left px-4 py-3 font-medium">상태</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {inquiries.map((inquiry) => (
              <tr key={inquiry.id} onClick={() => setSelected(inquiry)} className="cursor-pointer hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{formatDateTime(inquiry.createdAt)}</td>
                <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{CONTACT_INQUIRY_TYPE_LABEL[inquiry.inquiryType]}</td>
                <td className="px-4 py-3">
                  <p className="font-medium text-gray-950">{inquiry.companyName}</p>
                  <p className="text-xs text-gray-500">{inquiry.contactName}</p>
                </td>
                <td className="px-4 py-3 text-gray-600">
                  <p>{inquiry.email}</p>
                  {inquiry.phone && <p className="text-xs text-gray-500">{inquiry.phone}</p>}
                </td>
                <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{inquiry.eventDate ?? '-'}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${CONTACT_INQUIRY_STATUS_BADGE_CLASS[inquiry.status]}`}>
                    {CONTACT_INQUIRY_STATUS_LABEL[inquiry.status]}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </ListContainer>

      <Modal open={selected !== null} onClose={closeDetail} title="고객 문의" widthClassName="max-w-2xl">
        {selected && <InquiryDetail key={selected.id} inquiry={selected} canManage={canManage} onCancel={closeDetail} onSaved={handleSaved} />}
      </Modal>
    </div>
  );
};

const InquiryDetail: FC<{
  inquiry: ContactInquiry;
  canManage: boolean;
  onCancel: () => void;
  onSaved: () => Promise<void>;
}> = ({ inquiry, canManage, onCancel, onSaved }) => {
  const showSnackbar = useSnackbarStore((state) => state.showSnackbar);
  const [status, setStatus] = useState<ContactInquiryStatus>(inquiry.status);
  const [adminMemo, setAdminMemo] = useState(inquiry.adminMemo ?? '');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await api.put(`${ENDPOINT}/${inquiry.id}`, { status, adminMemo: adminMemo.trim() || null });
      showSnackbar('처리 내용을 저장했습니다.', 'success');
      await onSaved();
    } catch (err) {
      showSnackbar(err instanceof Error ? err.message : '저장에 실패했습니다.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const rows: Array<[string, string]> = [
    ['접수일시', formatDateTime(inquiry.createdAt)],
    ['유형', CONTACT_INQUIRY_TYPE_LABEL[inquiry.inquiryType]],
    ['회사·기관명', inquiry.companyName],
    ['담당자', inquiry.contactName],
    ['이메일', inquiry.email],
    ['연락처', inquiry.phone ?? '-'],
    ['행사 예정일', inquiry.eventDate ?? '-'],
    ['예상 서명자 수', inquiry.expectedSigners !== null ? `${inquiry.expectedSigners.toLocaleString()}명` : '-'],
  ];

  return (
    <div className="space-y-5">
      <dl className="grid grid-cols-[7rem_1fr] gap-y-2 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-gray-500">{label}</dt>
            <dd className="text-gray-950 break-all">{value}</dd>
          </div>
        ))}
      </dl>
      <div>
        <p className="text-xs font-medium text-gray-500 mb-1">문의 내용</p>
        <p className="rounded-md bg-gray-50 p-3 text-sm text-gray-950 whitespace-pre-line">{inquiry.message}</p>
      </div>

      <form onSubmit={handleSave} className="space-y-3 border-t border-gray-100 pt-4">
        <Field label="처리 상태">
          <select value={status} onChange={(e) => setStatus(e.target.value as ContactInquiryStatus)}
            disabled={!canManage || isSaving} className={inputClass}>
            {STATUSES.map((value) => (
              <option key={value} value={value}>{CONTACT_INQUIRY_STATUS_LABEL[value]}</option>
            ))}
          </select>
        </Field>
        <Field label="내부 메모(고객에게 보이지 않음)">
          <textarea value={adminMemo} onChange={(e) => setAdminMemo(e.target.value)} disabled={!canManage || isSaving}
            rows={3} maxLength={1000} placeholder="예) 11/14 통화, 다음 주 견적 발송 예정" className={`${inputClass} resize-y`} />
        </Field>
        {inquiry.handledAt && <p className="text-xs text-gray-400">마지막 처리 기록 {formatDateTime(inquiry.handledAt)}</p>}
        {canManage ? (
          <FormActions isSaving={isSaving} savingLabel="저장 중..." saveLabel="저장" onCancel={onCancel} />
        ) : (
          <p className="text-xs text-gray-400">처리 기록 권한이 없어 조회만 할 수 있습니다.</p>
        )}
      </form>
    </div>
  );
};
