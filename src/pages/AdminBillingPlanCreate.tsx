import { useEffect, useMemo, useState } from 'react';
import type { FC, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '../components/Button';
import { useSnackbarStore } from '../store/useSnackbarStore';
import { api } from '../utils/api';
import { ActiveField, Field, FinalPricePreview } from './billingCatalog/components';
import {
  DISCOUNT_TYPE_OPTIONS,
  TOGGLE_UNIT_PRODUCT_TYPES,
  UNIT_PRODUCT_TYPE_LABEL,
  formatPrice,
  inputClass,
  todayIsoDate,
} from './billingCatalog/constants';
import type { BillingPlanSummary, CreateBillingPlanRequest, DiscountType, PlanUnitProductLine, UnitProductSummary } from '../types';

const EMPTY_DRAFT = (): CreateBillingPlanRequest => ({
  name: '',
  discountType: 'PERCENT',
  discountValue: 0,
  active: true,
  effectiveFrom: todayIsoDate(),
  effectiveTo: null,
  planType: 'STANDARD',
});

/**
 * `includedQuantity: null`은 "이 단위 상품은 이 플랜 구성에 아예 없음"(추가구매도 안 됨)이다 —
 * 숫자(0 포함)를 입력해야 비로소 이 플랜의 행사가 그 상품을 추가구매할 수 있게 된다(행이
 * 존재하는 것 자체가 추가구매 후보라는 뜻, 2026-09-10 `purchasable` 필드 폐지). 그래서 빈
 * 입력칸과 명시적으로 입력한 "0"을 구분해야 하고, 값을 그냥 `number`로 두면 그 구분이 없어진다.
 */
interface LineDraft {
  includedQuantity: number | null;
}

const emptyLineDrafts = (products: UnitProductSummary[]): Record<number, LineDraft> =>
  Object.fromEntries(products.map((p) => [p.id, { includedQuantity: null }]));

/**
 * 과금 플랜 등록 — 전용 페이지형(detail-form-screen-convention.md 패턴 A). 제출 성공 시 같은
 * 페이지 안에서 "생성 완료" 뷰로 전환하고 "상세로 이동"/"계속 추가하기" 두 버튼으로 통일한다.
 * 플랜은 이제 자기 가격이 없다 — 단위 상품 구성(기본 포함 수량)과 할인만 갖는다(signstage-docs
 * business/billing-catalog-unit-product-model-redesign-review.md 결정, 2026-09-10, 3.3절).
 * "추가구매 후보" 체크박스는 없다 — 구성에 올린 상품(수량이 0이든 N이든)은 전부 그 자체로
 * 추가구매 후보다(같은 문서 11장, 2026-09-10 후속 정리 — 사용자 지적으로 태블릿/현장지원/
 * 온라인지원도 수량을 자유롭게 입력할 수 있게 됐고, 별도 플래그는 필요 없어졌다).
 */
export const AdminBillingPlanCreate: FC = () => {
  const [draft, setDraft] = useState<CreateBillingPlanRequest>(EMPTY_DRAFT);
  const [products, setProducts] = useState<UnitProductSummary[]>([]);
  const [lineDrafts, setLineDrafts] = useState<Record<number, LineDraft>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [created, setCreated] = useState<BillingPlanSummary | null>(null);

  const showSnackbar = useSnackbarStore((state) => state.showSnackbar);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await api.get('/unit-products');
        const data = response.data as UnitProductSummary[];
        if (!cancelled) {
          setProducts(data);
          setLineDrafts(emptyLineDrafts(data));
        }
      } catch (err) {
        if (!cancelled) showSnackbar(err instanceof Error ? err.message : '단위 상품 목록을 불러오지 못했습니다.', 'error');
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const subtotal = useMemo(
    () =>
      products.reduce((sum, p) => {
        const line = lineDrafts[p.id];
        if (!line || p.salePrice === null || line.includedQuantity === null) return sum;
        return sum + p.salePrice * line.includedQuantity;
      }, 0),
    [products, lineDrafts],
  );
  const currencyCode = products.find((p) => (lineDrafts[p.id]?.includedQuantity ?? 0) > 0)?.currencyCode ?? 'KRW';

  const buildLines = (): PlanUnitProductLine[] =>
    Object.entries(lineDrafts)
      .filter((entry): entry is [string, { includedQuantity: number }] => entry[1].includedQuantity !== null)
      .map(([unitProductId, line]) => ({
        unitProductId: Number(unitProductId),
        includedQuantity: line.includedQuantity,
      }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!draft.name.trim()) {
      showSnackbar('플랜 이름을 입력해주세요.', 'error');
      return;
    }
    if (draft.planType === 'SUBSCRIPTION') {
      if (!draft.subscriptionType || !draft.subscriptionAllowedCount) {
        showSnackbar('구독 유형과 허용 횟수를 입력해주세요.', 'error');
        return;
      }
      if (draft.subscriptionType === 'PERIOD_AND_COUNT' && !draft.subscriptionPeriodMonths) {
        showSnackbar('기간형(PERIOD_AND_COUNT)은 기간(6 또는 12개월)을 선택해주세요.', 'error');
        return;
      }
    }
    setIsLoading(true);
    try {
      const response = await api.post('/platform-admin/billing-plans', {
        ...draft,
        name: draft.name.trim(),
        unitProducts: buildLines(),
        subscriptionPeriodMonths: draft.planType === 'SUBSCRIPTION' && draft.subscriptionType === 'PERIOD_AND_COUNT'
          ? draft.subscriptionPeriodMonths
          : undefined,
      });
      setCreated(response.data as BillingPlanSummary);
      showSnackbar('과금 플랜을 등록했습니다.', 'success');
    } catch (err) {
      showSnackbar(err instanceof Error ? err.message : '과금 플랜 등록에 실패했습니다.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <Link
        to="/admin/billing-catalog/plans"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-950 mb-4"
      >
        <ArrowLeft size={16} />
        과금 플랜 목록으로
      </Link>

      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-950">과금 플랜 등록</h1>
        <p className="mt-1 text-sm text-gray-500">이름/할인을 정하고, 포함할 단위 상품 구성과 최초 할인 기간을 함께 만듭니다.</p>
      </div>

      {created ? (
        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-lg p-5">
            <p className="text-sm text-gray-500 mb-1">이름</p>
            <p className="text-base font-bold text-gray-950">{created.name}</p>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                setCreated(null);
                setDraft(EMPTY_DRAFT());
                setLineDrafts(emptyLineDrafts(products));
              }}
            >
              계속 추가하기
            </Button>
            <Button to={`/admin/billing-catalog/plans/${created.id}`}>상세로 이동</Button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-lg p-5 space-y-5">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <Field label="이름">
              <input
                type="text"
                value={draft.name}
                onChange={(e) => setDraft((prev) => ({ ...prev, name: e.target.value }))}
                disabled={isLoading}
                className={inputClass}
              />
            </Field>
            <Field label="할인 방식">
              <select
                value={draft.discountType}
                onChange={(e) => setDraft((prev) => ({ ...prev, discountType: e.target.value as DiscountType }))}
                disabled={isLoading}
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
                disabled={isLoading}
                className={inputClass}
              />
            </Field>
            <Field label="할인 적용 시작일">
              <input
                type="date"
                value={draft.effectiveFrom}
                onChange={(e) => setDraft((prev) => ({ ...prev, effectiveFrom: e.target.value }))}
                disabled={isLoading}
                className={inputClass}
              />
            </Field>
            <Field label="할인 적용 종료일(무기한이면 비움)">
              <input
                type="date"
                value={draft.effectiveTo ?? ''}
                onChange={(e) => setDraft((prev) => ({ ...prev, effectiveTo: e.target.value === '' ? null : e.target.value }))}
                disabled={isLoading}
                className={inputClass}
              />
            </Field>
            <ActiveField active={draft.active} disabled={isLoading} onChange={(active) => setDraft((prev) => ({ ...prev, active }))} />
          </div>

          <div className="border-t border-gray-100 pt-4">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-950 mb-3">
              <input
                type="checkbox"
                checked={draft.planType === 'SUBSCRIPTION'}
                disabled={isLoading}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    planType: e.target.checked ? 'SUBSCRIPTION' : 'STANDARD',
                    subscriptionType: e.target.checked ? (prev.subscriptionType ?? 'PERIOD_AND_COUNT') : undefined,
                    subscriptionPeriodMonths: e.target.checked ? (prev.subscriptionPeriodMonths ?? 6) : undefined,
                    subscriptionAllowedCount: e.target.checked ? prev.subscriptionAllowedCount : undefined,
                  }))
                }
              />
              구독형 플랜(N회 이용권)으로 만들기
            </label>
            {draft.planType === 'SUBSCRIPTION' && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <Field label="구독 유형">
                  <select
                    value={draft.subscriptionType ?? 'PERIOD_AND_COUNT'}
                    disabled={isLoading}
                    onChange={(e) =>
                      setDraft((prev) => ({
                        ...prev,
                        subscriptionType: e.target.value as 'PERIOD_AND_COUNT' | 'COUNT_ONLY',
                        subscriptionPeriodMonths: e.target.value === 'PERIOD_AND_COUNT' ? (prev.subscriptionPeriodMonths ?? 6) : undefined,
                      }))
                    }
                    className={inputClass}
                  >
                    <option value="PERIOD_AND_COUNT">기간+횟수 (예: 6개월 5회)</option>
                    <option value="COUNT_ONLY">횟수제 (기간 제한 없음)</option>
                  </select>
                </Field>
                {draft.subscriptionType !== 'COUNT_ONLY' && (
                  <Field label="기간">
                    <select
                      value={draft.subscriptionPeriodMonths ?? 6}
                      disabled={isLoading}
                      onChange={(e) => setDraft((prev) => ({ ...prev, subscriptionPeriodMonths: Number(e.target.value) }))}
                      className={inputClass}
                    >
                      <option value={6}>6개월</option>
                      <option value={12}>12개월</option>
                    </select>
                  </Field>
                )}
                <Field label="허용 횟수">
                  <input
                    type="number"
                    min={1}
                    value={draft.subscriptionAllowedCount ?? ''}
                    disabled={isLoading}
                    onChange={(e) => setDraft((prev) => ({ ...prev, subscriptionAllowedCount: Number(e.target.value) }))}
                    className={inputClass}
                  />
                </Field>
              </div>
            )}
            <p className="mt-1 text-xs text-gray-400">
              구독형 플랜은 조직이 신청 → 관리자가 승인해야 사용할 수 있고, 이 조건 4개는 등록 후 바꿀 수 없습니다(조건을
              바꾸려면 새 플랜을 등록해주세요).
            </p>
          </div>

          <div>
            <p className="text-xs text-gray-500 mb-1">
              단위 상품 소계: <span className="font-medium text-gray-950">{formatPrice(subtotal, currencyCode)}</span>
            </p>
            <FinalPricePreview
              salePrice={subtotal}
              discountType={draft.discountType}
              discountValue={draft.discountValue}
              currencyCode={currencyCode}
            />
          </div>

          <div>
            <span className="block text-xs font-medium text-gray-500 mb-1">단위 상품 구성</span>
            {products.length === 0 ? (
              <p className="text-xs text-gray-400">등록된 단위 상품이 없습니다. 먼저 단위 상품을 등록해주세요.</p>
            ) : (
              <div className="rounded-md border border-gray-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium">단위 상품</th>
                      <th className="text-left px-3 py-2 font-medium w-32">기본 포함 수량</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {products.map((product) => {
                      const line = lineDrafts[product.id] ?? { includedQuantity: null };
                      const isToggle = TOGGLE_UNIT_PRODUCT_TYPES.includes(product.type);
                      return (
                        <tr key={product.id}>
                          <td className="px-3 py-2">
                            <span className="text-gray-950">{product.name}</span>
                            <span className="ml-1.5 text-xs text-gray-400">
                              {UNIT_PRODUCT_TYPE_LABEL[product.type] ?? product.type}
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              min={0}
                              max={isToggle ? 1 : undefined}
                              value={line.includedQuantity ?? ''}
                              disabled={isLoading}
                              placeholder="—"
                              onChange={(e) => {
                                const raw = e.target.value;
                                setLineDrafts((prev) => ({
                                  ...prev,
                                  [product.id]: { includedQuantity: raw === '' ? null : Number(raw) },
                                }));
                              }}
                              className={`${inputClass} w-24`}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <p className="mt-1 text-xs text-gray-400">
              수량을 입력한 상품(0 포함)만 이 플랜 구성에 포함됩니다 — 빈 칸으로 두면 이 플랜과 무관한 상품입니다. 0을
              입력하면 기본 포함은 없지만 이 플랜의 행사가 추가구매할 수 있고, 1 이상을 입력하면 그 수량만큼 기본
              포함되면서 더 필요하면 추가구매도 할 수 있습니다(추가구매는 여전히 사용자가 요청하고 관리자가 승인해야
              합니다). 이벤트 효과 묶음은 토글형이라 수량이 0 또는 1만 가능합니다. 이 구성은 이후 수정 화면에서도
              통째로 바꿀 수 있습니다.
            </p>
          </div>

          <div className="flex justify-end gap-2">
            <Button to="/admin/billing-catalog/plans" variant="secondary">
              취소
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? '등록 중...' : '과금 플랜 등록'}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
};
