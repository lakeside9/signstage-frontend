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
import {
  DEDUCTION_TYPE_LABEL,
  DISPUTE_STATUS_LABEL,
  INSPECTION_STATUS_LABEL,
  LARGE_DEDUCTION_RATE,
  blankToNull,
  formatMoney,
  formatSchedule,
} from './order/constants';
import type {
  DeductionTypeOption,
  InspectionDeductionType,
  InspectionStatus,
  OrderInspectionSummary,
  PageResponse,
} from '../types';

const PAGE_SIZE = 20;

interface ApproveDraft {
  defectNote: string;
  delayNote: string;
  deductionAmount: string;
  deductionReason: string;
  deductionType: '' | InspectionDeductionType;
  performanceRating: string;
}

const EMPTY_DRAFT: ApproveDraft = {
  defectNote: '', delayNote: '', deductionAmount: '', deductionReason: '', deductionType: '', performanceRating: '',
};

interface ResolveDraft {
  deductionAmount: string;
  deductionReason: string;
  deductionType: '' | InspectionDeductionType;
  resolutionNote: string;
}

/** 검색 필터 — 검수 상태 또는 "이의 제기 중". */
type InspectionFilter = 'ALL' | InspectionStatus | 'DISPUTE_OPEN';

const RATING_OPTIONS = [
  { value: '5', label: '5 · 매우 좋음' },
  { value: '4', label: '4 · 좋음' },
  { value: '3', label: '3 · 보통' },
  { value: '2', label: '2 · 미흡' },
  { value: '1', label: '1 · 매우 미흡' },
];

/**
 * 검수(플랫폼 관리자) — signstage-docs business/platform-order-partner-subcontract-review.md D11·D13.
 * 파트너가 수행한 행사가 완료되면 검수 대기 건이 생긴다. 기한(완료일 + 7일) 안에 하자·지체를 적고
 * 감액해 승인하며, 기한이 지나면 감액 없이 승인으로 본다. 승인된 금액은 승인월에 월 합산 지급된다.
 */
export const AdminOrderInspectionList: FC = () => {
  const canInspect = usePermissionStore((state) => state.hasPermission('ACTION_ORDER_INSPECTION'));
  const canLargeDeduct = usePermissionStore((state) => state.hasPermission('ACTION_INSPECTION_LARGE_DEDUCTION'));
  const canResolve = usePermissionStore((state) => state.hasPermission('ACTION_INSPECTION_DISPUTE_RESOLVE'));
  const showSnackbar = useSnackbarStore((state) => state.showSnackbar);

  const [statusFilter, setStatusFilter] = useState<InspectionFilter>('PENDING');
  const [appliedStatus, setAppliedStatus] = useState<InspectionFilter>('PENDING');
  const [page, setPage] = useState(0);
  const [pageData, setPageData] = useState<PageResponse<OrderInspectionSummary> | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [target, setTarget] = useState<OrderInspectionSummary | null>(null);
  const [draft, setDraft] = useState<ApproveDraft>(EMPTY_DRAFT);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deductionTypes, setDeductionTypes] = useState<DeductionTypeOption[]>([]);
  const [resolveTarget, setResolveTarget] = useState<OrderInspectionSummary | null>(null);
  const [resolveDraft, setResolveDraft] = useState<ResolveDraft>({
    deductionAmount: '', deductionReason: '', deductionType: '', resolutionNote: '',
  });

  const fetchPage = useCallback(async () => {
    const query = new URLSearchParams();
    if (appliedStatus === 'DISPUTE_OPEN') query.set('disputeStatus', 'OPEN');
    else if (appliedStatus !== 'ALL') query.set('status', appliedStatus);
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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await api.get('/platform-admin/order-inspections/deduction-types');
        if (!cancelled) setDeductionTypes(response.data as DeductionTypeOption[]);
      } catch {
        // 기준표를 못 받아도 유형 이름만으로 고를 수 있다(제안 금액 없음).
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /** 감액 유형의 기준 비율로 감액을 제안한다. 기타는 비율이 없어 금액을 그대로 둔다. */
  const suggestDeduction = (orderAmount: number, type: '' | InspectionDeductionType, current: string) => {
    const rate = deductionTypes.find((option) => option.code === type)?.ratePercent;
    return rate === null || rate === undefined ? current : String(Math.round((orderAmount * rate) / 100));
  };

  const typeOptions: Array<{ value: InspectionDeductionType; label: string }> =
    deductionTypes.length > 0
      ? deductionTypes.map((option) => ({
          value: option.code,
          label: option.ratePercent === null ? option.label : `${option.label} · ${option.ratePercent}%`,
        }))
      : (Object.entries(DEDUCTION_TYPE_LABEL) as Array<[InspectionDeductionType, string]>).map(([value, label]) => ({ value, label }));

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
    if (deduction > 0 && !draft.deductionType) {
      showSnackbar('감액 유형을 골라주세요.', 'error');
      return;
    }
    setIsSubmitting(true);
    try {
      await api.post(`/platform-admin/order-inspections/${target.id}/approve`, {
        defectNote: blankToNull(draft.defectNote),
        delayNote: blankToNull(draft.delayNote),
        deductionAmount: deduction,
        deductionReason: deduction > 0 ? draft.deductionReason.trim() : null,
        deductionType: draft.deductionType || null,
        performanceRating: draft.performanceRating ? Number(draft.performanceRating) : null,
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

  const openResolve = (inspection: OrderInspectionSummary) => {
    setResolveDraft({
      deductionAmount: String(inspection.deductionAmount),
      deductionReason: inspection.deductionReason ?? '',
      deductionType: inspection.deductionType ?? '',
      resolutionNote: '',
    });
    setResolveTarget(inspection);
  };

  const resolveDeduction = Number(resolveDraft.deductionAmount || 0);

  const handleResolve = async (e: FormEvent) => {
    e.preventDefault();
    if (!resolveTarget) return;
    if (Number.isNaN(resolveDeduction) || resolveDeduction < 0 || resolveDeduction > resolveTarget.orderAmount) {
      showSnackbar('감액은 0 이상, 발주 금액 이하여야 합니다.', 'error');
      return;
    }
    if (resolveDeduction > 0 && (!resolveDraft.deductionReason.trim() || !resolveDraft.deductionType)) {
      showSnackbar('감액이 있으면 사유와 유형을 입력해주세요.', 'error');
      return;
    }
    if (!resolveDraft.resolutionNote.trim()) {
      showSnackbar('조정 내용을 입력해주세요.', 'error');
      return;
    }
    setIsSubmitting(true);
    try {
      await api.post(`/platform-admin/order-inspections/${resolveTarget.id}/resolve-dispute`, {
        deductionAmount: resolveDeduction,
        deductionReason: resolveDeduction > 0 ? resolveDraft.deductionReason.trim() : null,
        deductionType: resolveDeduction > 0 ? resolveDraft.deductionType : null,
        resolutionNote: resolveDraft.resolutionNote.trim(),
      });
      showSnackbar('이의를 조정했습니다.', 'success');
      setResolveTarget(null);
      setPageData(await fetchPage());
    } catch (err) {
      showSnackbar(err instanceof Error ? err.message : '이의 조정에 실패했습니다.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isLargeDeduction = (orderAmount: number, amount: number) => amount > orderAmount * LARGE_DEDUCTION_RATE;

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
            onChange={(e) => setStatusFilter(e.target.value as InspectionFilter)}
            className={`${inputClass} bg-white`}
          >
            <option value="ALL">전체</option>
            {Object.entries(INSPECTION_STATUS_LABEL).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
            <option value="DISPUTE_OPEN">이의 제기 중</option>
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
                  {inspection.performanceRating !== null && (
                    <p className="text-xs text-gray-400">평점 {inspection.performanceRating}/5</p>
                  )}
                  {inspection.disputeStatus && (
                    <p className={`text-xs ${inspection.disputeStatus === 'OPEN' ? 'text-red-600' : 'text-gray-400'}`}>
                      {DISPUTE_STATUS_LABEL[inspection.disputeStatus]}
                    </p>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  {canInspect && inspection.status === 'PENDING' && !inspection.overdue && (
                    <Button size="sm" onClick={() => openApprove(inspection)}>검수 승인</Button>
                  )}
                  {canResolve && inspection.disputeStatus === 'OPEN' && (
                    <Button size="sm" variant="secondary" onClick={() => openResolve(inspection)}>이의 조정</Button>
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
            <Field label="감액 유형(계약 기준표)">
              <select
                value={draft.deductionType}
                onChange={(e) => {
                  const type = e.target.value as '' | InspectionDeductionType;
                  setDraft({
                    ...draft,
                    deductionType: type,
                    deductionAmount: suggestDeduction(target.orderAmount, type, draft.deductionAmount),
                    deductionReason: draft.deductionReason || (type ? DEDUCTION_TYPE_LABEL[type] : ''),
                  });
                }}
                disabled={isSubmitting}
                className={`${inputClass} bg-white`}
              >
                <option value="">감액 없음</option>
                {typeOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
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
            <Field label="수행 평점(선택, 내부용)">
              <select
                value={draft.performanceRating}
                onChange={(e) => setDraft({ ...draft, performanceRating: e.target.value })}
                disabled={isSubmitting}
                className={`${inputClass} bg-white`}
              >
                <option value="">입력 안 함</option>
                {RATING_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </Field>
            <p className="text-xs text-gray-400">평점은 파트너 평가에만 쓰이고 파트너에게 보이지 않습니다.</p>
            {isLargeDeduction(target.orderAmount, deduction) && (
              <p className={`text-xs ${canLargeDeduct ? 'text-amber-700' : 'text-red-600'}`}>
                발주 금액의 {LARGE_DEDUCTION_RATE * 100}%를 넘는 감액입니다.{' '}
                {canLargeDeduct ? '큰 감액으로 기록됩니다.' : 'PLATFORM_SUPER만 승인할 수 있습니다.'}
              </p>
            )}
            <p className="text-sm text-gray-700">
              지급 대상(공급가){' '}
              <span className="font-bold tabular-nums">
                {formatMoney(target.orderAmount - (Number.isNaN(deduction) ? 0 : deduction), target.currencyCode)}
              </span>
            </p>
            <p className="text-xs text-gray-400">
              승인하면 금액이 확정됩니다. 감액하면 파트너가 7일 안에 이의를 제기할 수 있고, 그동안은 정산하지 않습니다.
            </p>
            <FormActions isSaving={isSubmitting} savingLabel="처리 중..." saveLabel="승인" onCancel={() => setTarget(null)} />
          </form>
        )}
      </Modal>

      <Modal open={resolveTarget !== null} onClose={() => setResolveTarget(null)} title="감액 이의 조정">
        {resolveTarget && (
          <form onSubmit={handleResolve} className="space-y-3">
            <p className="text-sm text-gray-700">
              {resolveTarget.title} · {resolveTarget.organizationName} · 발주 금액{' '}
              {formatMoney(resolveTarget.orderAmount, resolveTarget.currencyCode)}
            </p>
            <div className="rounded-md bg-gray-50 p-3 text-sm space-y-1">
              <p>
                현재 감액 {formatMoney(resolveTarget.deductionAmount, resolveTarget.currencyCode)}
                {resolveTarget.deductionType && ` · ${DEDUCTION_TYPE_LABEL[resolveTarget.deductionType]}`}
                {resolveTarget.deductionReason
                  && resolveTarget.deductionReason !== (resolveTarget.deductionType && DEDUCTION_TYPE_LABEL[resolveTarget.deductionType])
                  && ` (${resolveTarget.deductionReason})`}
              </p>
              <p className="text-gray-500">파트너 이의: {resolveTarget.disputeReason}</p>
            </div>
            <Field label="최종 감액 유형">
              <select
                value={resolveDraft.deductionType}
                onChange={(e) => {
                  const type = e.target.value as '' | InspectionDeductionType;
                  setResolveDraft({
                    ...resolveDraft,
                    deductionType: type,
                    deductionAmount: type ? suggestDeduction(resolveTarget.orderAmount, type, resolveDraft.deductionAmount) : '0',
                  });
                }}
                disabled={isSubmitting}
                className={`${inputClass} bg-white`}
              >
                <option value="">감액 없음</option>
                {typeOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="최종 감액">
                <FormattedNumberInput
                  value={resolveDraft.deductionAmount}
                  onChange={(value) => setResolveDraft({ ...resolveDraft, deductionAmount: value })}
                  min={0}
                  disabled={isSubmitting}
                  className={inputClass}
                />
              </Field>
              <Field label="감액 사유">
                <input
                  value={resolveDraft.deductionReason}
                  onChange={(e) => setResolveDraft({ ...resolveDraft, deductionReason: e.target.value })}
                  maxLength={500}
                  disabled={isSubmitting || resolveDeduction <= 0}
                  className={inputClass}
                />
              </Field>
            </div>
            <Field label="조정 내용(파트너에게 보임)">
              <textarea
                value={resolveDraft.resolutionNote}
                onChange={(e) => setResolveDraft({ ...resolveDraft, resolutionNote: e.target.value })}
                maxLength={1000}
                rows={2}
                disabled={isSubmitting}
                className={inputClass}
              />
            </Field>
            {isLargeDeduction(resolveTarget.orderAmount, resolveDeduction) && !canLargeDeduct && (
              <p className="text-xs text-red-600">발주 금액의 {LARGE_DEDUCTION_RATE * 100}%를 넘는 감액은 PLATFORM_SUPER만 정할 수 있습니다.</p>
            )}
            <p className="text-sm text-gray-700">
              지급 대상(공급가){' '}
              <span className="font-bold tabular-nums">
                {formatMoney(resolveTarget.orderAmount - (Number.isNaN(resolveDeduction) ? 0 : resolveDeduction), resolveTarget.currencyCode)}
              </span>
              {resolveTarget.payableAmount !== null && (
                <span className="text-xs text-gray-400"> (현재 {formatMoney(resolveTarget.payableAmount, resolveTarget.currencyCode)})</span>
              )}
            </p>
            <p className="text-xs text-gray-400">조정하면 금액 차이가 원장에 남고, 이 건은 다음 정산에 포함됩니다.</p>
            <FormActions isSaving={isSubmitting} savingLabel="처리 중..." saveLabel="조정" onCancel={() => setResolveTarget(null)} />
          </form>
        )}
      </Modal>
    </div>
  );
};
