import { useEffect, useState } from 'react';
import type { FC, FormEvent, ReactNode } from 'react';
import { Loader2, Package, Pencil, Plus, Sparkles, X } from 'lucide-react';
import { ListContainer } from '../components/ListContainer';
import { useAuthStore } from '../store/useAuthStore';
import { useSnackbarStore } from '../store/useSnackbarStore';
import { api } from '../utils/api';
import { canManagePlatform } from '../utils/permissions';
import type {
  BillingPlanSummary,
  CapacityAddOnSummary,
  CapacityType,
  CreateBillingPlanRequest,
  CreateCapacityAddOnRequest,
  CreateOptionalFeatureRequest,
  DiscountType,
  OptionalFeatureCode,
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
const MANAGEABLE_OPTIONAL_FEATURE_CODES: OptionalFeatureCode[] = ['SIGNER_FIELD_ZOOM', 'ALL_SIGNED_FIREWORKS'];

const OPTIONAL_FEATURE_CODE_LABEL: Record<string, string> = {
  SIGNER_FIELD_ZOOM: '서명 하이라이트',
  ALL_SIGNED_FIREWORKS: '폭죽 효과',
};

const CAPACITY_TYPE_OPTIONS: Array<{ value: CapacityType; label: string }> = [
  { value: 'SIGNERS', label: '서명자' },
  { value: 'TEMPLATES', label: '템플릿' },
  { value: 'TEST_EVENTS', label: '테스트 행사' },
  { value: 'MAIN_EVENTS', label: '본행사' },
];

const CAPACITY_TYPE_LABEL: Record<string, string> = Object.fromEntries(
  CAPACITY_TYPE_OPTIONS.map((option) => [option.value, option.label]),
);

const formatPrice = (value: number) => `${value.toLocaleString('ko-KR')}원`;

const formatDiscount = (discountType: DiscountType, discountValue: number) =>
  discountType === 'PERCENT' ? `${discountValue}%` : formatPrice(discountValue);

/**
 * 플랫폼 관리자용 행사 과금 카탈로그(플랜/선택옵션/용량 추가구매 상품) 관리 화면.
 * 조회는 PLATFORM_SUPPORT 이상 누구나, 등록/수정은 PLATFORM_OPS 이상만 할 수 있다
 * (최종 판단은 항상 백엔드가 하고, 여기서는 버튼을 안 보여주는 용도로만 `canManagePlatform`을 쓴다).
 *
 * - 수정 가능 필드는 가격/할인/이름(플랜은 한도 4종, 용량 추가구매는 unitAmount)뿐이다.
 *   `OptionalFeature.code`/`CapacityAddOn.capacityType`은 종류를 규정하는 값이라 생성 후 불변이라
 *   수정 폼에 없다(읽기 전용으로만 보여준다).
 * - `BillingPlan`에 묶인 선택옵션 구성(optionalFeatureIds)도 생성 시점에만 정하고 이후 불변이라
 *   수정 폼에 없다.
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
  maxMainEvents: 0,
  optionalFeatureIds: [],
};

const BillingPlanSection: FC<SectionProps> = ({ canManage, showSnackbar }) => {
  const [plans, setPlans] = useState<BillingPlanSummary[]>([]);
  const [features, setFeatures] = useState<OptionalFeatureSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [isCreateFormOpen, setIsCreateFormOpen] = useState(false);
  const [createDraft, setCreateDraft] = useState<CreateBillingPlanRequest>(EMPTY_PLAN_DRAFT);
  const [isCreating, setIsCreating] = useState(false);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<UpdateBillingPlanRequest | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const fetchAll = async () => {
    const [plansResponse, featuresResponse] = await Promise.all([
      api.get('/billing-plans'),
      api.get('/optional-features'),
    ]);
    return {
      plans: plansResponse.data as BillingPlanSummary[],
      features: featuresResponse.data as OptionalFeatureSummary[],
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

  // 선택옵션은 별도 섹션(OptionalFeatureSection)에서 등록/수정될 수 있어, 생성 폼을 열 때마다
  // 목록을 새로 불러온다 — 마운트 시점 한 번만 불러오면 다른 섹션에서 방금 만든 옵션이
  // 체크박스 목록에 안 보이는 문제가 생긴다.
  const handleOpenCreateForm = async () => {
    setIsCreateFormOpen(true);
    try {
      setFeatures((await fetchAll()).features);
    } catch (err) {
      showSnackbar(err instanceof Error ? err.message : '선택옵션 목록을 불러오지 못했습니다.', 'error');
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
      maxMainEvents: plan.maxMainEvents,
    });
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

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
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
            <p className="mt-1 text-xs text-gray-400">플랜에 묶을 선택옵션 구성은 생성 후 바꿀 수 없습니다.</p>
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
              <th className="text-left font-medium py-2">한도(서명자/템플릿/테스트/본행사)</th>
              <th className="text-left font-medium py-2">포함 선택옵션</th>
              {canManage && <th className="text-right font-medium py-2 px-4">처리</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {plans.map((plan) =>
              editingId === plan.id && editDraft ? (
                <tr key={plan.id} className="bg-gray-50">
                  <td colSpan={canManage ? 6 : 5} className="p-4">
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
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
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
                    </div>
                    <p className="text-xs text-gray-400 mb-3">
                      포함 선택옵션(읽기 전용, 생성 후 불변): {plan.optionalFeatureIds.map(featureName).join(', ') || '없음'}
                    </p>
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
                    {plan.maxSigners}/{plan.maxTemplates}/{plan.maxTestEvents}/{plan.maxMainEvents}
                  </td>
                  <td className="py-2 text-gray-600">{plan.optionalFeatureIds.map(featureName).join(', ') || '-'}</td>
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
    setCreateDraft({ ...EMPTY_FEATURE_DRAFT, code: availableCodes[0] });
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
      await api.post('/platform-admin/optional-features', { ...createDraft, name: createDraft.name.trim() });
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
    });
  };

  const handleSaveEdit = async (featureId: number) => {
    if (!editDraft) return;
    if (!editDraft.name.trim()) {
      showSnackbar('선택옵션 이름을 입력해주세요.', 'error');
      return;
    }
    setIsSavingEdit(true);
    try {
      await api.put(`/platform-admin/optional-features/${featureId}`, { ...editDraft, name: editDraft.name.trim() });
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
                onChange={(e) => setCreateDraft((prev) => ({ ...prev, code: e.target.value as OptionalFeatureCode }))}
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
          </div>
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
              {canManage && <th className="text-right font-medium py-2 px-4">처리</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {features.map((feature) =>
              editingId === feature.id && editDraft ? (
                <tr key={feature.id} className="bg-gray-50">
                  <td colSpan={canManage ? 5 : 4} className="p-4">
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
                    </div>
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
    </section>
  );
};

const EMPTY_ADDON_DRAFT: CreateCapacityAddOnRequest = {
  capacityType: 'SIGNERS',
  unitAmount: 1,
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
      supplyPrice: addOn.supplyPrice,
      salePrice: addOn.salePrice,
      discountType: addOn.discountType,
      discountValue: addOn.discountValue,
    });
  };

  const handleSaveEdit = async (addOnId: number) => {
    if (!editDraft) return;
    if (editDraft.unitAmount < 1) {
      showSnackbar('단위 수량은 1 이상이어야 합니다.', 'error');
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
                onChange={(e) => setCreateDraft((prev) => ({ ...prev, capacityType: e.target.value as CapacityType }))}
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
              {canManage && <th className="text-right font-medium py-2 px-4">처리</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {addOns.map((addOn) =>
              editingId === addOn.id && editDraft ? (
                <tr key={addOn.id} className="bg-gray-50">
                  <td colSpan={canManage ? 5 : 4} className="p-4">
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
                  <td className="py-2 px-4 text-gray-600">{CAPACITY_TYPE_LABEL[addOn.capacityType] ?? addOn.capacityType}</td>
                  <td className="py-2 text-gray-950 font-medium">+{addOn.unitAmount}</td>
                  <td className="py-2">
                    {formatPrice(addOn.supplyPrice)} / {formatPrice(addOn.salePrice)}
                  </td>
                  <td className="py-2">{formatDiscount(addOn.discountType, addOn.discountValue)}</td>
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
