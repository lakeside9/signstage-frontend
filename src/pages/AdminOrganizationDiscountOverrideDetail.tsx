import { useEffect, useState } from 'react';
import type { FC, FormEvent, ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, History, Loader2, Tag, X } from 'lucide-react';
import { Modal } from '../components/Modal';
import { usePermissionStore } from '../store/usePermissionStore';
import { useSnackbarStore } from '../store/useSnackbarStore';
import { api } from '../utils/api';
import { formatCurrency, formatDateTime } from '../utils/internationalization';
import type {
  CapacityType,
  DiscountType,
  OrganizationBillingPlanDiscountHistorySummary,
  OrganizationBillingPlanDiscountSummary,
  OrganizationCapacityAddOnDiscountHistorySummary,
  OrganizationCapacityAddOnDiscountSummary,
  OrganizationDiscountOverview,
  OrganizationDiscountPeriodStatus,
  OrganizationOptionalFeatureDiscountHistorySummary,
  OrganizationOptionalFeatureDiscountSummary,
} from '../types';

type ItemType = 'plan' | 'optional-feature' | 'capacity-addon';

const API_SEGMENT: Record<ItemType, string> = {
  plan: 'plans',
  'optional-feature': 'optional-features',
  'capacity-addon': 'capacity-addons',
};

const DISCOUNT_TYPE_OPTIONS: Array<{ value: DiscountType; label: string }> = [
  { value: 'PERCENT', label: '퍼센트' },
  { value: 'FIXED_AMOUNT', label: '정액' },
];

const CAPACITY_TYPE_LABEL: Record<CapacityType, string> = {
  SIGNERS: '서명자',
  TEMPLATES: '템플릿',
  TEST_EVENTS: '테스트 행사',
  REHEARSAL_EVENTS: '리허설 행사',
  MAIN_EVENTS: '본행사',
  TABLETS: '태블릿',
  ONSITE_SUPPORT: '현장지원',
  ONLINE_SUPPORT: '온라인지원',
};

const STATUS_LABEL: Record<OrganizationDiscountPeriodStatus, string> = {
  PENDING: '예정',
  ACTIVE: '적용 중',
  EXPIRED: '만료됨',
};

const STATUS_CLASS: Record<OrganizationDiscountPeriodStatus, string> = {
  PENDING: 'bg-blue-50 text-blue-600 border-blue-200',
  ACTIVE: 'bg-green-50 text-green-600 border-green-200',
  EXPIRED: 'bg-gray-100 text-gray-500 border-gray-200',
};

const StatusBadge: FC<{ status: OrganizationDiscountPeriodStatus }> = ({ status }) => (
  <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-medium border ${STATUS_CLASS[status]}`}>
    {STATUS_LABEL[status]}
  </span>
);

const formatDiscount = (discountType: DiscountType, discountValue: number) =>
  discountType === 'PERCENT' ? `${discountValue}%` : formatCurrency(discountValue);

const formatPeriod = (effectiveFrom: string, effectiveTo: string | null) => `${effectiveFrom} ~ ${effectiveTo ?? '무기한'}`;

const today = () => new Date().toISOString().slice(0, 10);

interface DiscountDraft {
  discountType: DiscountType;
  discountValue: number;
  effectiveFrom: string;
  effectiveTo: string;
}

const emptyDraft = (): DiscountDraft => ({ discountType: 'PERCENT', discountValue: 0, effectiveFrom: today(), effectiveTo: '' });

const toRequest = (draft: DiscountDraft) => ({
  discountType: draft.discountType,
  discountValue: draft.discountValue,
  effectiveFrom: draft.effectiveFrom,
  effectiveTo: draft.effectiveTo === '' ? null : draft.effectiveTo,
});

interface Period {
  id: number;
  discountType: DiscountType;
  discountValue: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  status: OrganizationDiscountPeriodStatus;
}

const toPeriod = (
  d: OrganizationBillingPlanDiscountSummary | OrganizationOptionalFeatureDiscountSummary | OrganizationCapacityAddOnDiscountSummary,
): Period => ({
  id: d.id,
  discountType: d.discountType,
  discountValue: d.discountValue,
  effectiveFrom: d.effectiveFrom,
  effectiveTo: d.effectiveTo,
  status: d.status,
});

interface HistoryEntry {
  id: number;
  discountType: DiscountType;
  discountValue: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  removed: boolean;
  createdBy: number;
  createdAt: string;
}

/**
 * 파트너별 할인 오버라이드 상세 — `AdminOrganizationDiscountOverrides`(목록)의 "상세"에서
 * 들어온다(signstage-docs business/discount-management-screen-separation-review.md 결정
 * #2). 목록 행에 이미 있는 organizationId를 경로에 그대로 포함해 기존 조직 하위 조회
 * 엔드포인트(`GET .../billing-discounts` 전체 조회)를 그대로 재사용하고, 그 결과를 이
 * 품목(itemType+itemId)만 걸러서 보여준다. 생성/수정/삭제/이력도 전부 기존 엔드포인트를
 * 그대로 쓴다 — 이 화면 자체를 위한 새 백엔드 API는 없다.
 */
export const AdminOrganizationDiscountOverrideDetail: FC = () => {
  const { organizationId, itemType, itemId } = useParams<{ organizationId: string; itemType: ItemType; itemId: string }>();
  const [itemLabel, setItemLabel] = useState('');
  const [periods, setPeriods] = useState<Period[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [isAddFormOpen, setIsAddFormOpen] = useState(false);
  const [addDraft, setAddDraft] = useState<DiscountDraft>(emptyDraft());
  const [editingPeriodId, setEditingPeriodId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<DiscountDraft>(emptyDraft());
  const [isSaving, setIsSaving] = useState(false);
  const [removingId, setRemovingId] = useState<number | null>(null);

  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [historyEntries, setHistoryEntries] = useState<HistoryEntry[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);

  const canManage = usePermissionStore((state) => state.hasPermission('ACTION_ORGANIZATION_DISCOUNT_MANAGE'));
  const showSnackbar = useSnackbarStore((state) => state.showSnackbar);

  const segment = itemType ? API_SEGMENT[itemType] : '';
  const basePath = `/platform-admin/organizations/${organizationId}/billing-discounts/${segment}/${itemId}`;

  const reload = async () => {
    const response = await api.get(`/platform-admin/organizations/${organizationId}/billing-discounts`);
    const overview = response.data as OrganizationDiscountOverview;
    const numericItemId = Number(itemId);

    if (itemType === 'plan') {
      const matches = overview.billingPlanDiscounts.filter((d) => d.billingPlanId === numericItemId);
      if (matches[0]) setItemLabel(matches[0].billingPlanName);
      setPeriods(matches.map(toPeriod));
    } else if (itemType === 'optional-feature') {
      const matches = overview.optionalFeatureDiscounts.filter((d) => d.optionalFeatureId === numericItemId);
      if (matches[0]) setItemLabel(matches[0].optionalFeatureName);
      setPeriods(matches.map(toPeriod));
    } else if (itemType === 'capacity-addon') {
      const matches = overview.capacityAddOnDiscounts.filter((d) => d.capacityAddOnId === numericItemId);
      if (matches[0]) setItemLabel(`${CAPACITY_TYPE_LABEL[matches[0].capacityType]} +${matches[0].unitAmount}`);
      setPeriods(matches.map(toPeriod));
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setIsLoading(true);
        await reload();
      } catch (err) {
        if (!cancelled) showSnackbar(err instanceof Error ? err.message : '오버라이드를 불러오지 못했습니다.', 'error');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId, itemType, itemId]);

  const openHistory = async () => {
    setIsHistoryOpen(true);
    setIsHistoryLoading(true);
    try {
      const response = await api.get(`${basePath}/history`);
      setHistoryEntries(
        response.data as
          | OrganizationBillingPlanDiscountHistorySummary[]
          | OrganizationOptionalFeatureDiscountHistorySummary[]
          | OrganizationCapacityAddOnDiscountHistorySummary[],
      );
    } catch (err) {
      showSnackbar(err instanceof Error ? err.message : '변경 이력을 불러오지 못했습니다.', 'error');
    } finally {
      setIsHistoryLoading(false);
    }
  };

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await api.post(basePath, toRequest(addDraft));
      showSnackbar('할인 오버라이드 기간을 생성했습니다.', 'success');
      setIsAddFormOpen(false);
      setAddDraft(emptyDraft());
      await reload();
    } catch (err) {
      showSnackbar(err instanceof Error ? err.message : '생성에 실패했습니다.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveEdit = async (periodId: number) => {
    setIsSaving(true);
    try {
      await api.put(`${basePath}/periods/${periodId}`, toRequest(editDraft));
      showSnackbar('할인 오버라이드 기간을 저장했습니다.', 'success');
      setEditingPeriodId(null);
      await reload();
    } catch (err) {
      showSnackbar(err instanceof Error ? err.message : '저장에 실패했습니다.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemove = async (periodId: number) => {
    setRemovingId(periodId);
    try {
      await api.delete(`${basePath}/periods/${periodId}`);
      showSnackbar('기간을 제거했습니다.', 'success');
      await reload();
    } catch (err) {
      showSnackbar(err instanceof Error ? err.message : '제거에 실패했습니다.', 'error');
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <div>
      <Link
        to="/admin/organization-discount-overrides"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-950 mb-4"
      >
        <ArrowLeft size={14} />
        파트너별 할인 오버라이드 목록으로
      </Link>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-gray-400">
          <Loader2 size={24} className="animate-spin" />
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg p-6 max-w-2xl">
          <div className="flex items-center justify-between gap-2">
            <h1 className="text-xl font-bold text-gray-950 flex items-center gap-1.5">
              <Tag size={18} />
              {itemLabel || '품목'}
            </h1>
            <button
              onClick={openHistory}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-gray-200 text-gray-500 text-xs font-medium hover:border-gray-400 hover:text-gray-950"
            >
              <History size={12} />
              이력
            </button>
          </div>

          {canManage && !isAddFormOpen && (
            <button
              onClick={() => setIsAddFormOpen(true)}
              className="mt-4 flex items-center gap-1 px-3 py-1.5 rounded-md bg-gray-950 text-white text-xs font-medium hover:bg-gray-800"
            >
              기간 추가
            </button>
          )}

          {isAddFormOpen && (
            <form
              onSubmit={handleAdd}
              className="mt-4 flex flex-wrap items-end gap-2 bg-gray-50 border border-gray-200 rounded-md p-3"
            >
              <DiscountFields draft={addDraft} onChange={setAddDraft} disabled={isSaving} />
              <FormActions isSaving={isSaving} onCancel={() => setIsAddFormOpen(false)} />
            </form>
          )}

          <ul className="mt-4 divide-y divide-gray-100">
            {periods.length === 0 ? (
              <p className="text-xs text-gray-400 py-2">설정된 기간이 없습니다. 카탈로그 할인값을 그대로 씁니다.</p>
            ) : (
              periods.map((period) =>
                editingPeriodId === period.id ? (
                  <li key={period.id} className="py-2">
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        handleSaveEdit(period.id);
                      }}
                      className="flex flex-wrap items-end gap-2 bg-gray-50 border border-gray-200 rounded-md p-2"
                    >
                      <DiscountFields draft={editDraft} onChange={setEditDraft} disabled={isSaving} />
                      <FormActions isSaving={isSaving} onSave={() => handleSaveEdit(period.id)} onCancel={() => setEditingPeriodId(null)} />
                    </form>
                  </li>
                ) : (
                  <li key={period.id} className="py-2 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <StatusBadge status={period.status} />
                      <span className="text-xs text-gray-700">할인 {formatDiscount(period.discountType, period.discountValue)}</span>
                      <span className="text-xs text-gray-400">{formatPeriod(period.effectiveFrom, period.effectiveTo)}</span>
                    </div>
                    {canManage && (
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => {
                            setEditingPeriodId(period.id);
                            setEditDraft({
                              discountType: period.discountType,
                              discountValue: period.discountValue,
                              effectiveFrom: period.effectiveFrom,
                              effectiveTo: period.effectiveTo ?? '',
                            });
                          }}
                          className="px-2 py-1 rounded-md border border-gray-200 text-gray-600 text-[11px] font-medium hover:border-gray-400"
                        >
                          수정
                        </button>
                        <button
                          onClick={() => handleRemove(period.id)}
                          disabled={removingId === period.id}
                          className="flex items-center gap-1 px-2 py-1 rounded-md border border-gray-200 text-red-600 text-[11px] font-medium hover:border-red-300 disabled:opacity-50"
                        >
                          {removingId === period.id ? <Loader2 size={11} className="animate-spin" /> : <X size={11} />}
                          제거
                        </button>
                      </div>
                    )}
                  </li>
                ),
              )
            )}
          </ul>
          {!canManage && <p className="mt-3 text-[11px] text-gray-400">기간 추가/수정/제거는 권한이 있는 관리자만 가능합니다.</p>}
        </div>
      )}

      <Modal open={isHistoryOpen} onClose={() => setIsHistoryOpen(false)} title="할인 오버라이드 이력" widthClassName="max-w-lg">
        {isHistoryLoading ? (
          <div className="flex items-center justify-center py-8 text-gray-400">
            <Loader2 size={20} className="animate-spin" />
          </div>
        ) : historyEntries.length === 0 ? (
          <p className="text-sm text-gray-400">변경 이력이 없습니다.</p>
        ) : (
          <ul className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
            {historyEntries.map((entry) => (
              <li key={entry.id} className="py-2">
                <div className="flex items-center gap-2">
                  <p className="text-sm text-gray-950 font-medium">
                    {entry.removed ? '기간 제거' : `할인 ${formatDiscount(entry.discountType, entry.discountValue)}로 설정`}
                  </p>
                  {entry.removed && (
                    <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-medium border bg-red-50 text-red-600 border-red-200">
                      제거됨
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  {entry.removed ? '제거 직전 ' : ''}기간: {formatPeriod(entry.effectiveFrom, entry.effectiveTo)}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  관리자 #{entry.createdBy} · {formatDateTime(entry.createdAt)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Modal>
    </div>
  );
};

const DiscountFields: FC<{ draft: DiscountDraft; onChange: (draft: DiscountDraft) => void; disabled: boolean }> = ({
  draft,
  onChange,
  disabled,
}) => (
  <>
    <Field label="할인 방식">
      <select
        value={draft.discountType}
        onChange={(e) => onChange({ ...draft, discountType: e.target.value as DiscountType })}
        disabled={disabled}
        className={inputClass}
      >
        {DISCOUNT_TYPE_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </Field>
    <Field label="할인 값">
      <input
        type="number"
        min={0}
        value={draft.discountValue === 0 ? '' : draft.discountValue}
        onChange={(e) => onChange({ ...draft, discountValue: Number(e.target.value) })}
        disabled={disabled}
        className={`${inputClass} w-28`}
      />
    </Field>
    <Field label="시작일">
      <input
        type="date"
        value={draft.effectiveFrom}
        onChange={(e) => onChange({ ...draft, effectiveFrom: e.target.value })}
        disabled={disabled}
        className={inputClass}
      />
    </Field>
    <Field label="종료일(선택, 비우면 무기한)">
      <input
        type="date"
        value={draft.effectiveTo}
        onChange={(e) => onChange({ ...draft, effectiveTo: e.target.value })}
        disabled={disabled}
        className={inputClass}
      />
    </Field>
  </>
);

const FormActions: FC<{ isSaving: boolean; onSave?: () => void; onCancel: () => void }> = ({ isSaving, onSave, onCancel }) => (
  <div className="flex gap-1.5">
    <button
      type={onSave ? 'button' : 'submit'}
      onClick={onSave}
      disabled={isSaving}
      className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-gray-950 text-white text-xs font-medium hover:bg-gray-800 disabled:opacity-50"
    >
      {isSaving && <Loader2 size={11} className="animate-spin" />}
      저장
    </button>
    <button
      type="button"
      onClick={onCancel}
      disabled={isSaving}
      className="px-3 py-1.5 rounded-md border border-gray-200 text-gray-600 text-xs font-medium hover:border-gray-400 disabled:opacity-50"
    >
      취소
    </button>
  </div>
);

const inputClass =
  'px-2.5 py-1.5 border border-gray-200 rounded-md text-xs focus:ring-2 focus:ring-gray-950/10 focus:border-gray-400 outline-none transition-all disabled:bg-gray-100';

const Field: FC<{ label: string; children: ReactNode }> = ({ label, children }) => (
  <div>
    <label className="block text-[11px] font-medium text-gray-500 mb-1">{label}</label>
    {children}
  </div>
);
