import { useEffect, useState } from 'react';
import type { FC, FormEvent, ReactNode } from 'react';
import { History, Loader2, Package, Pencil, Plus, Sparkles, X } from 'lucide-react';
import { ListContainer } from '../components/ListContainer';
import { Modal } from '../components/Modal';
import { usePermissionStore } from '../store/usePermissionStore';
import { useSnackbarStore } from '../store/useSnackbarStore';
import { api } from '../utils/api';
import { formatCurrency, formatDateTime } from '../utils/internationalization';
import type {
  BillingPlanHistorySummary,
  BillingPlanSummary,
  CapacityAddOnHistorySummary,
  CapacityAddOnSummary,
  CapacityType,
  CatalogPricePeriodHistorySummary,
  CatalogPricePeriodRequest,
  CatalogPricePeriodSummary,
  CeremonyEffectDefinition,
  CreateBillingPlanRequest,
  CreateCapacityAddOnRequest,
  CreateOptionalFeatureRequest,
  DiscountType,
  OptionalFeatureCategory,
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
// SIGNER_FIELD_ZOOM/ALL_SIGNED_FIREWORKS는 EVENT_EFFECT_BUNDLE로 통합되면서 더 이상 신규
// 등록하지 않는다(2026-09-08) — signstage-docs
// business/ceremony-event-effect-implementation-tasks.md 참고. 라벨 맵(OPTIONAL_FEATURE_CODE_LABEL
// 등)에는 이미 등록된 행/이력을 계속 정상 표시해야 해서 남겨둔다.
// ONSITE_SUPPORT(현장지원)/ONLINE_SUPPORT(온라인지원)는 태블릿 대여와 같은 "표시용 옵션 + 수량
// 추가구매" 패턴의 신규 품목이다(2026-09-08 결정) — signstage-docs
// business/ceremony-support-services-billing-review.md 참고.
const MANAGEABLE_OPTIONAL_FEATURE_CODES: OptionalFeatureCode[] = [
  'EVENT_EFFECT_BUNDLE',
  'ONSITE_SUPPORT',
  'ONLINE_SUPPORT',
];

const OPTIONAL_FEATURE_CODE_LABEL: Record<string, string> = {
  SIGNER_FIELD_ZOOM: '서명 하이라이트',
  ALL_SIGNED_FIREWORKS: '폭죽 효과',
  EVENT_EFFECT_BUNDLE: '이벤트 효과 묶음',
  TABLET_RENTAL: '태블릿 대여',
  ONSITE_SUPPORT: '현장지원',
  ONLINE_SUPPORT: '온라인지원',
};

const OPTIONAL_FEATURE_CATEGORY_OPTIONS: Array<{ value: OptionalFeatureCategory; label: string }> = [
  { value: 'EQUIPMENT', label: '장비' },
  { value: 'PERSONNEL', label: '인력' },
  { value: 'APPLICATION', label: '애플리케이션' },
];

const OPTIONAL_FEATURE_CATEGORY_LABEL: Record<string, string> = Object.fromEntries(
  OPTIONAL_FEATURE_CATEGORY_OPTIONS.map((option) => [option.value, option.label]),
);

/** 코드별 기본 카테고리 — signstage-docs business/ceremony-support-services-billing-review.md 4.3/4.5절. */
const DEFAULT_CATEGORY_BY_CODE: Record<string, OptionalFeatureCategory> = {
  SIGNER_FIELD_ZOOM: 'APPLICATION',
  ALL_SIGNED_FIREWORKS: 'APPLICATION',
  EVENT_EFFECT_BUNDLE: 'APPLICATION',
  TABLET_RENTAL: 'EQUIPMENT',
  ONSITE_SUPPORT: 'PERSONNEL',
  ONLINE_SUPPORT: 'PERSONNEL',
};

/** 효과 하나를 "targetType/triggerType 코드" 형태로 간단히 보여준다(예: "PROJECTOR · SIGNATURE_COMPLETED"). */
const EFFECT_TRIGGER_LABEL: Record<string, string> = {
  SIGNATURE_COMPLETED: '개별 서명 완료',
  ALL_SIGNATURES_COMPLETED: '전체 서명 완료',
  EVENT_FINISHED: '행사 종료',
};

/**
 * "이벤트 효과 묶음"(EVENT_EFFECT_BUNDLE) 상품이 열어줄 효과를 고르는 체크박스 목록 —
 * signstage-docs business/ceremony-event-effect-implementation-tasks.md, 2026-09-08 결정.
 * 같은 효과가 여러 묶음에 겹쳐 들어가도 된다(자유 N:M 구성) — capacity_addons.capacity_type이
 * 유일 제약 없이 여러 상품에 공유되는 것과 같은 패턴을, 선택옵션 쪽에서 이 화면으로 관리한다.
 */
const EffectDefinitionPicker: FC<{
  definitions: CeremonyEffectDefinition[];
  selectedIds: number[];
  disabled: boolean;
  onChange: (ids: number[]) => void;
}> = ({ definitions, selectedIds, disabled, onChange }) => {
  const toggle = (id: number, checked: boolean) => {
    onChange(checked ? [...selectedIds, id] : selectedIds.filter((existing) => existing !== id));
  };

  return (
    <div className="sm:col-span-2 md:col-span-3">
      <span className="block text-xs font-medium text-gray-500 mb-1">이 묶음이 여는 이벤트 효과</span>
      {definitions.length === 0 ? (
        <p className="text-xs text-gray-400">등록된 이벤트 효과가 없습니다. 먼저 이벤트 효과 관리 화면에서 효과를 등록해주세요.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-3 gap-y-1.5 rounded-md border border-gray-200 bg-white p-3 max-h-48 overflow-y-auto">
          {definitions.map((definition) => (
            <label key={definition.id} className="flex items-center gap-1.5 text-xs text-gray-700">
              <input
                type="checkbox"
                checked={selectedIds.includes(definition.id)}
                disabled={disabled}
                onChange={(e) => toggle(definition.id, e.target.checked)}
              />
              <span className="truncate" title={definition.displayName}>
                {definition.displayName}
                <span className="text-gray-400"> · {EFFECT_TRIGGER_LABEL[definition.triggerType] ?? definition.triggerType}</span>
              </span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
};

const CAPACITY_TYPE_OPTIONS: Array<{ value: CapacityType; label: string }> = [
  { value: 'SIGNERS', label: '서명자' },
  { value: 'TEMPLATES', label: '템플릿' },
  { value: 'TEST_EVENTS', label: '테스트 행사' },
  { value: 'REHEARSAL_EVENTS', label: '리허설 행사' },
  { value: 'MAIN_EVENTS', label: '본행사' },
  { value: 'TABLETS', label: '태블릿' },
  { value: 'ONSITE_SUPPORT', label: '현장지원' },
  { value: 'ONLINE_SUPPORT', label: '온라인지원' },
];

const CAPACITY_TYPE_LABEL: Record<string, string> = Object.fromEntries(
  CAPACITY_TYPE_OPTIONS.map((option) => [option.value, option.label]),
);

/**
 * 플랜이 기본 포함할 수 있는 용량 종류 — 백엔드 CapacityType.isPlanIncludable()과 같은 집합이다
 * (signstage-docs business/billing-catalog-zero-base-schema-redesign-review.md 결정, 2026-09-08,
 * 항목 B). TABLETS/ONSITE_SUPPORT/ONLINE_SUPPORT는 플랜 기본 포함 개념이 없어(항상 0에서 시작,
 * 용량 추가구매로만 증가) 제외한다. 새 용량 종류가 플랜 기본 포함 대상이 되면 여기(그리고
 * 백엔드 CapacityType.isPlanIncludable())만 같이 고치면 된다.
 */
const PLAN_NON_INCLUDABLE_CAPACITY_TYPES: CapacityType[] = ['TABLETS', 'ONSITE_SUPPORT', 'ONLINE_SUPPORT'];
const PLAN_CAPACITY_TYPE_OPTIONS = CAPACITY_TYPE_OPTIONS.filter(
  (option) => !PLAN_NON_INCLUDABLE_CAPACITY_TYPES.includes(option.value),
);

/** 새 플랜 초안의 한도 기본값 — 등록 가능한 용량 종류 전부를 0으로 채워 시작한다. */
const emptyPlanCapacities = (): Record<string, number> =>
  Object.fromEntries(PLAN_CAPACITY_TYPE_OPTIONS.map((option) => [option.value, 0]));

const formatPrice = (value: number, currencyCode = 'KRW') => formatCurrency(value, currencyCode);

/** 공급가는 nullable이다("원가 미상") — signstage-docs business/billing-catalog-zero-base-schema-redesign-review.md 결정(2026-09-08, 항목 G). */
const formatSupplyPrice = (value: number | null, currencyCode = 'KRW') =>
  value === null ? '미상' : formatPrice(value, currencyCode);

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

const PERIOD_STATUS_LABEL: Record<string, string> = {
  PENDING: '판매예정',
  ON_SALE: '판매중',
  EXPIRED: '판매종료',
  INACTIVE: '사용중지',
  NO_ACTIVE_PERIOD: '유효 기간 없음',
};

const PERIOD_STATUS_STYLE: Record<string, string> = {
  PENDING: 'bg-blue-50 text-blue-700 border-blue-200',
  ON_SALE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  EXPIRED: 'bg-gray-100 text-gray-500 border-gray-200',
  INACTIVE: 'bg-gray-100 text-gray-500 border-gray-200',
  NO_ACTIVE_PERIOD: 'bg-red-50 text-red-700 border-red-200',
};

/** 목록의 "상태" 열이 쓰는 배지 — 오늘 기준 유효한 판매가격 기간의 상태를 보여준다. */
const PeriodStatusBadge: FC<{ status: string }> = ({ status }) => (
  <span
    className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium border ${
      PERIOD_STATUS_STYLE[status] ?? 'bg-gray-100 text-gray-500 border-gray-200'
    }`}
  >
    {PERIOD_STATUS_LABEL[status] ?? status}
  </span>
);

const todayIsoDate = () => new Date().toISOString().slice(0, 10);

const EMPTY_PERIOD_DRAFT = (): CatalogPricePeriodRequest => ({
  currencyCode: 'KRW',
  supplyPrice: null,
  salePrice: 0,
  discountType: 'PERCENT',
  discountValue: 0,
  taxCode: 'KR_VAT_STANDARD',
  active: true,
  effectiveFrom: todayIsoDate(),
  effectiveTo: null,
});

/**
 * 세 카탈로그 섹션(플랜/선택옵션/용량 추가구매)이 공유하는 판매가격 기간 관리 모달 —
 * 목록(추가/수정/삭제) + 변경 이력 탭. signstage-docs
 * business/billing-catalog-price-validity-period-review.md 결정(2026-09-09, 다중버전 채택) —
 * `basePath`가 `/platform-admin/billing-plans` 등 각 타입의 관리자 API prefix를 결정한다.
 * 세 타입의 기간 DTO 모양이 완전히 같아 이 컴포넌트 하나로 공유한다(백엔드는 엔티티별로
 * 나뉘어 있지만, 프런트는 그 경계를 따를 필요가 없다).
 */
const PricePeriodManagerModal: FC<{
  itemId: number | null;
  basePath: string;
  onClose: () => void;
  onChanged: () => void;
  showSnackbar: (message: string, variant: 'success' | 'error') => void;
}> = ({ itemId, basePath, onClose, onChanged, showSnackbar }) => {
  const [periods, setPeriods] = useState<CatalogPricePeriodSummary[]>([]);
  const [history, setHistory] = useState<CatalogPricePeriodHistorySummary[]>([]);
  const [tab, setTab] = useState<'periods' | 'history'>('periods');
  const [isLoading, setIsLoading] = useState(false);

  const [isAdding, setIsAdding] = useState(false);
  const [addDraft, setAddDraft] = useState<CatalogPricePeriodRequest>(EMPTY_PERIOD_DRAFT());
  const [editingPeriodId, setEditingPeriodId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<CatalogPricePeriodRequest | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const fetchPeriods = async (id: number) => (await api.get(`${basePath}/${id}/periods`)).data as CatalogPricePeriodSummary[];
  const fetchHistory = async (id: number) =>
    (await api.get(`${basePath}/${id}/periods/history`)).data as CatalogPricePeriodHistorySummary[];

  useEffect(() => {
    if (itemId === null) return;
    let cancelled = false;
    // setState를 이펙트 본문에서 곧장 부르지 않고 IIFE 안에서 호출한다 —
    // react-hooks/set-state-in-effect(AdminUserList.tsx와 같은 관례).
    (async () => {
      setIsLoading(true);
      setTab('periods');
      setIsAdding(false);
      setEditingPeriodId(null);
      try {
        const data = await fetchPeriods(itemId);
        if (!cancelled) setPeriods(data);
      } catch (err) {
        if (!cancelled) showSnackbar(err instanceof Error ? err.message : '판매가격 기간을 불러오지 못했습니다.', 'error');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemId]);

  const openHistoryTab = async () => {
    if (itemId === null) return;
    setTab('history');
    setIsLoading(true);
    try {
      setHistory(await fetchHistory(itemId));
    } catch (err) {
      showSnackbar(err instanceof Error ? err.message : '기간 변경 이력을 불러오지 못했습니다.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const reloadPeriods = async () => {
    if (itemId === null) return;
    setPeriods(await fetchPeriods(itemId));
    onChanged();
  };

  const handleAdd = async () => {
    if (itemId === null) return;
    setIsSaving(true);
    try {
      await api.post(`${basePath}/${itemId}/periods`, addDraft);
      showSnackbar('판매가격 기간을 추가했습니다.', 'success');
      setIsAdding(false);
      setAddDraft(EMPTY_PERIOD_DRAFT());
      await reloadPeriods();
    } catch (err) {
      showSnackbar(err instanceof Error ? err.message : '판매가격 기간 추가에 실패했습니다.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const startEditPeriod = (period: CatalogPricePeriodSummary) => {
    setEditingPeriodId(period.id);
    setEditDraft({
      currencyCode: period.currencyCode,
      supplyPrice: period.supplyPrice,
      salePrice: period.salePrice,
      discountType: period.discountType,
      discountValue: period.discountValue,
      taxCode: period.taxCode,
      active: period.active,
      effectiveFrom: period.effectiveFrom,
      effectiveTo: period.effectiveTo,
    });
  };

  const handleSaveEditPeriod = async (periodId: number) => {
    if (itemId === null || !editDraft) return;
    setIsSaving(true);
    try {
      await api.put(`${basePath}/${itemId}/periods/${periodId}`, editDraft);
      showSnackbar('판매가격 기간을 저장했습니다.', 'success');
      setEditingPeriodId(null);
      setEditDraft(null);
      await reloadPeriods();
    } catch (err) {
      showSnackbar(err instanceof Error ? err.message : '판매가격 기간 저장에 실패했습니다.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemovePeriod = async (periodId: number) => {
    if (itemId === null) return;
    setIsSaving(true);
    try {
      await api.delete(`${basePath}/${itemId}/periods/${periodId}`);
      showSnackbar('판매가격 기간을 삭제했습니다.', 'success');
      await reloadPeriods();
    } catch (err) {
      showSnackbar(err instanceof Error ? err.message : '판매가격 기간 삭제에 실패했습니다.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const renderPeriodForm = (
    draft: CatalogPricePeriodRequest,
    setDraft: (updater: (prev: CatalogPricePeriodRequest) => CatalogPricePeriodRequest) => void,
    disabled: boolean,
  ) => (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <Field label="통화">
        <select
          value={draft.currencyCode}
          onChange={(e) => setDraft((prev) => ({ ...prev, currencyCode: e.target.value }))}
          disabled={disabled}
          className={inputClass}
        >
          {['KRW', 'USD', 'EUR', 'JPY'].map((currency) => (
            <option key={currency} value={currency}>
              {currency}
            </option>
          ))}
        </select>
      </Field>
      <Field label="공급가">
        <input
          type="number"
          min={0}
          value={draft.supplyPrice === null ? '' : draft.supplyPrice}
          onChange={(e) => setDraft((prev) => ({ ...prev, supplyPrice: e.target.value === '' ? null : Number(e.target.value) }))}
          placeholder="미상"
          disabled={disabled}
          className={inputClass}
        />
      </Field>
      <Field label="판매가">
        <input
          type="number"
          min={0}
          value={draft.salePrice === 0 ? '' : draft.salePrice}
          onChange={(e) => setDraft((prev) => ({ ...prev, salePrice: Number(e.target.value) }))}
          disabled={disabled}
          className={inputClass}
        />
      </Field>
      <Field label="할인 방식">
        <select
          value={draft.discountType}
          onChange={(e) => setDraft((prev) => ({ ...prev, discountType: e.target.value as DiscountType }))}
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
          onChange={(e) => setDraft((prev) => ({ ...prev, discountValue: Number(e.target.value) }))}
          disabled={disabled}
          className={inputClass}
        />
      </Field>
      <Field label="시작일">
        <input
          type="date"
          value={draft.effectiveFrom}
          onChange={(e) => setDraft((prev) => ({ ...prev, effectiveFrom: e.target.value }))}
          disabled={disabled}
          className={inputClass}
        />
      </Field>
      <Field label="종료일(무기한이면 비움)">
        <input
          type="date"
          value={draft.effectiveTo ?? ''}
          onChange={(e) => setDraft((prev) => ({ ...prev, effectiveTo: e.target.value === '' ? null : e.target.value }))}
          disabled={disabled}
          className={inputClass}
        />
      </Field>
      <ActiveField active={draft.active} disabled={disabled} onChange={(active) => setDraft((prev) => ({ ...prev, active }))} />
    </div>
  );

  return (
    <Modal open={itemId !== null} onClose={onClose} title="판매가격 기간 관리" widthClassName="max-w-3xl">
      <div className="flex items-center gap-2 mb-3 border-b border-gray-200">
        <button
          onClick={() => setTab('periods')}
          className={`px-3 py-1.5 text-xs font-medium border-b-2 ${tab === 'periods' ? 'border-gray-950 text-gray-950' : 'border-transparent text-gray-400'}`}
        >
          기간 목록
        </button>
        <button
          onClick={openHistoryTab}
          className={`px-3 py-1.5 text-xs font-medium border-b-2 ${tab === 'history' ? 'border-gray-950 text-gray-950' : 'border-transparent text-gray-400'}`}
        >
          변경 이력
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8 text-gray-400">
          <Loader2 size={20} className="animate-spin" />
        </div>
      ) : tab === 'periods' ? (
        <div className="space-y-3">
          {!isAdding && (
            <button
              onClick={() => {
                setIsAdding(true);
                setAddDraft(EMPTY_PERIOD_DRAFT());
              }}
              className="flex items-center gap-1 px-3 py-1 rounded-md bg-gray-950 text-white text-xs font-medium hover:bg-gray-800"
            >
              <Plus size={12} />
              새 기간 추가
            </button>
          )}
          {isAdding && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-3">
              {renderPeriodForm(addDraft, setAddDraft, isSaving)}
              <FormActions
                isSaving={isSaving}
                savingLabel="추가 중..."
                saveLabel="추가"
                onSave={handleAdd}
                onCancel={() => {
                  setIsAdding(false);
                  setAddDraft(EMPTY_PERIOD_DRAFT());
                }}
              />
            </div>
          )}

          {periods.length === 0 ? (
            <p className="text-sm text-gray-400">등록된 판매가격 기간이 없습니다.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {periods.map((period) =>
                editingPeriodId === period.id && editDraft ? (
                  <li key={period.id} className="py-3 bg-gray-50 -mx-1 px-1 rounded-md space-y-3">
                    {renderPeriodForm(editDraft, (updater) => setEditDraft((prev) => prev && updater(prev)), isSaving)}
                    <FormActions
                      isSaving={isSaving}
                      savingLabel="저장 중..."
                      saveLabel="저장"
                      onSave={() => handleSaveEditPeriod(period.id)}
                      onCancel={() => {
                        setEditingPeriodId(null);
                        setEditDraft(null);
                      }}
                    />
                  </li>
                ) : (
                  <li key={period.id} className="py-2 flex items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-950 font-medium">{formatPrice(period.salePrice, period.currencyCode)}</span>
                        <span className="text-xs text-gray-500">할인 {formatDiscount(period.discountType, period.discountValue)}</span>
                        <PeriodStatusBadge status={period.status} />
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {period.effectiveFrom} ~ {period.effectiveTo ?? '무기한'}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => startEditPeriod(period)}
                        disabled={editingPeriodId !== null || isAdding}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-gray-200 text-gray-600 text-xs font-medium hover:border-gray-400 disabled:opacity-50"
                      >
                        <Pencil size={12} />
                        수정
                      </button>
                      <button
                        onClick={() => handleRemovePeriod(period.id)}
                        disabled={isSaving || periods.length <= 1}
                        title={periods.length <= 1 ? '마지막 남은 기간은 삭제할 수 없습니다.' : undefined}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-gray-200 text-red-600 text-xs font-medium hover:border-red-300 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <X size={12} />
                        삭제
                      </button>
                    </div>
                  </li>
                ),
              )}
            </ul>
          )}
        </div>
      ) : history.length === 0 ? (
        <p className="text-sm text-gray-400">기간 변경 이력이 없습니다.</p>
      ) : (
        <ul className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
          {history.map((h) => (
            <li key={h.id} className="py-2">
              <div className="flex items-center gap-2">
                <p className="text-sm text-gray-950 font-medium">{formatPrice(h.salePrice, h.currencyCode)}</p>
                <ActiveBadge active={h.active} />
                {h.removed && <span className="text-xs text-red-600 font-medium">제거됨</span>}
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                {h.effectiveFrom} ~ {h.effectiveTo ?? '무기한'} · 할인 {formatDiscount(h.discountType, h.discountValue)}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">{formatDateTime(h.createdAt)}</p>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
};

/**
 * 플랫폼 관리자용 행사 과금 카탈로그(플랜/선택옵션/용량 추가구매 상품) 관리 화면.
 * 조회는 PLATFORM_SUPPORT 이상 누구나, 등록/수정은 PLATFORM_OPS 이상만 할 수 있다
 * (최종 판단은 항상 백엔드가 하고, 여기서는 버튼을 안 보여주는 용도로만 `hasPermission('ACTION_BILLING_CATALOG_MANAGE')`를 쓴다).
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
  const canManage = usePermissionStore((state) => state.hasPermission('ACTION_BILLING_CATALOG_MANAGE'));
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

const EMPTY_PLAN_DRAFT = (): CreateBillingPlanRequest => ({
  name: '',
  currencyCode: 'KRW',
  supplyPrice: null,
  salePrice: 0,
  discountType: 'PERCENT',
  discountValue: 0,
  taxCode: 'KR_VAT_STANDARD',
  active: true,
  effectiveFrom: todayIsoDate(),
  effectiveTo: null,
  capacities: emptyPlanCapacities(),
  optionalFeatureIds: [],
  capacityAddOnIds: [],
});

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

  const [periodItemId, setPeriodItemId] = useState<number | null>(null);

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
      capacities: { ...plan.capacities },
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
            <Field label="통화">
              <select value={createDraft.currencyCode} onChange={(e) => setCreateDraft((prev) => ({ ...prev, currencyCode: e.target.value }))} disabled={isCreating} className={inputClass}>
                {['KRW', 'USD', 'EUR', 'JPY'].map((currency) => <option key={currency} value={currency}>{currency}</option>)}
              </select>
            </Field>
            <Field label="공급가">
              <input
                type="number"
                min={0}
                value={createDraft.supplyPrice === null ? '' : createDraft.supplyPrice}
                onChange={(e) => setCreateDraft((prev) => ({ ...prev, supplyPrice: e.target.value === '' ? null : Number(e.target.value) }))}
                placeholder="미상"
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
            <Field label="판매 시작일">
              <input
                type="date"
                value={createDraft.effectiveFrom}
                onChange={(e) => setCreateDraft((prev) => ({ ...prev, effectiveFrom: e.target.value }))}
                disabled={isCreating}
                className={inputClass}
              />
            </Field>
            <Field label="판매 종료일(무기한이면 비움)">
              <input
                type="date"
                value={createDraft.effectiveTo ?? ''}
                onChange={(e) => setCreateDraft((prev) => ({ ...prev, effectiveTo: e.target.value === '' ? null : e.target.value }))}
                disabled={isCreating}
                className={inputClass}
              />
            </Field>
            <ActiveField
              active={createDraft.active}
              disabled={isCreating}
              onChange={(active) => setCreateDraft((prev) => ({ ...prev, active }))}
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {PLAN_CAPACITY_TYPE_OPTIONS.map((option) => (
              <Field key={option.value} label={`${option.label} 한도`}>
                <input
                  type="number"
                  min={0}
                  value={createDraft.capacities[option.value] === 0 ? '' : createDraft.capacities[option.value]}
                  onChange={(e) =>
                    setCreateDraft((prev) => ({
                      ...prev,
                      capacities: { ...prev.capacities, [option.value]: Number(e.target.value) },
                    }))
                  }
                  disabled={isCreating}
                  className={inputClass}
                />
              </Field>
            ))}
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
                    <p className="mb-3 text-xs text-gray-400">
                      가격/할인/판매기간/사용여부는 목록의 "가격" 버튼에서 판매가격 기간 단위로 관리합니다.
                    </p>
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
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-3">
                      {PLAN_CAPACITY_TYPE_OPTIONS.map((option) => (
                        <Field key={option.value} label={`${option.label} 한도`}>
                          <input
                            type="number"
                            min={0}
                            value={editDraft.capacities[option.value] === 0 ? '' : editDraft.capacities[option.value]}
                            onChange={(e) =>
                              setEditDraft((prev) =>
                                prev && {
                                  ...prev,
                                  capacities: { ...prev.capacities, [option.value]: Number(e.target.value) },
                                }
                              )
                            }
                            disabled={isSavingEdit}
                            className={inputClass}
                          />
                        </Field>
                      ))}
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
                    {plan.salePrice === null
                      ? '-'
                      : `${formatSupplyPrice(plan.supplyPrice, plan.currencyCode ?? 'KRW')} / ${formatPrice(plan.salePrice, plan.currencyCode ?? 'KRW')}`}
                  </td>
                  <td className="py-2">
                    {plan.discountType === null || plan.discountValue === null ? '-' : formatDiscount(plan.discountType, plan.discountValue)}
                  </td>
                  <td className="py-2 text-gray-600">
                    {PLAN_CAPACITY_TYPE_OPTIONS.map((option) => plan.capacities[option.value]).join('/')}
                  </td>
                  <td className="py-2 text-gray-600">{plan.optionalFeatureIds.map(featureName).join(', ') || '-'}</td>
                  <td className="py-2 text-gray-600">{plan.capacityAddOnIds.map(addOnLabel).join(', ') || '-'}</td>
                  <td className="py-2">
                    <PeriodStatusBadge status={plan.periodStatus} />
                    <span className="ml-1.5 text-xs text-gray-400">사용 {plan.usageCount}건</span>
                  </td>
                  <td className="py-2 px-4 text-right">
                    <button
                      onClick={() => setPeriodItemId(plan.id)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-gray-200 text-gray-500 text-xs font-medium hover:border-gray-400 hover:text-gray-950"
                    >
                      가격
                    </button>
                    <button
                      onClick={() => openHistory(plan.id)}
                      className="ml-1.5 inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-gray-200 text-gray-500 text-xs font-medium hover:border-gray-400 hover:text-gray-950"
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
                <p className="text-sm text-gray-950 font-medium">{history.name}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  서명자 {history.capacities.SIGNERS}명 · 템플릿{' '}
                  {history.capacities.TEMPLATES}건 · 테스트 {history.capacities.TEST_EVENTS}건 · 리허설{' '}
                  {history.capacities.REHEARSAL_EVENTS}건 · 본행사 {history.capacities.MAIN_EVENTS}건
                </p>
                <p className="text-xs text-gray-400 mt-0.5">{formatDateTime(history.createdAt)}</p>
              </li>
            ))}
          </ul>
        )}
      </Modal>

      <PricePeriodManagerModal
        itemId={periodItemId}
        basePath="/platform-admin/billing-plans"
        onClose={() => setPeriodItemId(null)}
        onChanged={() => fetchAll().then((data) => setPlans(data.plans))}
        showSnackbar={showSnackbar}
      />
    </section>
  );
};

const EMPTY_FEATURE_DRAFT = (): CreateOptionalFeatureRequest => ({
  code: 'EVENT_EFFECT_BUNDLE',
  name: '',
  currencyCode: 'KRW',
  supplyPrice: null,
  salePrice: 0,
  discountType: 'PERCENT',
  discountValue: 0,
  taxCode: 'KR_VAT_STANDARD',
  active: true,
  effectiveFrom: todayIsoDate(),
  effectiveTo: null,
  exclusivityGroup: '',
  category: 'APPLICATION',
  effectDefinitionIds: [],
});

/** 빈 문자열 입력을 "그룹 없음"(null)으로 정규화한다 — 폼 입력값은 항상 문자열로 다루는 게 controlled input에 편해서다. */
const normalizeExclusivityGroup = (value: string | null | undefined): string | null => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

const OptionalFeatureSection: FC<SectionProps> = ({ canManage, showSnackbar }) => {
  const [features, setFeatures] = useState<OptionalFeatureSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [effectDefinitions, setEffectDefinitions] = useState<CeremonyEffectDefinition[]>([]);

  const [isCreateFormOpen, setIsCreateFormOpen] = useState(false);
  const [createDraft, setCreateDraft] = useState<CreateOptionalFeatureRequest>(EMPTY_FEATURE_DRAFT);
  const [isCreating, setIsCreating] = useState(false);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<UpdateOptionalFeatureRequest | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const [historyFeatureId, setHistoryFeatureId] = useState<number | null>(null);
  const [featureHistory, setFeatureHistory] = useState<OptionalFeatureHistorySummary[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);

  const [periodItemId, setPeriodItemId] = useState<number | null>(null);

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
        const [featuresData, effectsRes] = await Promise.all([fetchFeatures(), api.get('/ceremony-effects')]);
        if (!cancelled) {
          setFeatures(featuresData);
          setEffectDefinitions(effectsRes.data as CeremonyEffectDefinition[]);
        }
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

  // EVENT_EFFECT_BUNDLE은 여러 행이 코드를 공유할 수 있는 묶음 상품이라(capacity_addons.capacity_type과
  // 같은 패턴, 2026-09-08) 이미 등록된 코드라도 계속 "새로 만들기" 대상이다 — "3종", "5종"처럼
  // 몇 개든 계속 추가할 수 있어야 한다. 그래서 availableCodes는 등록 여부로 거르지 않는다.
  const availableCodes = MANAGEABLE_OPTIONAL_FEATURE_CODES;

  const handleOpenCreateForm = () => {
    const code = availableCodes[0];
    setCreateDraft({
      ...EMPTY_FEATURE_DRAFT(),
      code,
      category: DEFAULT_CATEGORY_BY_CODE[code] ?? 'APPLICATION',
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
      exclusivityGroup: feature.exclusivityGroup ?? '',
      category: feature.category,
      effectDefinitionIds: feature.effectDefinitionIds,
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
                    category: DEFAULT_CATEGORY_BY_CODE[code] ?? prev.category,
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
            <Field label="통화">
              <select value={createDraft.currencyCode} onChange={(e) => setCreateDraft((prev) => ({ ...prev, currencyCode: e.target.value }))} disabled={isCreating} className={inputClass}>
                {['KRW', 'USD', 'EUR', 'JPY'].map((currency) => <option key={currency} value={currency}>{currency}</option>)}
              </select>
            </Field>
            <Field label="공급가">
              <input
                type="number"
                min={0}
                value={createDraft.supplyPrice === null ? '' : createDraft.supplyPrice}
                onChange={(e) => setCreateDraft((prev) => ({ ...prev, supplyPrice: e.target.value === '' ? null : Number(e.target.value) }))}
                placeholder="미상"
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
            <Field label="판매 시작일">
              <input
                type="date"
                value={createDraft.effectiveFrom}
                onChange={(e) => setCreateDraft((prev) => ({ ...prev, effectiveFrom: e.target.value }))}
                disabled={isCreating}
                className={inputClass}
              />
            </Field>
            <Field label="판매 종료일(무기한이면 비움)">
              <input
                type="date"
                value={createDraft.effectiveTo ?? ''}
                onChange={(e) => setCreateDraft((prev) => ({ ...prev, effectiveTo: e.target.value === '' ? null : e.target.value }))}
                disabled={isCreating}
                className={inputClass}
              />
            </Field>
            <ActiveField
              active={createDraft.active}
              disabled={isCreating}
              onChange={(active) => setCreateDraft((prev) => ({ ...prev, active }))}
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
            <Field label="카테고리">
              <select
                value={createDraft.category}
                onChange={(e) => setCreateDraft((prev) => ({ ...prev, category: e.target.value as OptionalFeatureCategory }))}
                disabled={isCreating}
                className={inputClass}
              >
                {OPTIONAL_FEATURE_CATEGORY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>
            {createDraft.code === 'EVENT_EFFECT_BUNDLE' && (
              <EffectDefinitionPicker
                definitions={effectDefinitions}
                selectedIds={createDraft.effectDefinitionIds ?? []}
                disabled={isCreating}
                onChange={(effectDefinitionIds) => setCreateDraft((prev) => ({ ...prev, effectDefinitionIds }))}
              />
            )}
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
                    <p className="mb-3 text-xs text-gray-400">
                      가격/할인/판매기간/사용여부는 목록의 "가격" 버튼에서 판매가격 기간 단위로 관리합니다.
                    </p>
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
                      <Field label="카테고리">
                        <select
                          value={editDraft.category}
                          onChange={(e) => setEditDraft((prev) => prev && { ...prev, category: e.target.value as OptionalFeatureCategory })}
                          disabled={isSavingEdit}
                          className={inputClass}
                        >
                          {OPTIONAL_FEATURE_CATEGORY_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </Field>
                      {feature.code === 'EVENT_EFFECT_BUNDLE' && (
                        <EffectDefinitionPicker
                          definitions={effectDefinitions}
                          selectedIds={editDraft.effectDefinitionIds ?? []}
                          disabled={isSavingEdit}
                          onChange={(effectDefinitionIds) => setEditDraft((prev) => prev && { ...prev, effectDefinitionIds })}
                        />
                      )}
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
                    {feature.salePrice === null
                      ? '-'
                      : `${formatSupplyPrice(feature.supplyPrice, feature.currencyCode ?? 'KRW')} / ${formatPrice(feature.salePrice, feature.currencyCode ?? 'KRW')}`}
                  </td>
                  <td className="py-2">
                    {feature.discountType === null || feature.discountValue === null
                      ? '-'
                      : formatDiscount(feature.discountType, feature.discountValue)}
                  </td>
                  <td className="py-2">
                    <PeriodStatusBadge status={feature.periodStatus} />
                    <span className="ml-1.5 text-xs text-gray-400">사용 {feature.usageCount}건</span>
                  </td>
                  <td className="py-2 text-xs">
                    <div className="text-gray-600">{OPTIONAL_FEATURE_CATEGORY_LABEL[feature.category] ?? feature.category}</div>
                    {feature.code === 'EVENT_EFFECT_BUNDLE' && (
                      <div className="mt-0.5 text-gray-400">효과 {feature.effectDefinitionIds.length}종</div>
                    )}
                    {feature.exclusivityGroup && (
                      <div className="mt-0.5 text-gray-400">배타 그룹: {feature.exclusivityGroup}</div>
                    )}
                  </td>
                  <td className="py-2 px-4 text-right">
                    <button
                      onClick={() => setPeriodItemId(feature.id)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-gray-200 text-gray-500 text-xs font-medium hover:border-gray-400 hover:text-gray-950"
                    >
                      가격
                    </button>
                    <button
                      onClick={() => openHistory(feature.id)}
                      className="ml-1.5 inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-gray-200 text-gray-500 text-xs font-medium hover:border-gray-400 hover:text-gray-950"
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
                <p className="text-sm text-gray-950 font-medium">
                  {OPTIONAL_FEATURE_CODE_LABEL[history.code] ?? history.code} · {history.name}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {OPTIONAL_FEATURE_CATEGORY_LABEL[history.category] ?? history.category}
                  {history.exclusivityGroup && ` · 배타 그룹: ${history.exclusivityGroup}`}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">{formatDateTime(history.createdAt)}</p>
              </li>
            ))}
          </ul>
        )}
      </Modal>

      <PricePeriodManagerModal
        itemId={periodItemId}
        basePath="/platform-admin/optional-features"
        onClose={() => setPeriodItemId(null)}
        onChanged={() => fetchFeatures().then(setFeatures)}
        showSnackbar={showSnackbar}
      />
    </section>
  );
};

const EMPTY_ADDON_DRAFT = (): CreateCapacityAddOnRequest => ({
  capacityType: 'SIGNERS',
  unitAmount: 1,
  secondaryCapacityType: null,
  secondaryUnitAmount: null,
  currencyCode: 'KRW',
  supplyPrice: null,
  salePrice: 0,
  discountType: 'PERCENT',
  discountValue: 0,
  taxCode: 'KR_VAT_STANDARD',
  active: true,
  effectiveFrom: todayIsoDate(),
  effectiveTo: null,
});

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

  const [periodItemId, setPeriodItemId] = useState<number | null>(null);

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
            <Field label="통화">
              <select value={createDraft.currencyCode} onChange={(e) => setCreateDraft((prev) => ({ ...prev, currencyCode: e.target.value }))} disabled={isCreating} className={inputClass}>
                {['KRW', 'USD', 'EUR', 'JPY'].map((currency) => <option key={currency} value={currency}>{currency}</option>)}
              </select>
            </Field>
            <Field label="공급가">
              <input
                type="number"
                min={0}
                value={createDraft.supplyPrice === null ? '' : createDraft.supplyPrice}
                onChange={(e) => setCreateDraft((prev) => ({ ...prev, supplyPrice: e.target.value === '' ? null : Number(e.target.value) }))}
                placeholder="미상"
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
            <Field label="판매 시작일">
              <input
                type="date"
                value={createDraft.effectiveFrom}
                onChange={(e) => setCreateDraft((prev) => ({ ...prev, effectiveFrom: e.target.value }))}
                disabled={isCreating}
                className={inputClass}
              />
            </Field>
            <Field label="판매 종료일(무기한이면 비움)">
              <input
                type="date"
                value={createDraft.effectiveTo ?? ''}
                onChange={(e) => setCreateDraft((prev) => ({ ...prev, effectiveTo: e.target.value === '' ? null : e.target.value }))}
                disabled={isCreating}
                className={inputClass}
              />
            </Field>
            <ActiveField
              active={createDraft.active}
              disabled={isCreating}
              onChange={(active) => setCreateDraft((prev) => ({ ...prev, active }))}
            />
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
                    <p className="mb-3 text-xs text-gray-400">
                      가격/할인/판매기간/사용여부는 목록의 "가격" 버튼에서 판매가격 기간 단위로 관리합니다.
                    </p>
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
                    {addOn.salePrice === null
                      ? '-'
                      : `${formatSupplyPrice(addOn.supplyPrice, addOn.currencyCode ?? 'KRW')} / ${formatPrice(addOn.salePrice, addOn.currencyCode ?? 'KRW')}`}
                  </td>
                  <td className="py-2">
                    {addOn.discountType === null || addOn.discountValue === null ? '-' : formatDiscount(addOn.discountType, addOn.discountValue)}
                  </td>
                  <td className="py-2">
                    <PeriodStatusBadge status={addOn.periodStatus} />
                    <span className="ml-1.5 text-xs text-gray-400">사용 {addOn.usageCount}건</span>
                  </td>
                  <td className="py-2 px-4 text-right">
                    <button
                      onClick={() => setPeriodItemId(addOn.id)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-gray-200 text-gray-500 text-xs font-medium hover:border-gray-400 hover:text-gray-950"
                    >
                      가격
                    </button>
                    <button
                      onClick={() => openHistory(addOn.id)}
                      className="ml-1.5 inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-gray-200 text-gray-500 text-xs font-medium hover:border-gray-400 hover:text-gray-950"
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
                <p className="text-sm text-gray-950 font-medium">
                  {CAPACITY_TYPE_LABEL[history.capacityType] ?? history.capacityType} +{history.unitAmount}
                  {history.secondaryCapacityType &&
                    ` · ${CAPACITY_TYPE_LABEL[history.secondaryCapacityType] ?? history.secondaryCapacityType} +${history.secondaryUnitAmount}`}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">{formatDateTime(history.createdAt)}</p>
              </li>
            ))}
          </ul>
        )}
      </Modal>

      <PricePeriodManagerModal
        itemId={periodItemId}
        basePath="/platform-admin/capacity-addons"
        onClose={() => setPeriodItemId(null)}
        onChanged={() => fetchAddOns().then(setAddOns)}
        showSnackbar={showSnackbar}
      />
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
