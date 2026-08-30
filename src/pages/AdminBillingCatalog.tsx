import { useEffect, useState } from 'react';
import type { FC, FormEvent, ReactNode } from 'react';
import { History, Loader2, Package, Pencil, Plus, Sparkles, X } from 'lucide-react';
import { ListContainer } from '../components/ListContainer';
import { Modal } from '../components/Modal';
import { useAuthStore } from '../store/useAuthStore';
import { useSnackbarStore } from '../store/useSnackbarStore';
import { api } from '../utils/api';
import { canManagePlatform } from '../utils/permissions';
import type {
  BillingPlanHistorySummary,
  BillingPlanSummary,
  CapacityAddOnHistorySummary,
  CapacityAddOnSummary,
  CapacityType,
  CreateBillingPlanRequest,
  CreateCapacityAddOnRequest,
  CreateOptionalFeatureRequest,
  DiscountType,
  OptionalFeatureCode,
  OptionalFeatureHistorySummary,
  OptionalFeatureSummary,
  UpdateBillingPlanRequest,
  UpdateCapacityAddOnRequest,
  UpdateOptionalFeatureRequest,
} from '../types';

const DISCOUNT_TYPE_OPTIONS: Array<{ value: DiscountType; label: string }> = [
  { value: 'PERCENT', label: '퍼센트' },
  { value: 'FIXED_AMOUNT', label: '정액' },
];

// VIDEO_ATTENDANCE(화상 참석)는 실제 효과 로직이 아직 없어(별도 트랙에서 검토 중) 이 화면에서는
// 다루지 않는다 — signstage-docs business/ceremony-billing-options-review.md 참고.
// TABLET_RENTAL(태블릿 대여)은 프로젝터 효과가 없는 순수 안내/표시용 옵션이라, 선택옵션 카탈로그를
// 전시화면/서명화면에 실제 효과를 내는 항목으로 좁히면서 신규 등록 대상에서 뺐다(2026-08-30) —
// signstage-docs business/optional-feature-display-scope-and-plan-capacity-addon-review.md 3장.
// 라벨 맵(OPTIONAL_FEATURE_CODE_LABEL 등)에는 이미 등록된 행을 계속 정상 표시해야 해서 남겨둔다.
const MANAGEABLE_OPTIONAL_FEATURE_CODES: OptionalFeatureCode[] = [
  'SIGNER_FIELD_ZOOM',
  'ALL_SIGNED_FIREWORKS',
];

const OPTIONAL_FEATURE_CODE_LABEL: Record<string, string> = {
  SIGNER_FIELD_ZOOM: '서명 하이라이트',
  ALL_SIGNED_FIREWORKS: '폭죽 효과',
  TABLET_RENTAL: '태블릿 대여',
};

/** 코드별 기본 프로젝터 효과값 — 새로 만들기 폼에서 코드를 고를 때 자동으로 맞춰준다(그래도 수동으로 바꿀 수 있다). */
const DEFAULT_PROJECTOR_EFFECT_BY_CODE: Record<string, boolean> = {
  SIGNER_FIELD_ZOOM: true,
  ALL_SIGNED_FIREWORKS: true,
  TABLET_RENTAL: false,
};

const CAPACITY_TYPE_OPTIONS: Array<{ value: CapacityType; label: string }> = [
  { value: 'SIGNERS', label: '서명자' },
  { value: 'TEMPLATES', label: '템플릿' },
  { value: 'TEST_EVENTS', label: '테스트 행사' },
  { value: 'REHEARSAL_EVENTS', label: '리허설 행사' },
  { value: 'MAIN_EVENTS', label: '본행사' },
  { value: 'TABLETS', label: '태블릿' },
];

const CAPACITY_TYPE_LABEL: Record<string, string> = Object.fromEntries(
  CAPACITY_TYPE_OPTIONS.map((option) => [option.value, option.label]),
);

const formatPrice = (value: number) => `${value.toLocaleString('ko-KR')}원`;

const formatDiscount = (discountType: DiscountType, discountValue: number) =>
  discountType === 'PERCENT' ? `${discountValue}%` : formatPrice(discountValue);

/** 세 섹션(플랜/선택옵션/용량 추가구매) 목록·수정 폼이 공유하는 사용여부 배지. */
const ActiveBadge: FC<{ active: boolean }> = ({ active }) => (
  <span
    className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium border ${
      active ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-gray-100 text-gray-500 border-gray-200'
    }`}
  >
    {active ? '사용' : '미사용'}
  </span>
);

/**
 * 세 섹션의 수정 폼이 공유하는 "사용 중" 경고 — signstage-docs
 * business/ceremony-billing-options-review.md 9장. 값을 바꿔도 이미 확정/구매한 건은
 * 스냅샷 고정이라 영향받지 않지만, 관리자가 몇 건에 영향을 주는지는 알 수 있게 보여준다.
 */
const UsageWarning: FC<{ count: number; itemLabel: string }> = ({ count, itemLabel }) =>
  count === 0 ? null : (
    <p className="mb-3 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
      이 {itemLabel}을(를) 이미 확정/구매해서 쓰고 있는 건이 {count}건 있습니다. 값을 바꿔도 그 건들은 확정/구매 시점 기준으로
      고정돼 있어 영향받지 않습니다.
    </p>
  );

/** 세 섹션이 공유하는 사용여부 편집 필드 — 수정 폼 안에서 체크박스 하나로 토글한다. */
const ActiveField: FC<{ active: boolean; disabled: boolean; onChange: (active: boolean) => void }> = ({
  active,
  disabled,
  onChange,
}) => (
  <Field label="사용여부">
    <label className="flex items-center gap-1.5 text-sm text-gray-700 h-[34px]">
      <input type="checkbox" checked={active} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      {active ? '사용' : '미사용(신규 선택/구매 대상에서 제외)'}
    </label>
  </Field>
);

/**
 * 선택옵션 전용 필드 — "이 옵션이 프로젝터(전시용) 화면에 실제로 효과를 내는 종류인지" 표시.
 * 분류 정보일 뿐 실제 동작은 프런트 projectorEffects.ts에 코드별로 구현돼 있어야 한다.
 */
const ProjectorEffectField: FC<{ checked: boolean; disabled: boolean; onChange: (checked: boolean) => void }> = ({
  checked,
  disabled,
  onChange,
}) => (
  <Field label="프로젝터 효과">
    <label className="flex items-center gap-1.5 text-sm text-gray-700 h-[34px]">
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      {checked ? '프로젝터 화면에 효과를 냄' : '프로젝터와 무관'}
    </label>
  </Field>
);

/**
 * 플랫폼 관리자용 행사 과금 카탈로그(플랜/선택옵션/용량 추가구매 상품) 관리 화면.
 * 조회는 PLATFORM_SUPPORT 이상 누구나, 등록/수정은 PLATFORM_OPS 이상만 할 수 있다
 * (최종 판단은 항상 백엔드가 하고, 여기서는 버튼을 안 보여주는 용도로만 `canManagePlatform`을 쓴다).
 *
 * - 수정 가능 필드는 가격/할인/이름/사용여부(플랜은 한도 4종·포함 선택옵션 구성, 용량
 *   추가구매는 unitAmount)다. `OptionalFeature.code`/`CapacityAddOn.capacityType`은 종류를
 *   규정하는 값이라 생성 후 불변이라 수정 폼에 없다(읽기 전용으로만 보여준다).
 * - `BillingPlan`에 묶인 선택옵션 구성(optionalFeatureIds)은 원래 생성 시점에만 정하고 불변이었으나,
 *   해제할 방법이 없다는 문제로 수정 폼에서도 통째로 교체할 수 있게 열었다(signstage-docs
 *   business/ceremony-billing-options-review.md 9장 후속). 이미 확정/진행 중인 행사는
 *   `CeremonyPlanHistoryOptionalFeature` 스냅샷으로 보호되어 이 변경에 영향받지 않는다.
 * - `BillingPlan`에는 구매 가능한 용량 추가구매 상품 구성(capacityAddOnIds)도 같은 방식으로
 *   생성/수정 폼에서 통째로 교체할 수 있다(안 A 큐레이션, 2026-08-30) — `optionalFeatureIds`와
 *   겉모습은 같지만 "무료 포함"이 아니라 "구매 후보로 고를 수 있는" 허용 목록이라는 뜻 차이가
 *   있어 화면 안내문을 따로 둔다. `CeremonyPlanHistoryCapacityAddOn` 스냅샷으로 진행 중인
 *   행사를 같은 방식으로 보호한다(signstage-docs
 *   business/optional-feature-display-scope-and-plan-capacity-addon-review.md 5장).
 * - VIDEO_ATTENDANCE는 이 화면에서 다루지 않는다(위 MANAGEABLE_OPTIONAL_FEATURE_CODES 참고).
 */
export const AdminBillingCatalog: FC = () => {
  const currentPlatformRole = useAuthStore((state) => state.platformAdmin?.platformRole);
  const canManage = canManagePlatform(currentPlatformRole);
  const showSnackbar = useSnackbarStore((state) => state.showSnackbar);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-gray-950 flex items-center gap-2">
          <Package size={20} className="text-gray-400" />
          과금 카탈로그
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          행사 과금 플랜/선택옵션/용량 추가구매 상품을 관리합니다. 등록/수정은 PLATFORM_OPS 이상만 할 수 있습니다.
        </p>
      </div>

      <BillingPlanSection canManage={canManage} showSnackbar={showSnackbar} />
      <OptionalFeatureSection canManage={canManage} showSnackbar={showSnackbar} />
      <CapacityAddOnSection canManage={canManage} showSnackbar={showSnackbar} />
    </div>
  );
};

interface SectionProps {
  canManage: boolean;
  showSnackbar: (message: string, variant: 'success' | 'error') => void;
}

const EMPTY_PLAN_DRAFT: CreateBillingPlanRequest = {
  name: '',
  supplyPrice: 0,
  salePrice: 0,
  discountType: 'PERCENT',
  discountValue: 0,
  maxSigners: 0,
  maxTemplates: 0,
  maxTestEvents: 0,
  maxRehearsalEvents: 0,
  maxMainEvents: 0,
  optionalFeatureIds: [],
  capacityAddOnIds: [],
};

const BillingPlanSection: FC<SectionProps> = ({ canManage, showSnackbar }) => {
  const [plans, setPlans] = useState<BillingPlanSummary[]>([]);
  const [features, setFeatures] = useState<OptionalFeatureSummary[]>([]);
  const [addOns, setAddOns] = useState<CapacityAddOnSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [isCreateFormOpen, setIsCreateFormOpen] = useState(false);
  const [createDraft, setCreateDraft] = useState<CreateBillingPlanRequest>(EMPTY_PLAN_DRAFT);
  const [isCreating, setIsCreating] = useState(false);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<UpdateBillingPlanRequest | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const [historyPlanId, setHistoryPlanId] = useState<number | null>(null);
  const [planHistory, setPlanHistory] = useState<BillingPlanHistorySummary[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);

  const fetchAll = async () => {
    const [plansResponse, featuresResponse, addOnsResponse] = await Promise.all([
      api.get('/billing-plans'),
      api.get('/optional-features'),
      api.get('/capacity-addons'),
    ]);
    return {
      plans: plansResponse.data as BillingPlanSummary[],
      features: featuresResponse.data as OptionalFeatureSummary[],
      addOns: addOnsResponse.data as CapacityAddOnSummary[],
    };
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchAll();
        if (!cancelled) {
          setPlans(data.plans);
          setFeatures(data.features);
          setAddOns(data.addOns);
        }
      } catch (err) {
        if (!cancelled) {
          showSnackbar(err instanceof Error ? err.message : '과금 플랜 목록을 불러오지 못했습니다.', 'error');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const featureName = (id: number) => features.find((f) => f.id === id)?.name ?? `#${id}`;

  // 용량 추가구매 상품 목록도 CapacityAddOnSection에서 이미 쓰는 "주용량 +수량 · 보조용량 +수량"
  // 라벨 조합을 그대로 재사용한다(운영현황 문서 6.5절 — 다섯 번째로 또 베끼지 않도록).
  const addOnLabel = (id: number) => {
    const addOn = addOns.find((a) => a.id === id);
    if (!addOn) return `#${id}`;
    const primary = `${CAPACITY_TYPE_LABEL[addOn.capacityType] ?? addOn.capacityType} +${addOn.unitAmount}`;
    if (!addOn.secondaryCapacityType) return primary;
    return `${primary} · ${CAPACITY_TYPE_LABEL[addOn.secondaryCapacityType] ?? addOn.secondaryCapacityType} +${addOn.secondaryUnitAmount}`;
  };

  // 선택옵션·용량 추가구매 상품은 각각 별도 섹션(OptionalFeatureSection/CapacityAddOnSection)에서
  // 등록/수정될 수 있어, 생성 폼을 열 때마다 목록을 새로 불러온다 — 마운트 시점 한 번만 불러오면
  // 다른 섹션에서 방금 만든 항목이 체크박스 목록에 안 보이는 문제가 생긴다.
  const handleOpenCreateForm = async () => {
    setIsCreateFormOpen(true);
    try {
      const data = await fetchAll();
      setFeatures(data.features);
      setAddOns(data.addOns);
    } catch (err) {
      showSnackbar(err instanceof Error ? err.message : '선택옵션/용량 추가구매 상품 목록을 불러오지 못했습니다.', 'error');
    }
  };

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!createDraft.name.trim()) {
      showSnackbar('플랜 이름을 입력해주세요.', 'error');
      return;
    }
    setIsCreating(true);
    try {
      await api.post('/platform-admin/billing-plans', { ...createDraft, name: createDraft.name.trim() });
      showSnackbar('과금 플랜을 등록했습니다.', 'success');
      setIsCreateFormOpen(false);
      setCreateDraft(EMPTY_PLAN_DRAFT);
      setPlans((await fetchAll()).plans);
    } catch (err) {
      showSnackbar(err instanceof Error ? err.message : '과금 플랜 등록에 실패했습니다.', 'error');
    } finally {
      setIsCreating(false);
    }
  };

  const startEdit = (plan: BillingPlanSummary) => {
    setEditingId(plan.id);
    setEditDraft({
      name: plan.name,
      supplyPrice: plan.supplyPrice,
      salePrice: plan.salePrice,
      discountType: plan.discountType,
      discountValue: plan.discountValue,
      maxSigners: plan.maxSigners,
      maxTemplates: plan.maxTemplates,
      maxTestEvents: plan.maxTestEvents,
      maxRehearsalEvents: plan.maxRehearsalEvents,
      maxMainEvents: plan.maxMainEvents,
      active: plan.active,
      optionalFeatureIds: plan.optionalFeatureIds,
      capacityAddOnIds: plan.capacityAddOnIds,
    });
  };

  const openHistory = async (planId: number) => {
    setHistoryPlanId(planId);
    setIsHistoryLoading(true);
    try {
      const response = await api.get(`/platform-admin/billing-plans/${planId}/history`);
      setPlanHistory(response.data as BillingPlanHistorySummary[]);
    } catch (err) {
      showSnackbar(err instanceof Error ? err.message : '변경 이력을 불러오지 못했습니다.', 'error');
    } finally {
      setIsHistoryLoading(false);
    }
  };

  const handleSaveEdit = async (planId: number) => {
    if (!editDraft) return;
    if (!editDraft.name.trim()) {
      showSnackbar('플랜 이름을 입력해주세요.', 'error');
      return;
    }
    setIsSavingEdit(true);
    try {
      await api.put(`/platform-admin/billing-plans/${planId}`, { ...editDraft, name: editDraft.name.trim() });
      showSnackbar('과금 플랜을 저장했습니다.', 'success');
      setEditingId(null);
      setEditDraft(null);
      setPlans((await fetchAll()).plans);
    } catch (err) {
      showSnackbar(err instanceof Error ? err.message : '과금 플랜 저장에 실패했습니다.', 'error');
    } finally {
      setIsSavingEdit(false);
    }
  };

  return (
    <section className="bg-white border border-gray-200 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold text-gray-950">과금 플랜</h2>
        {canManage && !isCreateFormOpen && (
          <button
            onClick={handleOpenCreateForm}
            className="flex items-center gap-1 px-3 py-1 rounded-md bg-gray-950 text-white text-xs font-medium hover:bg-gray-800"
          >
            <Plus size={12} />
            새로 만들기
          </button>
        )}
      </div>

      {isCreateFormOpen && (
        <form
          onSubmit={handleCreate}
          className="mb-4 bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3"
        >
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <Field label="이름">
              <input
                type="text"
                value={createDraft.name}
                onChange={(e) => setCreateDraft((prev) => ({ ...prev, name: e.target.value }))}
                disabled={isCreating}
                className={inputClass}
              />
            </Field>
            <Field label="공급가">
              <input
                type="number"
                min={0}
                value={createDraft.supplyPrice === 0 ? '' : createDraft.supplyPrice}
                onChange={(e) => setCreateDraft((prev) => ({ ...prev, supplyPrice: Number(e.target.value) }))}
                disabled={isCreating}
                className={inputClass}
              />
            </Field>
            <Field label="판매가">
              <input
                type="number"
                min={0}
                value={createDraft.salePrice === 0 ? '' : createDraft.salePrice}
                onChange={(e) => setCreateDraft((prev) => ({ ...prev, salePrice: Number(e.target.value) }))}
                disabled={isCreating}
                className={inputClass}
              />
            </Field>
            <Field label="할인 방식">
              <select
                value={createDraft.discountType}
                onChange={(e) => setCreateDraft((prev) => ({ ...prev, discountType: e.target.value as DiscountType }))}
                disabled={isCreating}
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
                value={createDraft.discountValue === 0 ? '' : createDraft.discountValue}
                onChange={(e) => setCreateDraft((prev) => ({ ...prev, discountValue: Number(e.target.value) }))}
                disabled={isCreating}
                className={inputClass}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <Field label="서명자 한도">
              <input
                type="number"
                min={0}
                value={createDraft.maxSigners === 0 ? '' : createDraft.maxSigners}
                onChange={(e) => setCreateDraft((prev) => ({ ...prev, maxSigners: Number(e.target.value) }))}
                disabled={isCreating}
                className={inputClass}
              />
            </Field>
            <Field label="템플릿 한도">
              <input
                type="number"
                min={0}
                value={createDraft.maxTemplates === 0 ? '' : createDraft.maxTemplates}
                onChange={(e) => setCreateDraft((prev) => ({ ...prev, maxTemplates: Number(e.target.value) }))}
                disabled={isCreating}
                className={inputClass}
              />
            </Field>
            <Field label="테스트 행사 한도">
              <input
                type="number"
                min={0}
                value={createDraft.maxTestEvents === 0 ? '' : createDraft.maxTestEvents}
                onChange={(e) => setCreateDraft((prev) => ({ ...prev, maxTestEvents: Number(e.target.value) }))}
                disabled={isCreating}
                className={inputClass}
              />
            </Field>
            <Field label="리허설 행사 한도">
              <input
                type="number"
                min={0}
                value={createDraft.maxRehearsalEvents === 0 ? '' : createDraft.maxRehearsalEvents}
                onChange={(e) => setCreateDraft((prev) => ({ ...prev, maxRehearsalEvents: Number(e.target.value) }))}
                disabled={isCreating}
                className={inputClass}
              />
            </Field>
            <Field label="본행사 한도">
              <input
                type="number"
                min={0}
                value={createDraft.maxMainEvents === 0 ? '' : createDraft.maxMainEvents}
                onChange={(e) => setCreateDraft((prev) => ({ ...prev, maxMainEvents: Number(e.target.value) }))}
                disabled={isCreating}
                className={inputClass}
              />
            </Field>
          </div>

          <div>
            <span className="block text-xs font-medium text-gray-500 mb-1">포함 선택옵션</span>
            {features.length === 0 ? (
              <p className="text-xs text-gray-400">등록된 선택옵션이 없습니다. 아래 선택옵션 섹션에서 먼저 등록해주세요.</p>
            ) : (
              <div className="flex flex-wrap gap-3">
                {features.map((feature) => (
                  <label key={feature.id} className="flex items-center gap-1.5 text-xs text-gray-700">
                    <input
                      type="checkbox"
                      checked={createDraft.optionalFeatureIds.includes(feature.id)}
                      disabled={isCreating}
                      onChange={(e) =>
                        setCreateDraft((prev) => ({
                          ...prev,
                          optionalFeatureIds: e.target.checked
                            ? [...prev.optionalFeatureIds, feature.id]
                            : prev.optionalFeatureIds.filter((id) => id !== feature.id),
                        }))
                      }
                    />
                    {feature.name}
                  </label>
                ))}
              </div>
            )}
            <p className="mt-1 text-xs text-gray-400">플랜에 묶을 선택옵션 구성은 이후 수정 화면에서도 통째로 바꿀 수 있습니다.</p>
          </div>

          <div>
            <span className="block text-xs font-medium text-gray-500 mb-1">구매 가능 용량 추가구매 상품</span>
            {addOns.length === 0 ? (
              <p className="text-xs text-gray-400">등록된 용량 추가구매 상품이 없습니다. 아래 용량 추가구매 섹션에서 먼저 등록해주세요.</p>
            ) : (
              <div className="flex flex-wrap gap-3">
                {addOns.map((addOn) => (
                  <label key={addOn.id} className="flex items-center gap-1.5 text-xs text-gray-700">
                    <input
                      type="checkbox"
                      checked={createDraft.capacityAddOnIds.includes(addOn.id)}
                      disabled={isCreating}
                      onChange={(e) =>
                        setCreateDraft((prev) => ({
                          ...prev,
                          capacityAddOnIds: e.target.checked
                            ? [...prev.capacityAddOnIds, addOn.id]
                            : prev.capacityAddOnIds.filter((id) => id !== addOn.id),
                        }))
                      }
                    />
                    {addOnLabel(addOn.id)}
                  </label>
                ))}
              </div>
            )}
            <p className="mt-1 text-xs text-gray-400">
              체크한 상품만 이 플랜의 행사가 구매할 수 있습니다(무료 포함 아님 — 여전히 사용자가 구매 요청하고 관리자가 승인해야 합니다).
            </p>
          </div>

          <FormActions
            isSaving={isCreating}
            savingLabel="등록 중..."
            saveLabel="등록"
            onCancel={() => {
              setIsCreateFormOpen(false);
              setCreateDraft(EMPTY_PLAN_DRAFT);
            }}
          />
        </form>
      )}

      <ListContainer isLoading={isLoading} isEmpty={plans.length === 0} emptyMessage="등록된 과금 플랜이 없습니다.">
        <table className="w-full text-sm">
          <thead className="text-gray-500 text-xs">
            <tr>
              <th className="text-left font-medium py-2 px-4">이름</th>
              <th className="text-left font-medium py-2">공급가/판매가</th>
              <th className="text-left font-medium py-2">할인</th>
              <th className="text-left font-medium py-2">한도(서명자/템플릿/테스트/리허설/본행사)</th>
              <th className="text-left font-medium py-2">포함 선택옵션</th>
              <th className="text-left font-medium py-2">구매 가능 추가구매 상품</th>
              <th className="text-left font-medium py-2">상태</th>
              <th className="text-right font-medium py-2 px-4">이력</th>
              {canManage && <th className="text-right font-medium py-2 px-4">처리</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {plans.map((plan) =>
              editingId === plan.id && editDraft ? (
                <tr key={plan.id} className="bg-gray-50">
                  <td colSpan={canManage ? 9 : 8} className="p-4">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3">
                      <Field label="이름">
                        <input
                          type="text"
                          value={editDraft.name}
                          onChange={(e) => setEditDraft((prev) => prev && { ...prev, name: e.target.value })}
                          disabled={isSavingEdit}
                          className={inputClass}
                        />
                      </Field>
                      <Field label="공급가">
                        <input
                          type="number"
                          min={0}
                          value={editDraft.supplyPrice === 0 ? '' : editDraft.supplyPrice}
                          onChange={(e) => setEditDraft((prev) => prev && { ...prev, supplyPrice: Number(e.target.value) })}
                          disabled={isSavingEdit}
                          className={inputClass}
                        />
                      </Field>
                      <Field label="판매가">
                        <input
                          type="number"
                          min={0}
                          value={editDraft.salePrice === 0 ? '' : editDraft.salePrice}
                          onChange={(e) => setEditDraft((prev) => prev && { ...prev, salePrice: Number(e.target.value) })}
                          disabled={isSavingEdit}
                          className={inputClass}
                        />
                      </Field>
                      <Field label="할인 방식">
                        <select
                          value={editDraft.discountType}
                          onChange={(e) =>
                            setEditDraft((prev) => prev && { ...prev, discountType: e.target.value as DiscountType })
                          }
                          disabled={isSavingEdit}
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
                          value={editDraft.discountValue === 0 ? '' : editDraft.discountValue}
                          onChange={(e) => setEditDraft((prev) => prev && { ...prev, discountValue: Number(e.target.value) })}
                          disabled={isSavingEdit}
                          className={inputClass}
                        />
                      </Field>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-3">
                      <Field label="서명자 한도">
                        <input
                          type="number"
                          min={0}
                          value={editDraft.maxSigners === 0 ? '' : editDraft.maxSigners}
                          onChange={(e) => setEditDraft((prev) => prev && { ...prev, maxSigners: Number(e.target.value) })}
                          disabled={isSavingEdit}
                          className={inputClass}
                        />
                      </Field>
                      <Field label="템플릿 한도">
                        <input
                          type="number"
                          min={0}
                          value={editDraft.maxTemplates === 0 ? '' : editDraft.maxTemplates}
                          onChange={(e) => setEditDraft((prev) => prev && { ...prev, maxTemplates: Number(e.target.value) })}
                          disabled={isSavingEdit}
                          className={inputClass}
                        />
                      </Field>
                      <Field label="테스트 행사 한도">
                        <input
                          type="number"
                          min={0}
                          value={editDraft.maxTestEvents === 0 ? '' : editDraft.maxTestEvents}
                          onChange={(e) => setEditDraft((prev) => prev && { ...prev, maxTestEvents: Number(e.target.value) })}
                          disabled={isSavingEdit}
                          className={inputClass}
                        />
                      </Field>
                      <Field label="리허설 행사 한도">
                        <input
                          type="number"
                          min={0}
                          value={editDraft.maxRehearsalEvents === 0 ? '' : editDraft.maxRehearsalEvents}
                          onChange={(e) => setEditDraft((prev) => prev && { ...prev, maxRehearsalEvents: Number(e.target.value) })}
                          disabled={isSavingEdit}
                          className={inputClass}
                        />
                      </Field>
                      <Field label="본행사 한도">
                        <input
                          type="number"
                          min={0}
                          value={editDraft.maxMainEvents === 0 ? '' : editDraft.maxMainEvents}
                          onChange={(e) => setEditDraft((prev) => prev && { ...prev, maxMainEvents: Number(e.target.value) })}
                          disabled={isSavingEdit}
                          className={inputClass}
                        />
                      </Field>
                      <ActiveField
                        active={editDraft.active}
                        disabled={isSavingEdit}
                        onChange={(active) => setEditDraft((prev) => prev && { ...prev, active })}
                      />
                    </div>
                    <div className="mb-3">
                      <span className="block text-xs font-medium text-gray-500 mb-1">포함 선택옵션</span>
                      {features.length === 0 ? (
                        <p className="text-xs text-gray-400">등록된 선택옵션이 없습니다.</p>
                      ) : (
                        <div className="flex flex-wrap gap-3">
                          {features.map((feature) => (
                            <label key={feature.id} className="flex items-center gap-1.5 text-xs text-gray-700">
                              <input
                                type="checkbox"
                                checked={editDraft.optionalFeatureIds.includes(feature.id)}
                                disabled={isSavingEdit}
                                onChange={(e) =>
                                  setEditDraft((prev) =>
                                    prev && {
                                      ...prev,
                                      optionalFeatureIds: e.target.checked
                                        ? [...prev.optionalFeatureIds, feature.id]
                                        : prev.optionalFeatureIds.filter((id) => id !== feature.id),
                                    }
                                  )
                                }
                              />
                              {feature.name}
                            </label>
                          ))}
                        </div>
                      )}
                      <p className="mt-1 text-xs text-gray-400">
                        이미 확정/구매해서 쓰고 있는 행사는 변경 시점 스냅샷 기준이라 영향받지 않습니다.
                      </p>
                    </div>
                    <div className="mb-3">
                      <span className="block text-xs font-medium text-gray-500 mb-1">구매 가능 용량 추가구매 상품</span>
                      {addOns.length === 0 ? (
                        <p className="text-xs text-gray-400">등록된 용량 추가구매 상품이 없습니다.</p>
                      ) : (
                        <div className="flex flex-wrap gap-3">
                          {addOns.map((addOn) => (
                            <label key={addOn.id} className="flex items-center gap-1.5 text-xs text-gray-700">
                              <input
                                type="checkbox"
                                checked={editDraft.capacityAddOnIds.includes(addOn.id)}
                                disabled={isSavingEdit}
                                onChange={(e) =>
                                  setEditDraft((prev) =>
                                    prev && {
                                      ...prev,
                                      capacityAddOnIds: e.target.checked
                                        ? [...prev.capacityAddOnIds, addOn.id]
                                        : prev.capacityAddOnIds.filter((id) => id !== addOn.id),
                                    }
                                  )
                                }
                              />
                              {addOnLabel(addOn.id)}
                            </label>
                          ))}
                        </div>
                      )}
                      <p className="mt-1 text-xs text-gray-400">
                        체크한 상품만 이 플랜의 행사가 구매할 수 있습니다(무료 포함 아님). 이미 진행 중인 행사는 플랜
                        확정/변경 시점 스냅샷 기준이라 영향받지 않습니다.
                      </p>
                    </div>
                    <UsageWarning count={plan.usageCount} itemLabel="플랜" />
                    <FormActions
                      isSaving={isSavingEdit}
                      savingLabel="저장 중..."
                      saveLabel="저장"
                      onSave={() => handleSaveEdit(plan.id)}
                      onCancel={() => {
                        setEditingId(null);
                        setEditDraft(null);
                      }}
                    />
                  </td>
                </tr>
              ) : (
                <tr key={plan.id}>
                  <td className="py-2 px-4 text-gray-950 font-medium">{plan.name}</td>
                  <td className="py-2">
                    {formatPrice(plan.supplyPrice)} / {formatPrice(plan.salePrice)}
                  </td>
                  <td className="py-2">{formatDiscount(plan.discountType, plan.discountValue)}</td>
                  <td className="py-2 text-gray-600">
                    {plan.maxSigners}/{plan.maxTemplates}/{plan.maxTestEvents}/{plan.maxRehearsalEvents}/{plan.maxMainEvents}
                  </td>
                  <td className="py-2 text-gray-600">{plan.optionalFeatureIds.map(featureName).join(', ') || '-'}</td>
                  <td className="py-2 text-gray-600">{plan.capacityAddOnIds.map(addOnLabel).join(', ') || '-'}</td>
                  <td className="py-2">
                    <ActiveBadge active={plan.active} />
                    <span className="ml-1.5 text-xs text-gray-400">사용 {plan.usageCount}건</span>
                  </td>
                  <td className="py-2 px-4 text-right">
                    <button
                      onClick={() => openHistory(plan.id)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-gray-200 text-gray-500 text-xs font-medium hover:border-gray-400 hover:text-gray-950"
                    >
                      <History size={12} />
                      이력
                    </button>
                  </td>
                  {canManage && (
                    <td className="py-2 px-4 text-right">
                      <button
                        onClick={() => startEdit(plan)}
                        disabled={editingId !== null}
                        className="inline-flex items-center gap-1 px-3 py-1 rounded-md border border-gray-200 text-gray-600 text-xs font-medium hover:border-gray-400 disabled:opacity-50"
                      >
                        <Pencil size={12} />
                        수정
                      </button>
                    </td>
                  )}
                </tr>
              ),
            )}
          </tbody>
        </table>
      </ListContainer>

      <Modal
        open={historyPlanId !== null}
        onClose={() => setHistoryPlanId(null)}
        title="과금 플랜 변경 이력"
        widthClassName="max-w-lg"
      >
        {isHistoryLoading ? (
          <div className="flex items-center justify-center py-8 text-gray-400">
            <Loader2 size={20} className="animate-spin" />
          </div>
        ) : planHistory.length === 0 ? (
          <p className="text-sm text-gray-400">변경 이력이 없습니다.</p>
        ) : (
          <ul className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
            {planHistory.map((history) => (
              <li key={history.id} className="py-2">
                <div className="flex items-center gap-2">
                  <p className="text-sm text-gray-950 font-medium">{history.name}</p>
                  <ActiveBadge active={history.active} />
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  {formatPrice(history.salePrice)} · 서명자 {history.maxSigners}명 · 템플릿 {history.maxTemplates}건 ·
                  테스트 {history.maxTestEvents}건 · 리허설 {history.maxRehearsalEvents}건 · 본행사 {history.maxMainEvents}건
                </p>
                <p className="text-xs text-gray-400 mt-0.5">{new Date(history.createdAt).toLocaleString('ko-KR')}</p>
              </li>
            ))}
          </ul>
        )}
      </Modal>
    </section>
  );
};

const EMPTY_FEATURE_DRAFT: CreateOptionalFeatureRequest = {
  code: 'SIGNER_FIELD_ZOOM',
  name: '',
  supplyPrice: 0,
  salePrice: 0,
  discountType: 'PERCENT',
  discountValue: 0,
  projectorEffect: true,
  exclusivityGroup: '',
};

/** 빈 문자열 입력을 "그룹 없음"(null)으로 정규화한다 — 폼 입력값은 항상 문자열로 다루는 게 controlled input에 편해서다. */
const normalizeExclusivityGroup = (value: string | null | undefined): string | null => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

const OptionalFeatureSection: FC<SectionProps> = ({ canManage, showSnackbar }) => {
  const [features, setFeatures] = useState<OptionalFeatureSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [isCreateFormOpen, setIsCreateFormOpen] = useState(false);
  const [createDraft, setCreateDraft] = useState<CreateOptionalFeatureRequest>(EMPTY_FEATURE_DRAFT);
  const [isCreating, setIsCreating] = useState(false);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<UpdateOptionalFeatureRequest | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const [historyFeatureId, setHistoryFeatureId] = useState<number | null>(null);
  const [featureHistory, setFeatureHistory] = useState<OptionalFeatureHistorySummary[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);

  const fetchFeatures = async () => {
    const response = await api.get('/optional-features');
    return (response.data as OptionalFeatureSummary[]).filter((f) =>
      MANAGEABLE_OPTIONAL_FEATURE_CODES.includes(f.code),
    );
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchFeatures();
        if (!cancelled) setFeatures(data);
      } catch (err) {
        if (!cancelled) {
          showSnackbar(err instanceof Error ? err.message : '선택옵션 목록을 불러오지 못했습니다.', 'error');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const availableCodes = MANAGEABLE_OPTIONAL_FEATURE_CODES.filter(
    (code) => !features.some((f) => f.code === code),
  );

  const handleOpenCreateForm = () => {
    const code = availableCodes[0];
    setCreateDraft({
      ...EMPTY_FEATURE_DRAFT,
      code,
      projectorEffect: DEFAULT_PROJECTOR_EFFECT_BY_CODE[code] ?? true,
    });
    setIsCreateFormOpen(true);
  };

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!createDraft.name.trim()) {
      showSnackbar('선택옵션 이름을 입력해주세요.', 'error');
      return;
    }
    setIsCreating(true);
    try {
      await api.post('/platform-admin/optional-features', {
        ...createDraft,
        name: createDraft.name.trim(),
        exclusivityGroup: normalizeExclusivityGroup(createDraft.exclusivityGroup),
      });
      showSnackbar('선택옵션을 등록했습니다.', 'success');
      setIsCreateFormOpen(false);
      setCreateDraft(EMPTY_FEATURE_DRAFT);
      setFeatures(await fetchFeatures());
    } catch (err) {
      showSnackbar(err instanceof Error ? err.message : '선택옵션 등록에 실패했습니다.', 'error');
    } finally {
      setIsCreating(false);
    }
  };

  const startEdit = (feature: OptionalFeatureSummary) => {
    setEditingId(feature.id);
    setEditDraft({
      name: feature.name,
      supplyPrice: feature.supplyPrice,
      salePrice: feature.salePrice,
      discountType: feature.discountType,
      discountValue: feature.discountValue,
      active: feature.active,
      projectorEffect: feature.projectorEffect,
      exclusivityGroup: feature.exclusivityGroup ?? '',
    });
  };

  const openHistory = async (featureId: number) => {
    setHistoryFeatureId(featureId);
    setIsHistoryLoading(true);
    try {
      const response = await api.get(`/platform-admin/optional-features/${featureId}/history`);
      setFeatureHistory(response.data as OptionalFeatureHistorySummary[]);
    } catch (err) {
      showSnackbar(err instanceof Error ? err.message : '변경 이력을 불러오지 못했습니다.', 'error');
    } finally {
      setIsHistoryLoading(false);
    }
  };

  const handleSaveEdit = async (featureId: number) => {
    if (!editDraft) return;
    if (!editDraft.name.trim()) {
      showSnackbar('선택옵션 이름을 입력해주세요.', 'error');
      return;
    }
    setIsSavingEdit(true);
    try {
      await api.put(`/platform-admin/optional-features/${featureId}`, {
        ...editDraft,
        name: editDraft.name.trim(),
        exclusivityGroup: normalizeExclusivityGroup(editDraft.exclusivityGroup),
      });
      showSnackbar('선택옵션을 저장했습니다.', 'success');
      setEditingId(null);
      setEditDraft(null);
      setFeatures(await fetchFeatures());
    } catch (err) {
      showSnackbar(err instanceof Error ? err.message : '선택옵션 저장에 실패했습니다.', 'error');
    } finally {
      setIsSavingEdit(false);
    }
  };

  return (
    <section className="bg-white border border-gray-200 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold text-gray-950 flex items-center gap-1.5">
          <Sparkles size={14} />
          선택옵션
        </h2>
        {canManage && !isCreateFormOpen && (
          <button
            onClick={handleOpenCreateForm}
            disabled={availableCodes.length === 0}
            className="flex items-center gap-1 px-3 py-1 rounded-md bg-gray-950 text-white text-xs font-medium hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Plus size={12} />
            새로 만들기
          </button>
        )}
      </div>

      {canManage && !isCreateFormOpen && availableCodes.length === 0 && (
        <p className="mb-3 text-xs text-gray-400">추가 가능한 옵션이 없습니다.</p>
      )}

      {isCreateFormOpen && (
        <form onSubmit={handleCreate} className="mb-4 bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <Field label="코드">
              <select
                value={createDraft.code}
                onChange={(e) => {
                  const code = e.target.value as OptionalFeatureCode;
                  setCreateDraft((prev) => ({
                    ...prev,
                    code,
                    projectorEffect: DEFAULT_PROJECTOR_EFFECT_BY_CODE[code] ?? prev.projectorEffect,
                  }));
                }}
                disabled={isCreating}
                className={inputClass}
              >
                {availableCodes.map((code) => (
                  <option key={code} value={code}>
                    {OPTIONAL_FEATURE_CODE_LABEL[code] ?? code}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="이름">
              <input
                type="text"
                value={createDraft.name}
                onChange={(e) => setCreateDraft((prev) => ({ ...prev, name: e.target.value }))}
                disabled={isCreating}
                className={inputClass}
              />
            </Field>
            <Field label="공급가">
              <input
                type="number"
                min={0}
                value={createDraft.supplyPrice === 0 ? '' : createDraft.supplyPrice}
                onChange={(e) => setCreateDraft((prev) => ({ ...prev, supplyPrice: Number(e.target.value) }))}
                disabled={isCreating}
                className={inputClass}
              />
            </Field>
            <Field label="판매가">
              <input
                type="number"
                min={0}
                value={createDraft.salePrice === 0 ? '' : createDraft.salePrice}
                onChange={(e) => setCreateDraft((prev) => ({ ...prev, salePrice: Number(e.target.value) }))}
                disabled={isCreating}
                className={inputClass}
              />
            </Field>
            <Field label="할인 방식">
              <select
                value={createDraft.discountType}
                onChange={(e) => setCreateDraft((prev) => ({ ...prev, discountType: e.target.value as DiscountType }))}
                disabled={isCreating}
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
                value={createDraft.discountValue === 0 ? '' : createDraft.discountValue}
                onChange={(e) => setCreateDraft((prev) => ({ ...prev, discountValue: Number(e.target.value) }))}
                disabled={isCreating}
                className={inputClass}
              />
            </Field>
            <ProjectorEffectField
              checked={createDraft.projectorEffect ?? true}
              disabled={isCreating}
              onChange={(projectorEffect) => setCreateDraft((prev) => ({ ...prev, projectorEffect }))}
            />
            <Field label="배타 그룹">
              <input
                type="text"
                value={createDraft.exclusivityGroup ?? ''}
                onChange={(e) => setCreateDraft((prev) => ({ ...prev, exclusivityGroup: e.target.value }))}
                disabled={isCreating}
                placeholder="예: SIGNER_HIGHLIGHT_COLOR"
                className={inputClass}
              />
            </Field>
          </div>
          <p className="text-xs text-gray-400">
            배타 그룹에 같은 값을 넣으면, 그 값을 공유하는 옵션들은 하위 행사 하나에 동시 적용할 수 없습니다(예:
            서명 하이라이트 색상 옵션 여러 개 중 하나만 고르게 하고 싶을 때).
          </p>
          <FormActions
            isSaving={isCreating}
            savingLabel="등록 중..."
            saveLabel="등록"
            onCancel={() => {
              setIsCreateFormOpen(false);
              setCreateDraft(EMPTY_FEATURE_DRAFT);
            }}
          />
        </form>
      )}

      <ListContainer isLoading={isLoading} isEmpty={features.length === 0} emptyMessage="등록된 선택옵션이 없습니다.">
        <table className="w-full text-sm">
          <thead className="text-gray-500 text-xs">
            <tr>
              <th className="text-left font-medium py-2 px-4">코드</th>
              <th className="text-left font-medium py-2">이름</th>
              <th className="text-left font-medium py-2">공급가/판매가</th>
              <th className="text-left font-medium py-2">할인</th>
              <th className="text-left font-medium py-2">상태</th>
              <th className="text-left font-medium py-2">분류</th>
              <th className="text-right font-medium py-2 px-4">이력</th>
              {canManage && <th className="text-right font-medium py-2 px-4">처리</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {features.map((feature) =>
              editingId === feature.id && editDraft ? (
                <tr key={feature.id} className="bg-gray-50">
                  <td colSpan={canManage ? 8 : 7} className="p-4">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3">
                      <Field label="코드(읽기 전용)">
                        <input
                          type="text"
                          value={OPTIONAL_FEATURE_CODE_LABEL[feature.code] ?? feature.code}
                          disabled
                          className={`${inputClass} bg-gray-100 text-gray-400`}
                        />
                      </Field>
                      <Field label="이름">
                        <input
                          type="text"
                          value={editDraft.name}
                          onChange={(e) => setEditDraft((prev) => prev && { ...prev, name: e.target.value })}
                          disabled={isSavingEdit}
                          className={inputClass}
                        />
                      </Field>
                      <Field label="공급가">
                        <input
                          type="number"
                          min={0}
                          value={editDraft.supplyPrice === 0 ? '' : editDraft.supplyPrice}
                          onChange={(e) => setEditDraft((prev) => prev && { ...prev, supplyPrice: Number(e.target.value) })}
                          disabled={isSavingEdit}
                          className={inputClass}
                        />
                      </Field>
                      <Field label="판매가">
                        <input
                          type="number"
                          min={0}
                          value={editDraft.salePrice === 0 ? '' : editDraft.salePrice}
                          onChange={(e) => setEditDraft((prev) => prev && { ...prev, salePrice: Number(e.target.value) })}
                          disabled={isSavingEdit}
                          className={inputClass}
                        />
                      </Field>
                      <Field label="할인 방식">
                        <select
                          value={editDraft.discountType}
                          onChange={(e) =>
                            setEditDraft((prev) => prev && { ...prev, discountType: e.target.value as DiscountType })
                          }
                          disabled={isSavingEdit}
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
                          value={editDraft.discountValue === 0 ? '' : editDraft.discountValue}
                          onChange={(e) => setEditDraft((prev) => prev && { ...prev, discountValue: Number(e.target.value) })}
                          disabled={isSavingEdit}
                          className={inputClass}
                        />
                      </Field>
                      <ActiveField
                        active={editDraft.active}
                        disabled={isSavingEdit}
                        onChange={(active) => setEditDraft((prev) => prev && { ...prev, active })}
                      />
                      <ProjectorEffectField
                        checked={editDraft.projectorEffect}
                        disabled={isSavingEdit}
                        onChange={(projectorEffect) => setEditDraft((prev) => prev && { ...prev, projectorEffect })}
                      />
                      <Field label="배타 그룹">
                        <input
                          type="text"
                          value={editDraft.exclusivityGroup ?? ''}
                          onChange={(e) => setEditDraft((prev) => prev && { ...prev, exclusivityGroup: e.target.value })}
                          disabled={isSavingEdit}
                          placeholder="예: SIGNER_HIGHLIGHT_COLOR"
                          className={inputClass}
                        />
                      </Field>
                    </div>
                    <UsageWarning count={feature.usageCount} itemLabel="선택옵션" />
                    <FormActions
                      isSaving={isSavingEdit}
                      savingLabel="저장 중..."
                      saveLabel="저장"
                      onSave={() => handleSaveEdit(feature.id)}
                      onCancel={() => {
                        setEditingId(null);
                        setEditDraft(null);
                      }}
                    />
                  </td>
                </tr>
              ) : (
                <tr key={feature.id}>
                  <td className="py-2 px-4 text-gray-600">{OPTIONAL_FEATURE_CODE_LABEL[feature.code] ?? feature.code}</td>
                  <td className="py-2 text-gray-950 font-medium">{feature.name}</td>
                  <td className="py-2">
                    {formatPrice(feature.supplyPrice)} / {formatPrice(feature.salePrice)}
                  </td>
                  <td className="py-2">{formatDiscount(feature.discountType, feature.discountValue)}</td>
                  <td className="py-2">
                    <ActiveBadge active={feature.active} />
                    <span className="ml-1.5 text-xs text-gray-400">사용 {feature.usageCount}건</span>
                  </td>
                  <td className="py-2 text-xs">
                    <div className="text-gray-600">{feature.projectorEffect ? '프로젝터 효과' : '프로젝터 무관'}</div>
                    {feature.exclusivityGroup && (
                      <div className="mt-0.5 text-gray-400">배타 그룹: {feature.exclusivityGroup}</div>
                    )}
                  </td>
                  <td className="py-2 px-4 text-right">
                    <button
                      onClick={() => openHistory(feature.id)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-gray-200 text-gray-500 text-xs font-medium hover:border-gray-400 hover:text-gray-950"
                    >
                      <History size={12} />
                      이력
                    </button>
                  </td>
                  {canManage && (
                    <td className="py-2 px-4 text-right">
                      <button
                        onClick={() => startEdit(feature)}
                        disabled={editingId !== null}
                        className="inline-flex items-center gap-1 px-3 py-1 rounded-md border border-gray-200 text-gray-600 text-xs font-medium hover:border-gray-400 disabled:opacity-50"
                      >
                        <Pencil size={12} />
                        수정
                      </button>
                    </td>
                  )}
                </tr>
              ),
            )}
          </tbody>
        </table>
      </ListContainer>

      <Modal
        open={historyFeatureId !== null}
        onClose={() => setHistoryFeatureId(null)}
        title="선택옵션 변경 이력"
        widthClassName="max-w-lg"
      >
        {isHistoryLoading ? (
          <div className="flex items-center justify-center py-8 text-gray-400">
            <Loader2 size={20} className="animate-spin" />
          </div>
        ) : featureHistory.length === 0 ? (
          <p className="text-sm text-gray-400">변경 이력이 없습니다.</p>
        ) : (
          <ul className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
            {featureHistory.map((history) => (
              <li key={history.id} className="py-2">
                <div className="flex items-center gap-2">
                  <p className="text-sm text-gray-950 font-medium">{history.name}</p>
                  <ActiveBadge active={history.active} />
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  {OPTIONAL_FEATURE_CODE_LABEL[history.code] ?? history.code} · {formatPrice(history.salePrice)} ·{' '}
                  할인 {formatDiscount(history.discountType, history.discountValue)}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {history.projectorEffect ? '프로젝터 효과' : '프로젝터 무관'}
                  {history.exclusivityGroup && ` · 배타 그룹: ${history.exclusivityGroup}`}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">{new Date(history.createdAt).toLocaleString('ko-KR')}</p>
              </li>
            ))}
          </ul>
        )}
      </Modal>
    </section>
  );
};

const EMPTY_ADDON_DRAFT: CreateCapacityAddOnRequest = {
  capacityType: 'SIGNERS',
  unitAmount: 1,
  secondaryCapacityType: null,
  secondaryUnitAmount: null,
  supplyPrice: 0,
  salePrice: 0,
  discountType: 'PERCENT',
  discountValue: 0,
};

const CapacityAddOnSection: FC<SectionProps> = ({ canManage, showSnackbar }) => {
  const [addOns, setAddOns] = useState<CapacityAddOnSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [isCreateFormOpen, setIsCreateFormOpen] = useState(false);
  const [createDraft, setCreateDraft] = useState<CreateCapacityAddOnRequest>(EMPTY_ADDON_DRAFT);
  const [isCreating, setIsCreating] = useState(false);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<UpdateCapacityAddOnRequest | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const [historyAddOnId, setHistoryAddOnId] = useState<number | null>(null);
  const [addOnHistory, setAddOnHistory] = useState<CapacityAddOnHistorySummary[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);

  const fetchAddOns = async () => {
    const response = await api.get('/capacity-addons');
    return response.data as CapacityAddOnSummary[];
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchAddOns();
        if (!cancelled) setAddOns(data);
      } catch (err) {
        if (!cancelled) {
          showSnackbar(err instanceof Error ? err.message : '용량 추가구매 상품 목록을 불러오지 못했습니다.', 'error');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (createDraft.unitAmount < 1) {
      showSnackbar('단위 수량은 1 이상이어야 합니다.', 'error');
      return;
    }
    if (createDraft.secondaryCapacityType && (!createDraft.secondaryUnitAmount || createDraft.secondaryUnitAmount < 1)) {
      showSnackbar('보조 단위 수량은 1 이상이어야 합니다.', 'error');
      return;
    }
    setIsCreating(true);
    try {
      await api.post('/platform-admin/capacity-addons', createDraft);
      showSnackbar('용량 추가구매 상품을 등록했습니다.', 'success');
      setIsCreateFormOpen(false);
      setCreateDraft(EMPTY_ADDON_DRAFT);
      setAddOns(await fetchAddOns());
    } catch (err) {
      showSnackbar(err instanceof Error ? err.message : '용량 추가구매 상품 등록에 실패했습니다.', 'error');
    } finally {
      setIsCreating(false);
    }
  };

  const startEdit = (addOn: CapacityAddOnSummary) => {
    setEditingId(addOn.id);
    setEditDraft({
      unitAmount: addOn.unitAmount,
      secondaryUnitAmount: addOn.secondaryUnitAmount,
      supplyPrice: addOn.supplyPrice,
      salePrice: addOn.salePrice,
      discountType: addOn.discountType,
      discountValue: addOn.discountValue,
      active: addOn.active,
    });
  };

  const openHistory = async (addOnId: number) => {
    setHistoryAddOnId(addOnId);
    setIsHistoryLoading(true);
    try {
      const response = await api.get(`/platform-admin/capacity-addons/${addOnId}/history`);
      setAddOnHistory(response.data as CapacityAddOnHistorySummary[]);
    } catch (err) {
      showSnackbar(err instanceof Error ? err.message : '변경 이력을 불러오지 못했습니다.', 'error');
    } finally {
      setIsHistoryLoading(false);
    }
  };

  const handleSaveEdit = async (addOnId: number) => {
    if (!editDraft) return;
    if (editDraft.unitAmount < 1) {
      showSnackbar('단위 수량은 1 이상이어야 합니다.', 'error');
      return;
    }
    const addOn = addOns.find((a) => a.id === addOnId);
    if (addOn?.secondaryCapacityType && (!editDraft.secondaryUnitAmount || editDraft.secondaryUnitAmount < 1)) {
      showSnackbar('보조 단위 수량은 1 이상이어야 합니다.', 'error');
      return;
    }
    setIsSavingEdit(true);
    try {
      await api.put(`/platform-admin/capacity-addons/${addOnId}`, editDraft);
      showSnackbar('용량 추가구매 상품을 저장했습니다.', 'success');
      setEditingId(null);
      setEditDraft(null);
      setAddOns(await fetchAddOns());
    } catch (err) {
      showSnackbar(err instanceof Error ? err.message : '용량 추가구매 상품 저장에 실패했습니다.', 'error');
    } finally {
      setIsSavingEdit(false);
    }
  };

  return (
    <section className="bg-white border border-gray-200 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold text-gray-950">용량 추가구매 상품</h2>
        {canManage && !isCreateFormOpen && (
          <button
            onClick={() => setIsCreateFormOpen(true)}
            className="flex items-center gap-1 px-3 py-1 rounded-md bg-gray-950 text-white text-xs font-medium hover:bg-gray-800"
          >
            <Plus size={12} />
            새로 만들기
          </button>
        )}
      </div>

      {isCreateFormOpen && (
        <form onSubmit={handleCreate} className="mb-4 bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <Field label="종류">
              <select
                value={createDraft.capacityType}
                onChange={(e) => {
                  const capacityType = e.target.value as CapacityType;
                  setCreateDraft((prev) => ({
                    ...prev,
                    capacityType,
                    // 주 용량을 보조 용량과 같은 값으로 바꾸면 묶음 설정을 초기화한다.
                    secondaryCapacityType: prev.secondaryCapacityType === capacityType ? null : prev.secondaryCapacityType,
                    secondaryUnitAmount: prev.secondaryCapacityType === capacityType ? null : prev.secondaryUnitAmount,
                  }));
                }}
                disabled={isCreating}
                className={inputClass}
              >
                {CAPACITY_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="단위 수량">
              <input
                type="number"
                min={1}
                value={createDraft.unitAmount === 0 ? '' : createDraft.unitAmount}
                onChange={(e) => setCreateDraft((prev) => ({ ...prev, unitAmount: Number(e.target.value) }))}
                disabled={isCreating}
                className={inputClass}
              />
            </Field>
            <Field label="보조 용량(묶음 상품, 선택)">
              <select
                value={createDraft.secondaryCapacityType ?? ''}
                onChange={(e) => {
                  const value = e.target.value as CapacityType | '';
                  setCreateDraft((prev) => ({
                    ...prev,
                    secondaryCapacityType: value === '' ? null : value,
                    secondaryUnitAmount: value === '' ? null : prev.secondaryUnitAmount || 1,
                  }));
                }}
                disabled={isCreating}
                className={inputClass}
              >
                <option value="">없음(단일 상품)</option>
                {CAPACITY_TYPE_OPTIONS.filter((option) => option.value !== createDraft.capacityType).map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>
            {createDraft.secondaryCapacityType && (
              <Field label="보조 단위 수량">
                <input
                  type="number"
                  min={1}
                  value={createDraft.secondaryUnitAmount ? createDraft.secondaryUnitAmount : ''}
                  onChange={(e) => setCreateDraft((prev) => ({ ...prev, secondaryUnitAmount: Number(e.target.value) }))}
                  disabled={isCreating}
                  className={inputClass}
                />
              </Field>
            )}
            <Field label="공급가">
              <input
                type="number"
                min={0}
                value={createDraft.supplyPrice === 0 ? '' : createDraft.supplyPrice}
                onChange={(e) => setCreateDraft((prev) => ({ ...prev, supplyPrice: Number(e.target.value) }))}
                disabled={isCreating}
                className={inputClass}
              />
            </Field>
            <Field label="판매가">
              <input
                type="number"
                min={0}
                value={createDraft.salePrice === 0 ? '' : createDraft.salePrice}
                onChange={(e) => setCreateDraft((prev) => ({ ...prev, salePrice: Number(e.target.value) }))}
                disabled={isCreating}
                className={inputClass}
              />
            </Field>
            <Field label="할인 방식">
              <select
                value={createDraft.discountType}
                onChange={(e) => setCreateDraft((prev) => ({ ...prev, discountType: e.target.value as DiscountType }))}
                disabled={isCreating}
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
                value={createDraft.discountValue === 0 ? '' : createDraft.discountValue}
                onChange={(e) => setCreateDraft((prev) => ({ ...prev, discountValue: Number(e.target.value) }))}
                disabled={isCreating}
                className={inputClass}
              />
            </Field>
          </div>
          <p className="text-xs text-gray-400">
            보조 용량을 지정하면 이 상품 1건 구매로 두 용량이 함께 늘어나는 묶음 상품이 됩니다(예: "서명자+태블릿" =
            주 용량 서명자, 보조 용량 태블릿). 묶음 여부와 보조 용량 종류는 등록 후 바꿀 수 없습니다.
          </p>
          <FormActions
            isSaving={isCreating}
            savingLabel="등록 중..."
            saveLabel="등록"
            onCancel={() => {
              setIsCreateFormOpen(false);
              setCreateDraft(EMPTY_ADDON_DRAFT);
            }}
          />
        </form>
      )}

      <ListContainer isLoading={isLoading} isEmpty={addOns.length === 0} emptyMessage="등록된 용량 추가구매 상품이 없습니다.">
        <table className="w-full text-sm">
          <thead className="text-gray-500 text-xs">
            <tr>
              <th className="text-left font-medium py-2 px-4">종류</th>
              <th className="text-left font-medium py-2">단위 수량</th>
              <th className="text-left font-medium py-2">공급가/판매가</th>
              <th className="text-left font-medium py-2">할인</th>
              <th className="text-left font-medium py-2">상태</th>
              <th className="text-right font-medium py-2 px-4">이력</th>
              {canManage && <th className="text-right font-medium py-2 px-4">처리</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {addOns.map((addOn) =>
              editingId === addOn.id && editDraft ? (
                <tr key={addOn.id} className="bg-gray-50">
                  <td colSpan={canManage ? 7 : 6} className="p-4">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3">
                      <Field label="종류(읽기 전용)">
                        <input
                          type="text"
                          value={CAPACITY_TYPE_LABEL[addOn.capacityType] ?? addOn.capacityType}
                          disabled
                          className={`${inputClass} bg-gray-100 text-gray-400`}
                        />
                      </Field>
                      <Field label="단위 수량">
                        <input
                          type="number"
                          min={1}
                          value={editDraft.unitAmount === 0 ? '' : editDraft.unitAmount}
                          onChange={(e) => setEditDraft((prev) => prev && { ...prev, unitAmount: Number(e.target.value) })}
                          disabled={isSavingEdit}
                          className={inputClass}
                        />
                      </Field>
                      {addOn.secondaryCapacityType && (
                        <>
                          <Field label="보조 용량(읽기 전용)">
                            <input
                              type="text"
                              value={`${CAPACITY_TYPE_LABEL[addOn.secondaryCapacityType] ?? addOn.secondaryCapacityType} (묶음 상품)`}
                              disabled
                              className={`${inputClass} bg-gray-100 text-gray-400`}
                            />
                          </Field>
                          <Field label="보조 단위 수량">
                            <input
                              type="number"
                              min={1}
                              value={editDraft.secondaryUnitAmount ? editDraft.secondaryUnitAmount : ''}
                              onChange={(e) =>
                                setEditDraft((prev) => prev && { ...prev, secondaryUnitAmount: Number(e.target.value) })
                              }
                              disabled={isSavingEdit}
                              className={inputClass}
                            />
                          </Field>
                        </>
                      )}
                      <Field label="공급가">
                        <input
                          type="number"
                          min={0}
                          value={editDraft.supplyPrice === 0 ? '' : editDraft.supplyPrice}
                          onChange={(e) => setEditDraft((prev) => prev && { ...prev, supplyPrice: Number(e.target.value) })}
                          disabled={isSavingEdit}
                          className={inputClass}
                        />
                      </Field>
                      <Field label="판매가">
                        <input
                          type="number"
                          min={0}
                          value={editDraft.salePrice === 0 ? '' : editDraft.salePrice}
                          onChange={(e) => setEditDraft((prev) => prev && { ...prev, salePrice: Number(e.target.value) })}
                          disabled={isSavingEdit}
                          className={inputClass}
                        />
                      </Field>
                      <Field label="할인 방식">
                        <select
                          value={editDraft.discountType}
                          onChange={(e) =>
                            setEditDraft((prev) => prev && { ...prev, discountType: e.target.value as DiscountType })
                          }
                          disabled={isSavingEdit}
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
                          value={editDraft.discountValue === 0 ? '' : editDraft.discountValue}
                          onChange={(e) => setEditDraft((prev) => prev && { ...prev, discountValue: Number(e.target.value) })}
                          disabled={isSavingEdit}
                          className={inputClass}
                        />
                      </Field>
                      <ActiveField
                        active={editDraft.active}
                        disabled={isSavingEdit}
                        onChange={(active) => setEditDraft((prev) => prev && { ...prev, active })}
                      />
                    </div>
                    <UsageWarning count={addOn.usageCount} itemLabel="용량 추가구매 상품" />
                    <FormActions
                      isSaving={isSavingEdit}
                      savingLabel="저장 중..."
                      saveLabel="저장"
                      onSave={() => handleSaveEdit(addOn.id)}
                      onCancel={() => {
                        setEditingId(null);
                        setEditDraft(null);
                      }}
                    />
                  </td>
                </tr>
              ) : (
                <tr key={addOn.id}>
                  <td className="py-2 px-4 text-gray-600">
                    {CAPACITY_TYPE_LABEL[addOn.capacityType] ?? addOn.capacityType}
                    {addOn.secondaryCapacityType &&
                      ` + ${CAPACITY_TYPE_LABEL[addOn.secondaryCapacityType] ?? addOn.secondaryCapacityType}`}
                  </td>
                  <td className="py-2 text-gray-950 font-medium">
                    +{addOn.unitAmount}
                    {addOn.secondaryCapacityType && addOn.secondaryUnitAmount != null && ` / +${addOn.secondaryUnitAmount}`}
                  </td>
                  <td className="py-2">
                    {formatPrice(addOn.supplyPrice)} / {formatPrice(addOn.salePrice)}
                  </td>
                  <td className="py-2">{formatDiscount(addOn.discountType, addOn.discountValue)}</td>
                  <td className="py-2">
                    <ActiveBadge active={addOn.active} />
                    <span className="ml-1.5 text-xs text-gray-400">사용 {addOn.usageCount}건</span>
                  </td>
                  <td className="py-2 px-4 text-right">
                    <button
                      onClick={() => openHistory(addOn.id)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-gray-200 text-gray-500 text-xs font-medium hover:border-gray-400 hover:text-gray-950"
                    >
                      <History size={12} />
                      이력
                    </button>
                  </td>
                  {canManage && (
                    <td className="py-2 px-4 text-right">
                      <button
                        onClick={() => startEdit(addOn)}
                        disabled={editingId !== null}
                        className="inline-flex items-center gap-1 px-3 py-1 rounded-md border border-gray-200 text-gray-600 text-xs font-medium hover:border-gray-400 disabled:opacity-50"
                      >
                        <Pencil size={12} />
                        수정
                      </button>
                    </td>
                  )}
                </tr>
              ),
            )}
          </tbody>
        </table>
      </ListContainer>

      <Modal
        open={historyAddOnId !== null}
        onClose={() => setHistoryAddOnId(null)}
        title="용량 추가구매 상품 변경 이력"
        widthClassName="max-w-lg"
      >
        {isHistoryLoading ? (
          <div className="flex items-center justify-center py-8 text-gray-400">
            <Loader2 size={20} className="animate-spin" />
          </div>
        ) : addOnHistory.length === 0 ? (
          <p className="text-sm text-gray-400">변경 이력이 없습니다.</p>
        ) : (
          <ul className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
            {addOnHistory.map((history) => (
              <li key={history.id} className="py-2">
                <div className="flex items-center gap-2">
                  <p className="text-sm text-gray-950 font-medium">
                    {CAPACITY_TYPE_LABEL[history.capacityType] ?? history.capacityType} +{history.unitAmount}
                    {history.secondaryCapacityType &&
                      ` · ${CAPACITY_TYPE_LABEL[history.secondaryCapacityType] ?? history.secondaryCapacityType} +${history.secondaryUnitAmount}`}
                  </p>
                  <ActiveBadge active={history.active} />
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  {formatPrice(history.salePrice)} · 할인 {formatDiscount(history.discountType, history.discountValue)}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">{new Date(history.createdAt).toLocaleString('ko-KR')}</p>
              </li>
            ))}
          </ul>
        )}
      </Modal>
    </section>
  );
};

const inputClass =
  'w-full px-3 py-1.5 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-gray-950/10 focus:border-gray-400 outline-none transition-all disabled:bg-gray-100';

const Field: FC<{ label: string; children: ReactNode }> = ({ label, children }) => (
  <div>
    <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
    {children}
  </div>
);

const FormActions: FC<{
  isSaving: boolean;
  savingLabel: string;
  saveLabel: string;
  onSave?: () => void;
  onCancel: () => void;
}> = ({ isSaving, savingLabel, saveLabel, onSave, onCancel }) => (
  <div className="flex gap-2">
    <button
      type={onSave ? 'button' : 'submit'}
      onClick={onSave}
      disabled={isSaving}
      className="flex items-center gap-1.5 px-4 py-1.5 rounded-md bg-gray-950 text-white text-xs font-medium hover:bg-gray-800 disabled:opacity-50"
    >
      {isSaving ? (
        <>
          <Loader2 size={12} className="animate-spin" />
          {savingLabel}
        </>
      ) : (
        saveLabel
      )}
    </button>
    <button
      type="button"
      onClick={onCancel}
      disabled={isSaving}
      className="flex items-center gap-1.5 px-4 py-1.5 rounded-md border border-gray-200 text-gray-600 text-xs font-medium hover:border-gray-400 disabled:opacity-50"
    >
      <X size={12} />
      취소
    </button>
  </div>
);
