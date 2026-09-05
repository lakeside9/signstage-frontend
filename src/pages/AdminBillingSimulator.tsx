import { useEffect, useMemo, useState } from 'react';
import type { FC } from 'react';
import { Building2, Calculator, Loader2, Receipt, Search, X } from 'lucide-react';
import { api } from '../utils/api';
import { formatCurrency } from '../utils/internationalization';
import type {
  BillingPlanSummary,
  CapacityAddOnSummary,
  CapacityType,
  DiscountType,
  OptionalFeatureCode,
  OptionalFeatureSummary,
  OrganizationDiscountOverview,
  PageResponse,
  PlatformAdminOrganizationSummary,
} from '../types';

const DISCOUNT_TYPE_OPTIONS: Array<{ value: DiscountType; label: string }> = [
  { value: 'PERCENT', label: '퍼센트' },
  { value: 'FIXED_AMOUNT', label: '정액' },
];

/**
 * 선택옵션/용량 추가구매 코드를 장비·인력·애플리케이션 3분류로 묶어 보여주기 위한
 * 화면 전용 매핑 — signstage-docs business/ceremony-support-services-billing-review.md
 * 3.3절의 "(안 A) 매핑 테이블" 방식을 그대로 구현한다. 백엔드 스키마 변경 없이 프런트
 * 코드만으로 분류를 표시한다. 아직 카탈로그에 인력 카테고리 상품(현장지원/온라인지원)이
 * 없는 건 정상이다 — 같은 문서 4장 결정이 나고 OptionalFeatureCode/CapacityType에 실제
 * 값이 추가되면 이 매핑에 한 줄만 추가하면 된다.
 */
const OPTION_CATEGORY_BY_CODE: Record<OptionalFeatureCode, string> = {
  SIGNER_FIELD_ZOOM: '애플리케이션',
  ALL_SIGNED_FIREWORKS: '애플리케이션',
  VIDEO_ATTENDANCE: '애플리케이션',
  TABLET_RENTAL: '장비',
};

const OPTION_CATEGORY_ORDER = ['장비', '인력', '애플리케이션'];

const ADDON_CATEGORY_BY_TYPE: Record<CapacityType, string> = {
  SIGNERS: '필수옵션 상향',
  TEMPLATES: '필수옵션 상향',
  TEST_EVENTS: '필수옵션 상향',
  REHEARSAL_EVENTS: '필수옵션 상향',
  MAIN_EVENTS: '필수옵션 상향',
  TABLETS: '장비',
};

const ADDON_CATEGORY_ORDER = ['필수옵션 상향', '장비', '인력'];

const CAPACITY_TYPE_LABEL: Record<CapacityType, string> = {
  SIGNERS: '서명자',
  TEMPLATES: '템플릿',
  TEST_EVENTS: '테스트 행사',
  REHEARSAL_EVENTS: '리허설 행사',
  MAIN_EVENTS: '본행사',
  TABLETS: '태블릿',
};

const formatPrice = (value: number, currencyCode = 'KRW') => formatCurrency(value, currencyCode);
const formatDiscount = (discountType: DiscountType, discountValue: number) =>
  discountType === 'PERCENT' ? `${discountValue}%` : formatPrice(discountValue);

/** signstage-docs business/ceremony-billing-consolidated-simulation-reference.md §2 공식 그대로. */
const appliedPrice = (salePrice: number, discountType: DiscountType, discountValue: number) => {
  const discount = discountType === 'PERCENT' ? salePrice * (discountValue / 100) : discountValue;
  return Math.max(0, salePrice - discount);
};

interface ResolvedDiscount {
  discountType: DiscountType;
  discountValue: number;
  overridden: boolean;
}

/** 조직×품목 오버라이드가 있으면 그 값을, 없으면 카탈로그 값을 쓴다(할인 문서 4.1절). */
function resolveDiscount<T extends { discountType: DiscountType; discountValue: number }>(
  catalogItem: T,
  override: { discountType: DiscountType; discountValue: number } | undefined,
): ResolvedDiscount {
  if (override) {
    return { discountType: override.discountType, discountValue: override.discountValue, overridden: true };
  }
  return { discountType: catalogItem.discountType, discountValue: catalogItem.discountValue, overridden: false };
}

interface LedgerLine {
  key: string;
  label: string;
  sub: string;
  amount: number;
  overridden: boolean;
}

/**
 * 플랫폼 관리자용 행사(Ceremony) 과금 시뮬레이터. 실제 카탈로그(GET /billing-plans,
 * /optional-features, /capacity-addons)와 조직×품목 할인 오버라이드(GET
 * /platform-admin/organizations/{id}/billing-discounts)를 그대로 읽어와, 행사를 실제로
 * 만들지 않고도 "이 조합이면 얼마"를 미리 계산해본다.
 *
 * 계산 공식은 signstage-docs business/ceremony-billing-consolidated-simulation-reference.md
 * §2를 그대로 구현한다: 정가 → 품목 할인(조직 오버라이드 있으면 그 값) → 소계 → 건별
 * 재량 할인(이 화면에서는 실제 Ceremony에 저장하지 않는 가상 입력값) → 최종가.
 *
 * 조회 전용 화면이라 등록/수정 권한(canManagePlatform) 검사가 없다 — 쓰는 API가 전부
 * PLATFORM_SUPPORT 이상 누구나 조회 가능한 엔드포인트다.
 */
export const AdminBillingSimulator: FC = () => {
  const [plans, setPlans] = useState<BillingPlanSummary[]>([]);
  const [options, setOptions] = useState<OptionalFeatureSummary[]>([]);
  const [addOns, setAddOns] = useState<CapacityAddOnSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);
  const [selectedOptionIds, setSelectedOptionIds] = useState<Set<number>>(new Set());
  const [addOnQuantities, setAddOnQuantities] = useState<Record<number, number>>({});

  const [orgSearchTerm, setOrgSearchTerm] = useState('');
  const [orgResults, setOrgResults] = useState<PlatformAdminOrganizationSummary[]>([]);
  const [isOrgSearching, setIsOrgSearching] = useState(false);
  const [selectedOrg, setSelectedOrg] = useState<PlatformAdminOrganizationSummary | null>(null);
  const [orgOverview, setOrgOverview] = useState<OrganizationDiscountOverview | null>(null);
  const [isOverviewLoading, setIsOverviewLoading] = useState(false);

  const [finalDiscountType, setFinalDiscountType] = useState<DiscountType>('FIXED_AMOUNT');
  const [finalDiscountValue, setFinalDiscountValue] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [plansRes, optionsRes, addOnsRes] = await Promise.all([
          api.get('/billing-plans'),
          api.get('/optional-features'),
          api.get('/capacity-addons'),
        ]);
        if (cancelled) return;
        const planList = plansRes.data as BillingPlanSummary[];
        setPlans(planList);
        setOptions(optionsRes.data as OptionalFeatureSummary[]);
        setAddOns(addOnsRes.data as CapacityAddOnSummary[]);
        const defaultPlan = planList.find((p) => p.active) ?? planList[0];
        if (defaultPlan) setSelectedPlanId(defaultPlan.id);
      } catch (err) {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : '과금 카탈로그를 불러오지 못했습니다.');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // 조직 검색 — 입력할 때마다 조회하되(간단한 콤보박스라 SearchBar의 "제출 시에만 조회"
  // 규약을 따르지 않는다) 300ms 디바운스로 과도한 요청을 막는다. "검색 중" 표시를 켜는
  // setIsOrgSearching(true)는 이 effect가 아니라 handleOrgSearchTermChange(입력 이벤트)가
  // 맡는다 — effect 본문에서 곧장 setState를 부르면 react-hooks/set-state-in-effect에
  // 걸린다(AdminOrganizationList.tsx의 검색 로딩 패턴과 동일하게 맞췄다).
  useEffect(() => {
    if (!orgSearchTerm.trim()) return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const query = new URLSearchParams({ name: orgSearchTerm.trim(), page: '0', size: '8' });
        const response = await api.get(`/platform-admin/organizations?${query.toString()}`);
        if (!cancelled) {
          setOrgResults((response.data as PageResponse<PlatformAdminOrganizationSummary>).content);
        }
      } catch {
        if (!cancelled) setOrgResults([]);
      } finally {
        if (!cancelled) setIsOrgSearching(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [orgSearchTerm]);

  // selectedOrg가 null로 바뀔 때 orgOverview를 비우는 것도, 조직을 고를 때 로딩 표시를
  // 켜는 것도 이 effect가 아니라 handleClearOrg/onSelect(이벤트 핸들러)가 맡는다(위와 같은 이유).
  useEffect(() => {
    if (!selectedOrg) return;
    let cancelled = false;
    (async () => {
      try {
        const response = await api.get(`/platform-admin/organizations/${selectedOrg.id}/billing-discounts`);
        if (!cancelled) setOrgOverview(response.data as OrganizationDiscountOverview);
      } catch {
        if (!cancelled) setOrgOverview(null);
      } finally {
        if (!cancelled) setIsOverviewLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedOrg]);

  const toggleOption = (id: number) => {
    setSelectedOptionIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const setAddOnQuantity = (id: number, quantity: number) => {
    setAddOnQuantities((prev) => ({ ...prev, [id]: Math.max(0, quantity) }));
  };

  const selectedPlan = plans.find((p) => p.id === selectedPlanId) ?? null;

  const { lines, subtotal, finalDiscountAmount, total, clamped, marginSale, marginSupply } = useMemo(() => {
    const resultLines: LedgerLine[] = [];
    let sale = 0;
    let supply = 0;

    if (selectedPlan) {
      const override = orgOverview?.billingPlanDiscounts.find((d) => d.billingPlanId === selectedPlan.id);
      const resolved = resolveDiscount(selectedPlan, override);
      const applied = appliedPrice(selectedPlan.salePrice, resolved.discountType, resolved.discountValue);
      resultLines.push({
        key: `plan-${selectedPlan.id}`,
        label: `${selectedPlan.name} (플랜)`,
        sub: `필수옵션 포함 · 할인 ${formatDiscount(resolved.discountType, resolved.discountValue)}`,
        amount: applied,
        overridden: resolved.overridden,
      });
      sale += applied;
      supply += selectedPlan.supplyPrice;
    }

    options
      .filter((o) => selectedOptionIds.has(o.id))
      .forEach((o) => {
        const override = orgOverview?.optionalFeatureDiscounts.find((d) => d.optionalFeatureId === o.id);
        const resolved = resolveDiscount(o, override);
        const applied = appliedPrice(o.salePrice, resolved.discountType, resolved.discountValue);
        resultLines.push({
          key: `opt-${o.id}`,
          label: o.name,
          sub: `${OPTION_CATEGORY_BY_CODE[o.code] ?? '기타'} · 선택옵션 · 할인 ${formatDiscount(resolved.discountType, resolved.discountValue)}`,
          amount: applied,
          overridden: resolved.overridden,
        });
        sale += applied;
        supply += o.supplyPrice;
      });

    addOns
      .filter((a) => (addOnQuantities[a.id] ?? 0) > 0)
      .forEach((a) => {
        const quantity = addOnQuantities[a.id] ?? 0;
        const override = orgOverview?.capacityAddOnDiscounts.find((d) => d.capacityAddOnId === a.id);
        const resolved = resolveDiscount(a, override);
        const unitApplied = appliedPrice(a.salePrice, resolved.discountType, resolved.discountValue);
        const lineTotal = unitApplied * quantity;
        const bundleNote = a.secondaryCapacityType
          ? ` (+${a.unitAmount} ${CAPACITY_TYPE_LABEL[a.capacityType]} · +${a.secondaryUnitAmount} ${CAPACITY_TYPE_LABEL[a.secondaryCapacityType]})`
          : ` (+${a.unitAmount} ${CAPACITY_TYPE_LABEL[a.capacityType]})`;
        resultLines.push({
          key: `addon-${a.id}`,
          label: `${CAPACITY_TYPE_LABEL[a.capacityType]} 추가구매${bundleNote}`,
          sub: `${ADDON_CATEGORY_BY_TYPE[a.capacityType]} · ${quantity}건 × ${formatPrice(unitApplied)}`,
          amount: lineTotal,
          overridden: resolved.overridden,
        });
        sale += lineTotal;
        supply += a.supplyPrice * quantity;
      });

    const subtotalValue = resultLines.reduce((s, l) => s + l.amount, 0);
    const discountAmount = Math.max(
      0,
      finalDiscountType === 'PERCENT' ? subtotalValue * (finalDiscountValue / 100) : finalDiscountValue,
    );
    const rawTotal = subtotalValue - discountAmount;

    return {
      lines: resultLines,
      subtotal: subtotalValue,
      finalDiscountAmount: discountAmount,
      total: Math.max(0, rawTotal),
      clamped: rawTotal < 0,
      marginSale: sale,
      marginSupply: supply,
    };
  }, [selectedPlan, options, selectedOptionIds, addOns, addOnQuantities, orgOverview, finalDiscountType, finalDiscountValue]);

  const groupedOptions = OPTION_CATEGORY_ORDER.map((category) => ({
    category,
    items: options.filter((o) => (OPTION_CATEGORY_BY_CODE[o.code] ?? '기타') === category),
  }));

  const groupedAddOns = ADDON_CATEGORY_ORDER.map((category) => ({
    category,
    items: addOns.filter((a) => (ADDON_CATEGORY_BY_TYPE[a.capacityType] ?? '기타') === category),
  }));

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-gray-400">
        <Loader2 size={24} className="animate-spin" />
      </div>
    );
  }

  if (loadError) {
    return <p className="text-sm text-red-600">{loadError}</p>;
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-gray-950 flex items-center gap-2">
          <Calculator size={20} className="text-gray-400" />
          과금 시뮬레이터
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          실제 카탈로그와 파트너 할인 오버라이드를 그대로 읽어와, 행사를 만들지 않고 예상 청구 금액을 미리 계산합니다.
          계산 공식은 signstage-docs business/ceremony-billing-consolidated-simulation-reference.md §2를 따릅니다.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-4 items-start">
        <div className="space-y-4 min-w-0">
          <OrganizationPicker
            searchTerm={orgSearchTerm}
            onSearchTermChange={(value) => {
              setOrgSearchTerm(value);
              if (!value.trim()) {
                setOrgResults([]);
                setIsOrgSearching(false);
              } else {
                setIsOrgSearching(true);
              }
            }}
            results={orgResults}
            isSearching={isOrgSearching}
            selectedOrg={selectedOrg}
            onSelect={(org) => {
              setSelectedOrg(org);
              setIsOverviewLoading(true);
              setOrgSearchTerm('');
              setOrgResults([]);
            }}
            onClear={() => {
              setSelectedOrg(null);
              setOrgOverview(null);
            }}
            isOverviewLoading={isOverviewLoading}
          />

          <section className="bg-white border border-gray-200 rounded-lg p-4">
            <h2 className="text-sm font-bold text-gray-950 mb-3">① 플랜 선택</h2>
            {plans.length === 0 ? (
              <p className="text-sm text-gray-400">등록된 과금 플랜이 없습니다.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {plans.map((plan) => {
                  const override = orgOverview?.billingPlanDiscounts.find((d) => d.billingPlanId === plan.id);
                  const resolved = resolveDiscount(plan, override);
                  const isSelected = selectedPlanId === plan.id;
                  return (
                    <label
                      key={plan.id}
                      className={`block border rounded-lg p-3 cursor-pointer transition-colors ${
                        isSelected ? 'border-gray-950 bg-gray-50' : 'border-gray-200 hover:border-gray-300'
                      } ${!plan.active ? 'opacity-50' : ''}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <input
                            type="radio"
                            name="plan"
                            checked={isSelected}
                            onChange={() => setSelectedPlanId(plan.id)}
                          />
                          <span className="text-sm font-bold text-gray-950">{plan.name}</span>
                        </div>
                        {!plan.active && (
                          <span className="text-xs text-gray-400 border border-gray-200 rounded-full px-2 py-0.5">
                            미사용
                          </span>
                        )}
                      </div>
                      <p className="mt-1.5 text-xs text-gray-600 tabular-nums">
                        {formatPrice(plan.salePrice)} · 할인 {formatDiscount(resolved.discountType, resolved.discountValue)}
                        {resolved.overridden && <OrgOverrideBadge />}
                      </p>
                      <p className="mt-1 text-xs text-gray-400">
                        서명자 {plan.maxSigners}/템플릿 {plan.maxTemplates}/테스트 {plan.maxTestEvents}/리허설{' '}
                        {plan.maxRehearsalEvents}/본행사 {plan.maxMainEvents}
                      </p>
                    </label>
                  );
                })}
              </div>
            )}
          </section>

          <section className="bg-white border border-gray-200 rounded-lg p-4">
            <h2 className="text-sm font-bold text-gray-950 mb-1">② 선택옵션</h2>
            <p className="text-xs text-gray-400 mb-3">
              장비/인력/애플리케이션 분류는 화면에서 코드별로 나눠 보여주는 것일 뿐, 카탈로그 데이터 자체에 분류
              필드가 있는 건 아닙니다(향후 검토, ceremony-support-services-billing-review.md 참고).
            </p>
            <div className="space-y-4">
              {groupedOptions.map(({ category, items }) => (
                <div key={category}>
                  <h3 className="text-xs font-bold text-gray-500 mb-2">{category}</h3>
                  {items.length === 0 ? (
                    <p className="text-xs text-gray-400">
                      {category === '인력'
                        ? '아직 등록된 인력 카테고리 상품이 없습니다 — 현장지원/온라인지원은 검토 단계입니다.'
                        : '등록된 항목이 없습니다.'}
                    </p>
                  ) : (
                    <div className="space-y-1.5">
                      {items.map((o) => {
                        const override = orgOverview?.optionalFeatureDiscounts.find((d) => d.optionalFeatureId === o.id);
                        const resolved = resolveDiscount(o, override);
                        const checked = selectedOptionIds.has(o.id);
                        return (
                          <label
                            key={o.id}
                            className={`flex items-center justify-between gap-3 border rounded-md px-3 py-2 cursor-pointer ${
                              checked ? 'border-gray-950 bg-gray-50' : 'border-gray-200 hover:border-gray-300'
                            } ${!o.active ? 'opacity-50' : ''}`}
                          >
                            <span className="flex items-center gap-2 min-w-0">
                              <input type="checkbox" checked={checked} onChange={() => toggleOption(o.id)} />
                              <span className="text-sm text-gray-950 font-medium truncate">{o.name}</span>
                              {!o.active && <span className="text-xs text-gray-400 shrink-0">미사용</span>}
                            </span>
                            <span className="text-xs text-gray-600 shrink-0 tabular-nums">
                              {formatPrice(o.salePrice)} · 할인 {formatDiscount(resolved.discountType, resolved.discountValue)}
                              {resolved.overridden && <OrgOverrideBadge />}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>

          <section className="bg-white border border-gray-200 rounded-lg p-4">
            <h2 className="text-sm font-bold text-gray-950 mb-3">③ 용량 추가구매</h2>
            <div className="space-y-4">
              {groupedAddOns.map(({ category, items }) => (
                <div key={category}>
                  <h3 className="text-xs font-bold text-gray-500 mb-2">{category}</h3>
                  {items.length === 0 ? (
                    <p className="text-xs text-gray-400">
                      {category === '인력'
                        ? '아직 등록된 인력 카테고리 상품이 없습니다.'
                        : '등록된 항목이 없습니다.'}
                    </p>
                  ) : (
                    <div className="space-y-1.5">
                      {items.map((a) => {
                        const override = orgOverview?.capacityAddOnDiscounts.find((d) => d.capacityAddOnId === a.id);
                        const resolved = resolveDiscount(a, override);
                        const quantity = addOnQuantities[a.id] ?? 0;
                        return (
                          <div
                            key={a.id}
                            className={`flex items-center justify-between gap-3 border rounded-md px-3 py-2 ${
                              quantity > 0 ? 'border-gray-950 bg-gray-50' : 'border-gray-200'
                            } ${!a.active ? 'opacity-50' : ''}`}
                          >
                            <div className="min-w-0">
                              <p className="text-sm text-gray-950 font-medium">
                                {CAPACITY_TYPE_LABEL[a.capacityType]} +{a.unitAmount}
                                {a.secondaryCapacityType &&
                                  a.secondaryUnitAmount != null &&
                                  ` / ${CAPACITY_TYPE_LABEL[a.secondaryCapacityType]} +${a.secondaryUnitAmount}`}
                                {!a.active && <span className="ml-2 text-xs text-gray-400">미사용</span>}
                              </p>
                              <p className="text-xs text-gray-500 tabular-nums">
                                {formatPrice(a.salePrice)} · 할인 {formatDiscount(resolved.discountType, resolved.discountValue)}
                                {resolved.overridden && <OrgOverrideBadge />}
                              </p>
                            </div>
                            <label className="flex items-center gap-1.5 text-xs text-gray-500 shrink-0">
                              구매 수량
                              <input
                                type="number"
                                min={0}
                                value={quantity === 0 ? '' : quantity}
                                onChange={(e) => setAddOnQuantity(a.id, Number(e.target.value))}
                                placeholder="0"
                                className="w-16 px-2 py-1 border border-gray-200 rounded-md text-sm text-right focus:ring-2 focus:ring-gray-950/10 focus:border-gray-400 outline-none"
                              />
                              건
                            </label>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>

          <section className="bg-white border border-gray-200 rounded-lg p-4">
            <h2 className="text-sm font-bold text-gray-950 mb-1">④ 행사 건별 재량 할인 (가정)</h2>
            <p className="text-xs text-gray-400 mb-3">
              실제 시스템에서는 PLATFORM_OPS 이상만, 확정(IN_PROGRESS) 상태의 행사에만 설정할 수 있습니다. 이
              화면의 값은 실제 행사에 저장되지 않는 가상 입력입니다.
            </p>
            <div className="flex items-end gap-3 flex-wrap">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">방식</label>
                <select
                  value={finalDiscountType}
                  onChange={(e) => setFinalDiscountType(e.target.value as DiscountType)}
                  className="px-3 py-1.5 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-gray-950/10 focus:border-gray-400 outline-none"
                >
                  {DISCOUNT_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">값</label>
                <input
                  type="number"
                  min={0}
                  value={finalDiscountValue === 0 ? '' : finalDiscountValue}
                  onChange={(e) => setFinalDiscountValue(Number(e.target.value))}
                  placeholder="0"
                  className="w-32 px-3 py-1.5 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-gray-950/10 focus:border-gray-400 outline-none"
                />
              </div>
            </div>
          </section>
        </div>

        <Ledger
          lines={lines}
          subtotal={subtotal}
          finalDiscountType={finalDiscountType}
          finalDiscountValue={finalDiscountValue}
          finalDiscountAmount={finalDiscountAmount}
          total={total}
          clamped={clamped}
          marginSale={marginSale}
          marginSupply={marginSupply}
        />
      </div>
    </div>
  );
};

const OrgOverrideBadge: FC = () => (
  <span className="ml-1.5 inline-block px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-indigo-50 text-indigo-700 border border-indigo-200">
    파트너 할인 적용
  </span>
);

interface OrganizationPickerProps {
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
  results: PlatformAdminOrganizationSummary[];
  isSearching: boolean;
  selectedOrg: PlatformAdminOrganizationSummary | null;
  onSelect: (org: PlatformAdminOrganizationSummary) => void;
  onClear: () => void;
  isOverviewLoading: boolean;
}

const OrganizationPicker: FC<OrganizationPickerProps> = ({
  searchTerm,
  onSearchTermChange,
  results,
  isSearching,
  selectedOrg,
  onSelect,
  onClear,
  isOverviewLoading,
}) => (
  <section className="bg-white border border-gray-200 rounded-lg p-4">
    <h2 className="text-sm font-bold text-gray-950 flex items-center gap-1.5 mb-1">
      <Building2 size={14} />
      파트너 (선택사항)
    </h2>
    <p className="text-xs text-gray-400 mb-3">
      파트너를 고르면 그 파트너에 설정된 품목별 할인 오버라이드가 자동으로 적용됩니다. 고르지 않으면 카탈로그 전역
      할인값으로 계산합니다.
    </p>

    {selectedOrg ? (
      <div className="flex items-center justify-between gap-2 bg-gray-50 border border-gray-200 rounded-md px-3 py-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-medium text-gray-950 truncate">{selectedOrg.name}</span>
          <span className="text-xs text-gray-400 shrink-0">{selectedOrg.code}</span>
          {isOverviewLoading && <Loader2 size={12} className="animate-spin text-gray-400 shrink-0" />}
        </div>
        <button
          onClick={onClear}
          className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-950 shrink-0"
        >
          <X size={12} />
          해제
        </button>
      </div>
    ) : (
      <div className="relative">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => onSearchTermChange(e.target.value)}
            placeholder="파트너명으로 검색"
            className="w-full pl-9 pr-3 py-1.5 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-gray-950/10 focus:border-gray-400 outline-none"
          />
        </div>
        {searchTerm.trim() && (
          <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-56 overflow-y-auto">
            {isSearching ? (
              <div className="flex items-center justify-center py-4 text-gray-400">
                <Loader2 size={16} className="animate-spin" />
              </div>
            ) : results.length === 0 ? (
              <p className="py-3 px-3 text-xs text-gray-400">검색 결과가 없습니다.</p>
            ) : (
              results.map((org) => (
                <button
                  key={org.id}
                  onClick={() => onSelect(org)}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center justify-between gap-2"
                >
                  <span className="text-gray-950 truncate">{org.name}</span>
                  <span className="text-xs text-gray-400 shrink-0">{org.code}</span>
                </button>
              ))
            )}
          </div>
        )}
      </div>
    )}
  </section>
);

interface LedgerProps {
  lines: LedgerLine[];
  subtotal: number;
  finalDiscountType: DiscountType;
  finalDiscountValue: number;
  finalDiscountAmount: number;
  total: number;
  clamped: boolean;
  marginSale: number;
  marginSupply: number;
}

const Ledger: FC<LedgerProps> = ({
  lines,
  subtotal,
  finalDiscountType,
  finalDiscountValue,
  finalDiscountAmount,
  total,
  clamped,
  marginSale,
  marginSupply,
}) => (
  <aside className="bg-white border border-gray-200 rounded-lg overflow-hidden sticky top-4">
    <div className="px-4 py-3 border-b border-gray-100">
      <h2 className="text-sm font-bold text-gray-950 flex items-center gap-1.5">
        <Receipt size={14} />
        예상 청구 금액
      </h2>
      <p className="text-xs text-gray-400 mt-0.5">정가 → 품목 할인 → 소계 → 건별 할인 → 최종가</p>
    </div>

    {lines.length === 0 ? (
      <p className="py-10 text-center text-sm text-gray-400">플랜을 고르면 계산이 시작됩니다.</p>
    ) : (
      <ul className="px-4 divide-y divide-gray-100">
        {lines.map((line) => (
          <li key={line.key} className="py-2.5 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm text-gray-950 font-medium truncate">{line.label}</p>
              <p className="text-xs text-gray-400 mt-0.5">{line.sub}</p>
            </div>
            <span className="text-sm text-gray-950 shrink-0 tabular-nums">{formatPrice(line.amount)}</span>
          </li>
        ))}
      </ul>
    )}

    <div className="px-4 py-2.5 border-t border-gray-100 flex justify-between text-sm text-gray-600">
      <span>소계</span>
      <span className="tabular-nums">{formatPrice(subtotal)}</span>
    </div>
    <div className="px-4 py-2.5 flex justify-between text-sm text-gray-600">
      <span>건별 할인 ({finalDiscountType === 'PERCENT' ? `${finalDiscountValue}%` : formatPrice(finalDiscountValue)})</span>
      <span className="tabular-nums text-emerald-700">−{formatPrice(finalDiscountAmount)}</span>
    </div>
    <div className="px-4 py-3.5 bg-gray-50 border-t border-gray-200 flex items-baseline justify-between">
      <span className="text-sm font-bold text-gray-950">최종가</span>
      <span className="text-xl font-bold text-gray-950 tabular-nums">{formatPrice(total)}</span>
    </div>
    {clamped && (
      <p className="px-4 pb-3 text-xs text-amber-700 bg-amber-50">할인이 소계를 초과해 0원으로 고정했습니다.</p>
    )}

    <details className="border-t border-gray-100 px-4 py-2.5">
      <summary className="text-xs text-gray-500 cursor-pointer select-none">
        내부 마진 보기 (공급가 기준, 사용자 비노출)
      </summary>
      <div className="mt-2 space-y-1 text-xs text-gray-600">
        <div className="flex justify-between">
          <span>판매 적용가 합계</span>
          <span className="tabular-nums">{formatPrice(marginSale)}</span>
        </div>
        <div className="flex justify-between">
          <span>공급가 합계</span>
          <span className="tabular-nums">{formatPrice(marginSupply)}</span>
        </div>
        <div className="flex justify-between font-bold text-emerald-700">
          <span>마진</span>
          <span className="tabular-nums">{formatPrice(marginSale - marginSupply)}</span>
        </div>
      </div>
    </details>
  </aside>
);
