import { useCallback, useEffect, useState } from 'react';
import type { FC, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ClipboardCheck } from 'lucide-react';
import { Button } from '../components/Button';
import { FormattedNumberInput } from '../components/FormattedNumberInput';
import { ListContainer } from '../components/ListContainer';
import { Modal } from '../components/Modal';
import { SearchBar, SearchField } from '../components/SearchBar';
import { usePermissionStore } from '../store/usePermissionStore';
import { useSnackbarStore } from '../store/useSnackbarStore';
import { api } from '../utils/api';
import { formatDateTime } from '../utils/internationalization';
import { Field, FormActions } from './billingCatalog/components';
import { inputClass } from './billingCatalog/constants';
import { InspectionStatusBadge } from './order/components';
import { INSPECTION_STATUS_LABEL, blankToNull, formatMoney, formatSchedule } from './order/constants';
import type { InspectionStatus, OrderInspectionSummary, PageResponse } from '../types';

const PAGE_SIZE = 20;

interface ApproveDraft {
  defectNote: string;
  delayNote: string;
  deductionAmount: string;
  deductionReason: string;
}

const EMPTY_DRAFT: ApproveDraft = { defectNote: '', delayNote: '', deductionAmount: '', deductionReason: '' };

/**
 * 검수(플랫폼 관리자) — signstage-docs business/platform-order-partner-subcontract-review.md D11·D13.
 * 파트너가 수행한 행사가 완료되면 검수 대기 건이 생긴다. 기한(완료일 + 7일) 안에 하자·지체를 적고
 * 감액해 승인하며, 기한이 지나면 감액 없이 승인으로 본다. 승인된 금액은 승인월에 월 합산 지급된다.
 */
export const AdminOrderInspectionList: FC = () => {
  const canInspect = usePermissionStore((state) => state.hasPermission('ACTION_ORDER_INSPECTION'));
  const showSnackbar = useSnackbarStore((state) => state.showSnackbar);

  const [statusFilter, setStatusFilter] = useState<'ALL' | InspectionStatus>('PENDING');
  const [appliedStatus, setAppliedStatus] = useState<'ALL' | InspectionStatus>('PENDING');
  const [page, setPage] = useState(0);
  const [pageData, setPageData] = useState<PageResponse<OrderInspectionSummary> | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [target, setTarget] = useState<OrderInspectionSummary | null>(null);
  const [draft, setDraft] = useState<ApproveDraft>(EMPTY_DRAFT);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchPage = useCallback(async () => {
    const query = new URLSearchParams();
    if (appliedStatus !== 'ALL') query.set('status', appliedStatus);
    query.set('page', String(page));
    query.set('size', String(PAGE_SIZE));
    query.set('sort', 'dueDate,asc');
    const response = await api.get(`/platform-admin/order-inspections?${query.toString()}`);
    return response.data as PageResponse<OrderInspectionSummary>;
  }, [appliedStatus, page]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchPage();
        if (!cancelled) setPageData(data);
      } catch (err) {
        if (!cancelled) showSnackbar(err instanceof Error ? err.message : '검수 목록을 불러오지 못했습니다.', 'error');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchPage, showSnackbar]);

  const handleSearch = (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setPage(0);
    setAppliedStatus(statusFilter);
  };

  const handleReset = () => {
    setIsLoading(true);
    setStatusFilter('PENDING');
    setPage(0);
    setAppliedStatus('PENDING');
  };

  const openApprove = (inspection: OrderInspectionSummary) => {
    setDraft(EMPTY_DRAFT);
    setTarget(inspection);
  };

  const deduction = Number(draft.deductionAmount || 0);

  const handleApprove = async (e: FormEvent) => {
    e.preventDefault();
    if (!target) return;
    if (Number.isNaN(deduction) || deduction < 0 || deduction > target.orderAmount) {
      showSnackbar('감액은 0 이상, 발주 금액 이하여야 합니다.', 'error');
      return;
    }
    if (deduction > 0 && !draft.deductionReason.trim()) {
      showSnackbar('감액 사유를 입력해주세요.', 'error');
      return;
    }
    setIsSubmitting(true);
    try {
      await api.post(`/platform-admin/order-inspections/${target.id}/approve`, {
        defectNote: blankToNull(draft.defectNote),
        delayNote: blankToNull(draft.delayNote),
        deductionAmount: deduction,
        deductionReason: deduction > 0 ? draft.deductionReason.trim() : null,
      });
      showSnackbar('검수를 승인했습니다.', 'success');
      setTarget(null);
      setPageData(await fetchPage());
    } catch (err) {
      showSnackbar(err instanceof Error ? err.message : '검수 승인에 실패했습니다.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const inspections = pageData?.content ?? [];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-950 flex items-center gap-2">
          <ClipboardCheck size={20} className="text-gray-400" />
          검수
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          행사가 끝난 발주를 검수합니다. 기한(행사 완료일 + 7일)이 지나면 감액 없이 승인으로 처리됩니다.
        </p>
      </div>

      <SearchBar onSubmit={handleSearch} onReset={handleReset}>
        <SearchField label="상태">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'ALL' | InspectionStatus)}
            className={`${inputClass} bg-white`}
          >
            <option value="ALL">전체</option>
            {Object.entries(INSPECTION_STATUS_LABEL).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </SearchField>
      </SearchBar>

      <ListContainer
        isLoading={isLoading}
        isEmpty={inspections.length === 0}
        emptyMessage="검수 건이 없습니다."
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
              <th className="text-left px-4 py-3 font-medium">행사</th>
              <th className="text-left px-4 py-3 font-medium">파트너</th>
              <th className="text-left px-4 py-3 font-medium">완료</th>
              <th className="text-left px-4 py-3 font-medium">검수 기한</th>
              <th className="text-right px-4 py-3 font-medium">발주 금액</th>
              <th className="text-right px-4 py-3 font-medium">지급 대상</th>
              <th className="text-left px-4 py-3 font-medium">상태</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {inspections.map((inspection) => (
              <tr key={inspection.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <Link to={`/admin/sales-orders/${inspection.salesOrderId}`} className="text-gray-950 font-medium hover:underline">
                    {inspection.title}
                  </Link>
                  <p className="text-xs text-gray-400">{formatSchedule(inspection.startsAt, inspection.endsAt)}</p>
                </td>
                <td className="px-4 py-3 text-gray-500">{inspection.organizationName}</td>
                <td className="px-4 py-3 text-gray-500">{formatDateTime(inspection.ceremonyCompletedAt)}</td>
                <td className="px-4 py-3 text-gray-500">{inspection.dueDate}</td>
                <td className="px-4 py-3 text-right tabular-nums">{formatMoney(inspection.orderAmount, inspection.currencyCode)}</td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {formatMoney(inspection.payableAmount, inspection.currencyCode)}
                  {inspection.deductionAmount > 0 && (
                    <p className="text-xs text-gray-400">감액 {formatMoney(inspection.deductionAmount, inspection.currencyCode)}</p>
                  )}
                </td>
                <td className="px-4 py-3">
                  <InspectionStatusBadge status={inspection.status} overdue={inspection.overdue} />
                  {inspection.approvalType === 'DEEMED' && <p className="text-xs text-gray-400">승인 간주</p>}
                </td>
                <td className="px-4 py-3 text-right">
                  {canInspect && inspection.status === 'PENDING' && !inspection.overdue && (
                    <Button size="sm" onClick={() => openApprove(inspection)}>검수 승인</Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </ListContainer>

      <Modal open={target !== null} onClose={() => setTarget(null)} title="검수 승인">
        {target && (
          <form onSubmit={handleApprove} className="space-y-3">
            <p className="text-sm text-gray-700">
              {target.title} · {target.organizationName} · 발주 금액 {formatMoney(target.orderAmount, target.currencyCode)}
            </p>
            <Field label="하자 내용(선택)">
              <textarea
                value={draft.defectNote}
                onChange={(e) => setDraft({ ...draft, defectNote: e.target.value })}
                maxLength={1000}
                rows={2}
                disabled={isSubmitting}
                className={inputClass}
              />
            </Field>
            <Field label="지체 내용(선택)">
              <textarea
                value={draft.delayNote}
                onChange={(e) => setDraft({ ...draft, delayNote: e.target.value })}
                maxLength={1000}
                rows={2}
                disabled={isSubmitting}
                className={inputClass}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="감액">
                <FormattedNumberInput
                  value={draft.deductionAmount}
                  onChange={(value) => setDraft({ ...draft, deductionAmount: value })}
                  min={0}
                  disabled={isSubmitting}
                  placeholder="0"
                  className={inputClass}
                />
              </Field>
              <Field label="감액 사유">
                <input
                  value={draft.deductionReason}
                  onChange={(e) => setDraft({ ...draft, deductionReason: e.target.value })}
                  maxLength={500}
                  disabled={isSubmitting || deduction <= 0}
                  className={inputClass}
                />
              </Field>
            </div>
            <p className="text-sm text-gray-700">
              지급 대상(공급가){' '}
              <span className="font-bold tabular-nums">
                {formatMoney(target.orderAmount - (Number.isNaN(deduction) ? 0 : deduction), target.currencyCode)}
              </span>
            </p>
            <p className="text-xs text-gray-400">승인하면 금액이 확정되어 이번 달 정산에 포함됩니다. 되돌릴 수 없습니다.</p>
            <FormActions isSaving={isSubmitting} savingLabel="처리 중..." saveLabel="승인" onCancel={() => setTarget(null)} />
          </form>
        )}
      </Modal>
    </div>
  );
};
