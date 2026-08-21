import { useEffect, useState } from 'react';
import type { FC, FormEvent, ReactNode } from 'react';
import { History, Loader2, Percent, Plus, X } from 'lucide-react';
import { Modal } from './Modal';
import { api } from '../utils/api';
import type {
  BillingPlanSummary,
  CapacityAddOnSummary,
  CapacityType,
  DiscountType,
  OptionalFeatureSummary,
  OrganizationBillingPlanDiscountHistorySummary,
  OrganizationBillingPlanDiscountSummary,
  OrganizationCapacityAddOnDiscountHistorySummary,
  OrganizationCapacityAddOnDiscountSummary,
  OrganizationDiscountOverview,
  OrganizationOptionalFeatureDiscountHistorySummary,
  OrganizationOptionalFeatureDiscountSummary,
} from '../types';

const DISCOUNT_TYPE_OPTIONS: Array<{ value: DiscountType; label: string }> = [
  { value: 'PERCENT', label: '퍼센트' },
  { value: 'FIXED_AMOUNT', label: '정액' },
];

const CAPACITY_TYPE_LABEL: Record<CapacityType, string> = {
  SIGNERS: '서명자',
  TEMPLATES: '템플릿',
  TEST_EVENTS: '테스트 행사',
  MAIN_EVENTS: '본행사',
  TABLETS: '태블릿',
};

const formatDiscount = (discountType: DiscountType, discountValue: number) =>
  discountType === 'PERCENT' ? `${discountValue}%` : `${discountValue.toLocaleString('ko-KR')}원`;

interface DiscountDraft {
  discountType: DiscountType;
  discountValue: number;
}

const EMPTY_DRAFT: DiscountDraft = { discountType: 'PERCENT', discountValue: 0 };

interface PanelProps {
  organizationId: string;
  canManage: boolean;
  showSnackbar: (message: string, variant: 'success' | 'error') => void;
}

/**
 * 조직×품목 세밀 할인 오버라이드(안 A) 관리 패널 — signstage-docs
 * business/organization-event-discount-pricing-review.md 4.1절(2026-08-21 재검토) 참고.
 * `AdminOrganizationDetail.tsx`가 조직 상세 화면 하단에 붙여 쓴다. 등록/수정/삭제는
 * PLATFORM_OPS 이상만(`canManage`), 조회는 이 화면에 들어올 수 있는 누구나(PLATFORM_SUPPORT
 * 이상) 가능하다 — 최종 판단은 항상 백엔드가 한다.
 *
 * 이 값은 새 Ceremony 생성(플랜)·구매 요청(선택옵션/용량 추가구매) 시점에만 스냅샷되므로,
 * 여기서 바꿔도 이미 만들어진 Ceremony/구매 건에는 영향을 주지 않는다 — 오버라이드를
 * 제거하면 그 조직×품목 조합은 다시 카탈로그 자체 할인값을 쓴다.
 */
export const OrganizationDiscountPanel: FC<PanelProps> = ({ organizationId, canManage, showSnackbar }) => {
  const [overview, setOverview] = useState<OrganizationDiscountOverview | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchOverview = async () => {
    const response = await api.get(`/platform-admin/organizations/${organizationId}/billing-discounts`);
    return response.data as OrganizationDiscountOverview;
  };

  const reload = async () => {
    try {
      setOverview(await fetchOverview());
    } catch (err) {
      showSnackbar(err instanceof Error ? err.message : '할인 오버라이드를 불러오지 못했습니다.', 'error');
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchOverview();
        if (!cancelled) setOverview(data);
      } catch (err) {
        if (!cancelled) {
          showSnackbar(err instanceof Error ? err.message : '할인 오버라이드를 불러오지 못했습니다.', 'error');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId]);

  return (
    <div className="mt-4 bg-white border border-gray-200 rounded-lg p-4">
      <div className="mb-3">
        <h2 className="text-sm font-bold text-gray-950 flex items-center gap-1.5">
          <Percent size={14} />
          조직별 할인 오버라이드
        </h2>
        <p className="mt-1 text-xs text-gray-500">
          이 조직이 특정 플랜/선택옵션/용량 추가구매를 살 때 카탈로그 할인 대신 적용할 값입니다. 새로 만드는
          행사·구매 건에만 반영되며, 이미 만든 것은 영향받지 않습니다.
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8 text-gray-400">
          <Loader2 size={20} className="animate-spin" />
        </div>
      ) : (
        overview && (
          <div className="space-y-4">
            <BillingPlanDiscountSection
              organizationId={organizationId}
              canManage={canManage}
              discounts={overview.billingPlanDiscounts}
              onChanged={reload}
              showSnackbar={showSnackbar}
            />
            <OptionalFeatureDiscountSection
              organizationId={organizationId}
              canManage={canManage}
              discounts={overview.optionalFeatureDiscounts}
              onChanged={reload}
              showSnackbar={showSnackbar}
            />
            <CapacityAddOnDiscountSection
              organizationId={organizationId}
              canManage={canManage}
              discounts={overview.capacityAddOnDiscounts}
              onChanged={reload}
              showSnackbar={showSnackbar}
            />
          </div>
        )
      )}
    </div>
  );
};

// ---- 과금 플랜 ----

const BillingPlanDiscountSection: FC<
  PanelProps & { discounts: OrganizationBillingPlanDiscountSummary[]; onChanged: () => Promise<void> }
> = ({ organizationId, canManage, discounts, onChanged, showSnackbar }) => {
  const [plans, setPlans] = useState<BillingPlanSummary[]>([]);
  const [isAddFormOpen, setIsAddFormOpen] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState<number | ''>('');
  const [addDraft, setAddDraft] = useState<DiscountDraft>(EMPTY_DRAFT);
  const [editingPlanId, setEditingPlanId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<DiscountDraft>(EMPTY_DRAFT);
  const [isSaving, setIsSaving] = useState(false);
  const [removingId, setRemovingId] = useState<number | null>(null);

  const [historyPlanId, setHistoryPlanId] = useState<number | null>(null);
  const [historyEntries, setHistoryEntries] = useState<OrganizationBillingPlanDiscountHistorySummary[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);

  const openAddForm = async () => {
    setIsAddFormOpen(true);
    try {
      const response = await api.get('/billing-plans');
      setPlans(response.data as BillingPlanSummary[]);
    } catch (err) {
      showSnackbar(err instanceof Error ? err.message : '과금 플랜 목록을 불러오지 못했습니다.', 'error');
    }
  };

  const openHistory = async (planId: number) => {
    setHistoryPlanId(planId);
    setIsHistoryLoading(true);
    try {
      const response = await api.get(`/platform-admin/organizations/${organizationId}/billing-discounts/plans/${planId}/history`);
      setHistoryEntries(response.data as OrganizationBillingPlanDiscountHistorySummary[]);
    } catch (err) {
      showSnackbar(err instanceof Error ? err.message : '변경 이력을 불러오지 못했습니다.', 'error');
    } finally {
      setIsHistoryLoading(false);
    }
  };

  const save = async (planId: number, draft: DiscountDraft, onDone: () => void) => {
    setIsSaving(true);
    try {
      await api.put(`/platform-admin/organizations/${organizationId}/billing-discounts/plans/${planId}`, draft);
      showSnackbar('할인 오버라이드를 저장했습니다.', 'success');
      onDone();
      await onChanged();
    } catch (err) {
      showSnackbar(err instanceof Error ? err.message : '저장에 실패했습니다.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedPlanId) {
      showSnackbar('플랜을 선택해주세요.', 'error');
      return;
    }
    await save(selectedPlanId, addDraft, () => {
      setIsAddFormOpen(false);
      setSelectedPlanId('');
      setAddDraft(EMPTY_DRAFT);
    });
  };

  const handleSaveEdit = async (planId: number) => {
    await save(planId, editDraft, () => setEditingPlanId(null));
  };

  const handleRemove = async (planId: number) => {
    setRemovingId(planId);
    try {
      await api.delete(`/platform-admin/organizations/${organizationId}/billing-discounts/plans/${planId}`);
      showSnackbar('오버라이드를 제거했습니다. 이후 카탈로그 값을 다시 씁니다.', 'success');
      await onChanged();
    } catch (err) {
      showSnackbar(err instanceof Error ? err.message : '제거에 실패했습니다.', 'error');
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <>
      <DiscountSubsection
        title="과금 플랜"
        canManage={canManage}
        isAddFormOpen={isAddFormOpen}
        onOpenAddForm={openAddForm}
        addForm={
          <form onSubmit={handleAdd} className="flex flex-wrap items-end gap-2">
            <Field label="플랜">
              <select
                value={selectedPlanId}
                onChange={(e) => setSelectedPlanId(e.target.value ? Number(e.target.value) : '')}
                disabled={isSaving}
                className={inputClass}
              >
                <option value="">선택</option>
                {plans.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.name}
                  </option>
                ))}
              </select>
            </Field>
            <DiscountFields draft={addDraft} onChange={setAddDraft} disabled={isSaving} />
            <FormActions isSaving={isSaving} onCancel={() => setIsAddFormOpen(false)} />
          </form>
        }
        isEmpty={discounts.length === 0}
        emptyMessage="설정된 오버라이드가 없습니다. 카탈로그 할인값을 그대로 씁니다."
      >
        {discounts.map((discount) =>
          editingPlanId === discount.billingPlanId ? (
            <li key={discount.id} className="py-2 flex flex-wrap items-end gap-2">
              <span className="text-sm font-medium text-gray-950 min-w-[100px]">{discount.billingPlanName}</span>
              <DiscountFields draft={editDraft} onChange={setEditDraft} disabled={isSaving} />
              <FormActions
                isSaving={isSaving}
                onSave={() => handleSaveEdit(discount.billingPlanId)}
                onCancel={() => setEditingPlanId(null)}
              />
            </li>
          ) : (
            <DiscountRow
              key={discount.id}
              label={discount.billingPlanName}
              discountType={discount.discountType}
              discountValue={discount.discountValue}
              canManage={canManage}
              isRemoving={removingId === discount.billingPlanId}
              onEdit={() => {
                setEditingPlanId(discount.billingPlanId);
                setEditDraft({ discountType: discount.discountType, discountValue: discount.discountValue });
              }}
              onRemove={() => handleRemove(discount.billingPlanId)}
              onHistory={() => openHistory(discount.billingPlanId)}
            />
          ),
        )}
      </DiscountSubsection>

      <DiscountHistoryModal
        open={historyPlanId !== null}
        onClose={() => setHistoryPlanId(null)}
        title="과금 플랜 할인 오버라이드 이력"
        isLoading={isHistoryLoading}
        entries={historyEntries}
      />
    </>
  );
};

// ---- 선택옵션 ----

const OptionalFeatureDiscountSection: FC<
  PanelProps & { discounts: OrganizationOptionalFeatureDiscountSummary[]; onChanged: () => Promise<void> }
> = ({ organizationId, canManage, discounts, onChanged, showSnackbar }) => {
  const [features, setFeatures] = useState<OptionalFeatureSummary[]>([]);
  const [isAddFormOpen, setIsAddFormOpen] = useState(false);
  const [selectedFeatureId, setSelectedFeatureId] = useState<number | ''>('');
  const [addDraft, setAddDraft] = useState<DiscountDraft>(EMPTY_DRAFT);
  const [editingFeatureId, setEditingFeatureId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<DiscountDraft>(EMPTY_DRAFT);
  const [isSaving, setIsSaving] = useState(false);
  const [removingId, setRemovingId] = useState<number | null>(null);

  const [historyFeatureId, setHistoryFeatureId] = useState<number | null>(null);
  const [historyEntries, setHistoryEntries] = useState<OrganizationOptionalFeatureDiscountHistorySummary[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);

  const openAddForm = async () => {
    setIsAddFormOpen(true);
    try {
      const response = await api.get('/optional-features');
      setFeatures(response.data as OptionalFeatureSummary[]);
    } catch (err) {
      showSnackbar(err instanceof Error ? err.message : '선택옵션 목록을 불러오지 못했습니다.', 'error');
    }
  };

  const openHistory = async (featureId: number) => {
    setHistoryFeatureId(featureId);
    setIsHistoryLoading(true);
    try {
      const response = await api.get(
        `/platform-admin/organizations/${organizationId}/billing-discounts/optional-features/${featureId}/history`,
      );
      setHistoryEntries(response.data as OrganizationOptionalFeatureDiscountHistorySummary[]);
    } catch (err) {
      showSnackbar(err instanceof Error ? err.message : '변경 이력을 불러오지 못했습니다.', 'error');
    } finally {
      setIsHistoryLoading(false);
    }
  };

  const save = async (featureId: number, draft: DiscountDraft, onDone: () => void) => {
    setIsSaving(true);
    try {
      await api.put(`/platform-admin/organizations/${organizationId}/billing-discounts/optional-features/${featureId}`, draft);
      showSnackbar('할인 오버라이드를 저장했습니다.', 'success');
      onDone();
      await onChanged();
    } catch (err) {
      showSnackbar(err instanceof Error ? err.message : '저장에 실패했습니다.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedFeatureId) {
      showSnackbar('선택옵션을 선택해주세요.', 'error');
      return;
    }
    await save(selectedFeatureId, addDraft, () => {
      setIsAddFormOpen(false);
      setSelectedFeatureId('');
      setAddDraft(EMPTY_DRAFT);
    });
  };

  const handleSaveEdit = async (featureId: number) => {
    await save(featureId, editDraft, () => setEditingFeatureId(null));
  };

  const handleRemove = async (featureId: number) => {
    setRemovingId(featureId);
    try {
      await api.delete(`/platform-admin/organizations/${organizationId}/billing-discounts/optional-features/${featureId}`);
      showSnackbar('오버라이드를 제거했습니다. 이후 카탈로그 값을 다시 씁니다.', 'success');
      await onChanged();
    } catch (err) {
      showSnackbar(err instanceof Error ? err.message : '제거에 실패했습니다.', 'error');
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <>
      <DiscountSubsection
        title="선택옵션"
        canManage={canManage}
        isAddFormOpen={isAddFormOpen}
        onOpenAddForm={openAddForm}
        addForm={
          <form onSubmit={handleAdd} className="flex flex-wrap items-end gap-2">
            <Field label="선택옵션">
              <select
                value={selectedFeatureId}
                onChange={(e) => setSelectedFeatureId(e.target.value ? Number(e.target.value) : '')}
                disabled={isSaving}
                className={inputClass}
              >
                <option value="">선택</option>
                {features.map((feature) => (
                  <option key={feature.id} value={feature.id}>
                    {feature.name}
                  </option>
                ))}
              </select>
            </Field>
            <DiscountFields draft={addDraft} onChange={setAddDraft} disabled={isSaving} />
            <FormActions isSaving={isSaving} onCancel={() => setIsAddFormOpen(false)} />
          </form>
        }
        isEmpty={discounts.length === 0}
        emptyMessage="설정된 오버라이드가 없습니다. 카탈로그 할인값을 그대로 씁니다."
      >
        {discounts.map((discount) =>
          editingFeatureId === discount.optionalFeatureId ? (
            <li key={discount.id} className="py-2 flex flex-wrap items-end gap-2">
              <span className="text-sm font-medium text-gray-950 min-w-[100px]">{discount.optionalFeatureName}</span>
              <DiscountFields draft={editDraft} onChange={setEditDraft} disabled={isSaving} />
              <FormActions
                isSaving={isSaving}
                onSave={() => handleSaveEdit(discount.optionalFeatureId)}
                onCancel={() => setEditingFeatureId(null)}
              />
            </li>
          ) : (
            <DiscountRow
              key={discount.id}
              label={discount.optionalFeatureName}
              discountType={discount.discountType}
              discountValue={discount.discountValue}
              canManage={canManage}
              isRemoving={removingId === discount.optionalFeatureId}
              onEdit={() => {
                setEditingFeatureId(discount.optionalFeatureId);
                setEditDraft({ discountType: discount.discountType, discountValue: discount.discountValue });
              }}
              onRemove={() => handleRemove(discount.optionalFeatureId)}
              onHistory={() => openHistory(discount.optionalFeatureId)}
            />
          ),
        )}
      </DiscountSubsection>

      <DiscountHistoryModal
        open={historyFeatureId !== null}
        onClose={() => setHistoryFeatureId(null)}
        title="선택옵션 할인 오버라이드 이력"
        isLoading={isHistoryLoading}
        entries={historyEntries}
      />
    </>
  );
};

// ---- 용량 추가구매 ----

const CapacityAddOnDiscountSection: FC<
  PanelProps & { discounts: OrganizationCapacityAddOnDiscountSummary[]; onChanged: () => Promise<void> }
> = ({ organizationId, canManage, discounts, onChanged, showSnackbar }) => {
  const [addOns, setAddOns] = useState<CapacityAddOnSummary[]>([]);
  const [isAddFormOpen, setIsAddFormOpen] = useState(false);
  const [selectedAddOnId, setSelectedAddOnId] = useState<number | ''>('');
  const [addDraft, setAddDraft] = useState<DiscountDraft>(EMPTY_DRAFT);
  const [editingAddOnId, setEditingAddOnId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<DiscountDraft>(EMPTY_DRAFT);
  const [isSaving, setIsSaving] = useState(false);
  const [removingId, setRemovingId] = useState<number | null>(null);

  const addOnLabel = (addOn: CapacityAddOnSummary) => {
    const primary = `${CAPACITY_TYPE_LABEL[addOn.capacityType]} +${addOn.unitAmount}`;
    if (!addOn.secondaryCapacityType) return primary;
    return `${primary} · ${CAPACITY_TYPE_LABEL[addOn.secondaryCapacityType]} +${addOn.secondaryUnitAmount}`;
  };

  const [historyAddOnId, setHistoryAddOnId] = useState<number | null>(null);
  const [historyEntries, setHistoryEntries] = useState<OrganizationCapacityAddOnDiscountHistorySummary[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);

  const openAddForm = async () => {
    setIsAddFormOpen(true);
    try {
      const response = await api.get('/capacity-addons');
      setAddOns(response.data as CapacityAddOnSummary[]);
    } catch (err) {
      showSnackbar(err instanceof Error ? err.message : '용량 추가구매 상품 목록을 불러오지 못했습니다.', 'error');
    }
  };

  const openHistory = async (addOnId: number) => {
    setHistoryAddOnId(addOnId);
    setIsHistoryLoading(true);
    try {
      const response = await api.get(
        `/platform-admin/organizations/${organizationId}/billing-discounts/capacity-addons/${addOnId}/history`,
      );
      setHistoryEntries(response.data as OrganizationCapacityAddOnDiscountHistorySummary[]);
    } catch (err) {
      showSnackbar(err instanceof Error ? err.message : '변경 이력을 불러오지 못했습니다.', 'error');
    } finally {
      setIsHistoryLoading(false);
    }
  };

  const save = async (addOnId: number, draft: DiscountDraft, onDone: () => void) => {
    setIsSaving(true);
    try {
      await api.put(`/platform-admin/organizations/${organizationId}/billing-discounts/capacity-addons/${addOnId}`, draft);
      showSnackbar('할인 오버라이드를 저장했습니다.', 'success');
      onDone();
      await onChanged();
    } catch (err) {
      showSnackbar(err instanceof Error ? err.message : '저장에 실패했습니다.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedAddOnId) {
      showSnackbar('용량 추가구매 상품을 선택해주세요.', 'error');
      return;
    }
    await save(selectedAddOnId, addDraft, () => {
      setIsAddFormOpen(false);
      setSelectedAddOnId('');
      setAddDraft(EMPTY_DRAFT);
    });
  };

  const handleSaveEdit = async (addOnId: number) => {
    await save(addOnId, editDraft, () => setEditingAddOnId(null));
  };

  const handleRemove = async (addOnId: number) => {
    setRemovingId(addOnId);
    try {
      await api.delete(`/platform-admin/organizations/${organizationId}/billing-discounts/capacity-addons/${addOnId}`);
      showSnackbar('오버라이드를 제거했습니다. 이후 카탈로그 값을 다시 씁니다.', 'success');
      await onChanged();
    } catch (err) {
      showSnackbar(err instanceof Error ? err.message : '제거에 실패했습니다.', 'error');
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <>
      <DiscountSubsection
        title="용량 추가구매"
        canManage={canManage}
        isAddFormOpen={isAddFormOpen}
        onOpenAddForm={openAddForm}
        addForm={
          <form onSubmit={handleAdd} className="flex flex-wrap items-end gap-2">
            <Field label="상품">
              <select
                value={selectedAddOnId}
                onChange={(e) => setSelectedAddOnId(e.target.value ? Number(e.target.value) : '')}
                disabled={isSaving}
                className={inputClass}
              >
                <option value="">선택</option>
                {addOns.map((addOn) => (
                  <option key={addOn.id} value={addOn.id}>
                    {addOnLabel(addOn)}
                  </option>
                ))}
              </select>
            </Field>
            <DiscountFields draft={addDraft} onChange={setAddDraft} disabled={isSaving} />
            <FormActions isSaving={isSaving} onCancel={() => setIsAddFormOpen(false)} />
          </form>
        }
        isEmpty={discounts.length === 0}
        emptyMessage="설정된 오버라이드가 없습니다. 카탈로그 할인값을 그대로 씁니다."
      >
        {discounts.map((discount) =>
          editingAddOnId === discount.capacityAddOnId ? (
            <li key={discount.id} className="py-2 flex flex-wrap items-end gap-2">
              <span className="text-sm font-medium text-gray-950 min-w-[100px]">
                {CAPACITY_TYPE_LABEL[discount.capacityType]} +{discount.unitAmount}
              </span>
              <DiscountFields draft={editDraft} onChange={setEditDraft} disabled={isSaving} />
              <FormActions
                isSaving={isSaving}
                onSave={() => handleSaveEdit(discount.capacityAddOnId)}
                onCancel={() => setEditingAddOnId(null)}
              />
            </li>
          ) : (
            <DiscountRow
              key={discount.id}
              label={`${CAPACITY_TYPE_LABEL[discount.capacityType]} +${discount.unitAmount}`}
              discountType={discount.discountType}
              discountValue={discount.discountValue}
              canManage={canManage}
              isRemoving={removingId === discount.capacityAddOnId}
              onEdit={() => {
                setEditingAddOnId(discount.capacityAddOnId);
                setEditDraft({ discountType: discount.discountType, discountValue: discount.discountValue });
              }}
              onRemove={() => handleRemove(discount.capacityAddOnId)}
              onHistory={() => openHistory(discount.capacityAddOnId)}
            />
          ),
        )}
      </DiscountSubsection>

      <DiscountHistoryModal
        open={historyAddOnId !== null}
        onClose={() => setHistoryAddOnId(null)}
        title="용량 추가구매 할인 오버라이드 이력"
        isLoading={isHistoryLoading}
        entries={historyEntries}
      />
    </>
  );
};

// ---- 세 섹션이 공유하는 뼈대/필드 ----

const DiscountSubsection: FC<{
  title: string;
  canManage: boolean;
  isAddFormOpen: boolean;
  onOpenAddForm: () => void;
  addForm: ReactNode;
  isEmpty: boolean;
  emptyMessage: string;
  children: ReactNode;
}> = ({ title, canManage, isAddFormOpen, onOpenAddForm, addForm, isEmpty, emptyMessage, children }) => (
  <div className="border border-gray-100 rounded-md p-3">
    <div className="flex items-center justify-between mb-2">
      <h3 className="text-xs font-bold text-gray-700">{title}</h3>
      {canManage && !isAddFormOpen && (
        <button
          onClick={onOpenAddForm}
          className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-gray-950 text-white text-[11px] font-medium hover:bg-gray-800"
        >
          <Plus size={11} />
          오버라이드 추가
        </button>
      )}
    </div>

    {isAddFormOpen && <div className="mb-3 bg-gray-50 border border-gray-200 rounded-md p-3">{addForm}</div>}

    {isEmpty ? (
      <p className="text-xs text-gray-400 py-2">{emptyMessage}</p>
    ) : (
      <ul className="divide-y divide-gray-100">{children}</ul>
    )}
    {!canManage && <p className="mt-2 text-[11px] text-gray-400">오버라이드 설정/제거는 PLATFORM_OPS 이상만 가능합니다.</p>}
  </div>
);

const DiscountRow: FC<{
  label: string;
  discountType: DiscountType;
  discountValue: number;
  canManage: boolean;
  isRemoving: boolean;
  onEdit: () => void;
  onRemove: () => void;
  onHistory: () => void;
}> = ({ label, discountType, discountValue, canManage, isRemoving, onEdit, onRemove, onHistory }) => (
  <li className="py-2 flex items-center justify-between gap-2">
    <div>
      <span className="text-sm font-medium text-gray-950">{label}</span>
      <span className="ml-2 text-xs text-gray-500">할인 {formatDiscount(discountType, discountValue)}</span>
    </div>
    <div className="flex items-center gap-1 shrink-0">
      <button
        onClick={onHistory}
        className="flex items-center gap-1 px-2 py-1 rounded-md border border-gray-200 text-gray-500 text-[11px] font-medium hover:border-gray-400 hover:text-gray-950"
      >
        <History size={11} />
        이력
      </button>
      {canManage && (
        <>
          <button onClick={onEdit} className="px-2 py-1 rounded-md border border-gray-200 text-gray-600 text-[11px] font-medium hover:border-gray-400">
            수정
          </button>
          <button
            onClick={onRemove}
            disabled={isRemoving}
            className="flex items-center gap-1 px-2 py-1 rounded-md border border-gray-200 text-red-600 text-[11px] font-medium hover:border-red-300 disabled:opacity-50"
          >
            {isRemoving ? <Loader2 size={11} className="animate-spin" /> : <X size={11} />}
            제거
          </button>
        </>
      )}
    </div>
  </li>
);

/** 세 섹션이 공유하는 이력 팝업 — discountType/discountValue/removed/createdBy/createdAt만 있으면 어떤 항목의 이력이든 그린다. */
interface DiscountHistoryEntry {
  id: number;
  discountType: DiscountType;
  discountValue: number;
  removed: boolean;
  createdBy: number;
  createdAt: string;
}

const DiscountHistoryModal: FC<{
  open: boolean;
  onClose: () => void;
  title: string;
  isLoading: boolean;
  entries: DiscountHistoryEntry[];
}> = ({ open, onClose, title, isLoading, entries }) => (
  <Modal open={open} onClose={onClose} title={title} widthClassName="max-w-lg">
    {isLoading ? (
      <div className="flex items-center justify-center py-8 text-gray-400">
        <Loader2 size={20} className="animate-spin" />
      </div>
    ) : entries.length === 0 ? (
      <p className="text-sm text-gray-400">변경 이력이 없습니다.</p>
    ) : (
      <ul className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
        {entries.map((entry) => (
          <li key={entry.id} className="py-2">
            <div className="flex items-center gap-2">
              <p className="text-sm text-gray-950 font-medium">
                {entry.removed ? '오버라이드 제거' : `할인 ${formatDiscount(entry.discountType, entry.discountValue)}로 설정`}
              </p>
              {entry.removed && (
                <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-medium border bg-red-50 text-red-600 border-red-200">
                  제거됨
                </span>
              )}
            </div>
            {entry.removed && (
              <p className="text-xs text-gray-500 mt-0.5">제거 직전 값: {formatDiscount(entry.discountType, entry.discountValue)}</p>
            )}
            <p className="text-xs text-gray-400 mt-0.5">
              관리자 #{entry.createdBy} · {new Date(entry.createdAt).toLocaleString('ko-KR')}
            </p>
          </li>
        ))}
      </ul>
    )}
  </Modal>
);

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
