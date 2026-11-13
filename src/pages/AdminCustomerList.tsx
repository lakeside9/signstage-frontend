import { useEffect, useState } from 'react';
import type { FC, FormEvent } from 'react';
import { Contact, Pencil, Plus } from 'lucide-react';
import { Button } from '../components/Button';
import { ListContainer } from '../components/ListContainer';
import { Modal } from '../components/Modal';
import { SearchBar, SearchField } from '../components/SearchBar';
import { usePermissionStore } from '../store/usePermissionStore';
import { useSnackbarStore } from '../store/useSnackbarStore';
import { api } from '../utils/api';
import { Field, FormActions } from './billingCatalog/components';
import { inputClass } from './billingCatalog/constants';
import { CUSTOMER_STATUS_LABEL, blankToNull, statusBadgeClass } from './order/constants';
import type { AdminCustomer, CustomerStatus, PageResponse, SaveCustomerRequest } from '../types';

const PAGE_SIZE = 20;

interface SearchValues {
  keyword: string;
  status: 'ALL' | CustomerStatus;
}

const EMPTY_SEARCH: SearchValues = { keyword: '', status: 'ALL' };

type CustomerDraft = Record<keyof SaveCustomerRequest, string>;

const EMPTY_DRAFT: CustomerDraft = {
  name: '', businessRegistrationNumber: '', representativeName: '', contactName: '', contactPhone: '',
  contactEmail: '', taxInvoiceEmail: '', address: '', memo: '',
};

const toDraft = (customer: AdminCustomer): CustomerDraft => ({
  name: customer.name,
  businessRegistrationNumber: customer.businessRegistrationNumber ?? '',
  representativeName: customer.representativeName ?? '',
  contactName: customer.contactName ?? '',
  contactPhone: customer.contactPhone ?? '',
  contactEmail: customer.contactEmail ?? '',
  taxInvoiceEmail: customer.taxInvoiceEmail ?? '',
  address: customer.address ?? '',
  memo: customer.memo ?? '',
});

const toRequest = (draft: CustomerDraft): SaveCustomerRequest => ({
  name: draft.name.trim(),
  businessRegistrationNumber: blankToNull(draft.businessRegistrationNumber),
  representativeName: blankToNull(draft.representativeName),
  contactName: blankToNull(draft.contactName),
  contactPhone: blankToNull(draft.contactPhone),
  contactEmail: blankToNull(draft.contactEmail),
  taxInvoiceEmail: blankToNull(draft.taxInvoiceEmail),
  address: blankToNull(draft.address),
  memo: blankToNull(draft.memo),
});

/**
 * 고객 관리(플랫폼 관리자) — 플랫폼이 계약하는 실고객(signstage-docs
 * business/platform-order-partner-subcontract-review.md D02). 수주는 이 고객을 골라 만든다.
 * 등록·수정은 한 팝업 폼으로 처리하고, 중지한 고객은 새 수주에 고를 수 없다.
 */
export const AdminCustomerList: FC = () => {
  const canManage = usePermissionStore((state) => state.hasPermission('ACTION_CUSTOMER_MANAGE'));
  const showSnackbar = useSnackbarStore((state) => state.showSnackbar);

  const [formValues, setFormValues] = useState<SearchValues>(EMPTY_SEARCH);
  const [searchParams, setSearchParams] = useState<SearchValues>(EMPTY_SEARCH);
  const [page, setPage] = useState(0);
  const [pageData, setPageData] = useState<PageResponse<AdminCustomer> | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [editingCustomer, setEditingCustomer] = useState<AdminCustomer | 'new' | null>(null);
  const [draft, setDraft] = useState<CustomerDraft>(EMPTY_DRAFT);
  const [isSaving, setIsSaving] = useState(false);

  const fetchCustomers = async () => {
    const query = new URLSearchParams();
    if (searchParams.keyword.trim()) query.set('keyword', searchParams.keyword.trim());
    if (searchParams.status !== 'ALL') query.set('status', searchParams.status);
    query.set('page', String(page));
    query.set('size', String(PAGE_SIZE));
    const response = await api.get(`/platform-admin/customers?${query.toString()}`);
    return response.data as PageResponse<AdminCustomer>;
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchCustomers();
        if (!cancelled) setPageData(data);
      } catch (err) {
        if (!cancelled) showSnackbar(err instanceof Error ? err.message : '고객 목록을 불러오지 못했습니다.', 'error');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, page]);

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

  const openForm = (customer: AdminCustomer | 'new') => {
    setDraft(customer === 'new' ? EMPTY_DRAFT : toDraft(customer));
    setEditingCustomer(customer);
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!draft.name.trim()) {
      showSnackbar('고객명을 입력해주세요.', 'error');
      return;
    }
    setIsSaving(true);
    try {
      if (editingCustomer === 'new') {
        await api.post('/platform-admin/customers', toRequest(draft));
        showSnackbar('고객을 등록했습니다.', 'success');
      } else if (editingCustomer) {
        await api.put(`/platform-admin/customers/${editingCustomer.id}`, toRequest(draft));
        showSnackbar('고객 정보를 수정했습니다.', 'success');
      }
      setEditingCustomer(null);
      setPageData(await fetchCustomers());
    } catch (err) {
      showSnackbar(err instanceof Error ? err.message : '저장에 실패했습니다.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleStatus = async (customer: AdminCustomer) => {
    const status: CustomerStatus = customer.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      await api.put(`/platform-admin/customers/${customer.id}/status`, { status });
      showSnackbar(status === 'ACTIVE' ? '거래를 재개했습니다.' : '거래를 중지했습니다.', 'success');
      setPageData(await fetchCustomers());
    } catch (err) {
      showSnackbar(err instanceof Error ? err.message : '상태 변경에 실패했습니다.', 'error');
    }
  };

  const customers = pageData?.content ?? [];
  const setDraftField = (field: keyof CustomerDraft) => (value: string) =>
    setDraft((prev) => ({ ...prev, [field]: value }));

  const textField = (field: keyof CustomerDraft, label: string, placeholder = '선택 입력', type = 'text') => (
    <Field label={label}>
      <input
        type={type}
        value={draft[field]}
        onChange={(e) => setDraftField(field)(e.target.value)}
        disabled={isSaving}
        placeholder={placeholder}
        className={inputClass}
      />
    </Field>
  );

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-950 flex items-center gap-2">
            <Contact size={20} className="text-gray-400" />
            고객 관리
          </h1>
          <p className="mt-1 text-sm text-gray-500">플랫폼이 직접 계약하는 고객입니다. 수주를 만들 때 고객을 고릅니다.</p>
        </div>
        {canManage && (
          <Button onClick={() => openForm('new')}>
            <Plus size={16} /> 고객 등록
          </Button>
        )}
      </div>

      <SearchBar onSubmit={handleSearch} onReset={handleReset}>
        <SearchField label="검색어" className="w-56">
          <input
            value={formValues.keyword}
            onChange={(e) => setFormValues((prev) => ({ ...prev, keyword: e.target.value }))}
            placeholder="상호 또는 사업자번호"
            className={inputClass}
          />
        </SearchField>
        <SearchField label="상태">
          <select
            value={formValues.status}
            onChange={(e) => setFormValues((prev) => ({ ...prev, status: e.target.value as SearchValues['status'] }))}
            className={`${inputClass} bg-white`}
          >
            <option value="ALL">전체</option>
            <option value="ACTIVE">거래중</option>
            <option value="INACTIVE">중지</option>
          </select>
        </SearchField>
      </SearchBar>

      <ListContainer
        isLoading={isLoading}
        isEmpty={customers.length === 0}
        emptyMessage="등록된 고객이 없습니다."
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
              <th className="text-left px-4 py-3 font-medium">고객명</th>
              <th className="text-left px-4 py-3 font-medium">사업자번호</th>
              <th className="text-left px-4 py-3 font-medium">담당자</th>
              <th className="text-left px-4 py-3 font-medium">연락처</th>
              <th className="text-left px-4 py-3 font-medium">상태</th>
              <th className="text-right px-4 py-3 font-medium">처리</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {customers.map((customer) => (
              <tr key={customer.id}>
                <td className="px-4 py-3 text-gray-950 font-medium">{customer.name}</td>
                <td className="px-4 py-3 text-gray-500">{customer.businessRegistrationNumber ?? '-'}</td>
                <td className="px-4 py-3 text-gray-500">{customer.contactName ?? '-'}</td>
                <td className="px-4 py-3 text-gray-500">
                  {[customer.contactPhone, customer.contactEmail].filter(Boolean).join(' · ') || '-'}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`${statusBadgeClass} ${
                      customer.status === 'ACTIVE'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-gray-50 text-gray-500 border-gray-200'
                    }`}
                  >
                    {CUSTOMER_STATUS_LABEL[customer.status]}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {canManage && (
                    <div className="flex justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => openForm(customer)}
                        className="px-2 py-1 text-xs font-medium rounded-md inline-flex items-center gap-1 text-gray-500 hover:text-gray-950 hover:bg-gray-50"
                      >
                        <Pencil size={12} /> 수정
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(customer)}
                        className="px-2 py-1 text-xs font-medium rounded-md inline-flex items-center gap-1 text-gray-500 hover:text-gray-950 hover:bg-gray-50"
                      >
                        {customer.status === 'ACTIVE' ? '거래 중지' : '거래 재개'}
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </ListContainer>

      <Modal
        open={editingCustomer !== null}
        onClose={() => setEditingCustomer(null)}
        title={editingCustomer === 'new' ? '고객 등록' : '고객 정보 수정'}
        widthClassName="max-w-2xl"
      >
        <form onSubmit={handleSave} className="space-y-3">
          {textField('name', '고객명', '필수')}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {textField('businessRegistrationNumber', '사업자등록번호')}
            {textField('representativeName', '대표자')}
            {textField('contactName', '담당자')}
            {textField('contactPhone', '담당자 연락처')}
            {textField('contactEmail', '담당자 이메일', '선택 입력', 'email')}
            {textField('taxInvoiceEmail', '세금계산서 이메일', '선택 입력', 'email')}
          </div>
          {textField('address', '주소')}
          <Field label="메모">
            <textarea
              value={draft.memo}
              onChange={(e) => setDraftField('memo')(e.target.value)}
              disabled={isSaving}
              rows={3}
              className={inputClass}
            />
          </Field>
          <FormActions isSaving={isSaving} savingLabel="저장 중..." saveLabel="저장" onCancel={() => setEditingCustomer(null)} />
        </form>
      </Modal>
    </div>
  );
};
