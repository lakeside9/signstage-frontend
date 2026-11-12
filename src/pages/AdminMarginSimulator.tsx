import { useEffect, useState } from 'react';
import type { FC, FormEvent } from 'react';
import { Calculator, Loader2, Plus, Trash2 } from 'lucide-react';
import { Button } from '../components/Button';
import { FormattedNumberInput } from '../components/FormattedNumberInput';
import { useSnackbarStore } from '../store/useSnackbarStore';
import { api } from '../utils/api';
import { Field } from './billingCatalog/components';
import { inputClass } from './billingCatalog/constants';
import { ScopeExtrasFields } from './order/components';
import { AcceptanceRate, AverageRating } from './order/evaluationComponents';
import { EMPTY_SCOPE_EXTRAS_DRAFT, REGION_OPTIONS, formatMoney, isLodgingDraftValid, toScopeExtras } from './order/constants';
import type { ScopeExtrasDraft } from './order/constants';
import type {
  BillingPlanSummary,
  MarginPartnerQuote,
  MarginSimulation,
  MarginSimulationRequest,
  ServiceRegion,
  UnitProductSummary,
} from '../types';

interface OptionDraft {
  unitProductId: string;
  quantity: string;
}

interface SimulationDraft {
  billingPlanId: string;
  region: ServiceRegion;
  options: OptionDraft[];
  extras: ScopeExtrasDraft;
  discountAmount: string;
  adjustmentAmount: string;
}

const EMPTY_DRAFT: SimulationDraft = {
  billingPlanId: '', region: 'CAPITAL', options: [], extras: EMPTY_SCOPE_EXTRAS_DRAFT, discountAmount: '', adjustmentAmount: '',
};

const MarginCell: FC<{ quote: MarginPartnerQuote; currency: string }> = ({ quote, currency }) => {
  if (quote.partnerAmount === null) return <span className="text-gray-400">단가표 없음</span>;
  return (
    <span className={quote.marginSufficient ? 'text-gray-950' : 'text-red-600'}>
      {formatMoney(quote.marginAmount, currency)}
      <span className="ml-1 text-xs">({quote.marginRatePercent ?? '-'}%)</span>
      {!quote.marginSufficient && <p className="text-xs">최소 마진 미달 — 발주 불가</p>}
    </span>
  );
};

/**
 * 영업 마진 시뮬레이션(플랫폼 관리자) — signstage-docs business/platform-order-partner-subcontract-review.md
 * 11장 8단계. 견적 입력으로 고객 금액을 계산하고 기본 단가표·파트너별 단가표의 발주 금액과 마진을
 * 파트너 평가와 함께 비교한다. 수주 견적·발주와 같은 계산이며 아무것도 저장하지 않는다.
 */
export const AdminMarginSimulator: FC = () => {
  const showSnackbar = useSnackbarStore((state) => state.showSnackbar);

  const [draft, setDraft] = useState<SimulationDraft>(EMPTY_DRAFT);
  const [plans, setPlans] = useState<BillingPlanSummary[]>([]);
  const [unitProducts, setUnitProducts] = useState<UnitProductSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCalculating, setIsCalculating] = useState(false);
  const [result, setResult] = useState<MarginSimulation | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [planRes, productRes] = await Promise.all([api.get('/billing-plans'), api.get('/unit-products')]);
        if (cancelled) return;
        setPlans((planRes.data as BillingPlanSummary[]).filter((plan) => !plan.subscription && plan.active !== false));
        setUnitProducts(productRes.data as UnitProductSummary[]);
      } catch (err) {
        if (!cancelled) showSnackbar(err instanceof Error ? err.message : '상품 정보를 불러오지 못했습니다.', 'error');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [showSnackbar]);

  const update = <K extends keyof SimulationDraft>(field: K, value: SimulationDraft[K]) =>
    setDraft((prev) => ({ ...prev, [field]: value }));

  const updateOption = (index: number, patch: Partial<OptionDraft>) =>
    update('options', draft.options.map((option, i) => (i === index ? { ...option, ...patch } : option)));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!draft.billingPlanId) {
      showSnackbar('패키지를 선택해주세요.', 'error');
      return;
    }
    if (!isLodgingDraftValid(draft.extras)) {
      showSnackbar('숙박은 박수와 인원을 함께 입력해주세요.', 'error');
      return;
    }
    const request: MarginSimulationRequest = {
      billingPlanId: Number(draft.billingPlanId),
      region: draft.region,
      options: draft.options
        .filter((option) => option.unitProductId && Number(option.quantity) > 0)
        .map((option) => ({ unitProductId: Number(option.unitProductId), quantity: Number(option.quantity) })),
      discountAmount: draft.discountAmount === '' ? null : Number(draft.discountAmount),
      adjustmentAmount: draft.adjustmentAmount === '' ? null : Number(draft.adjustmentAmount),
      ...toScopeExtras(draft.extras),
    };
    setIsCalculating(true);
    try {
      const response = await api.post('/platform-admin/margin-simulations', request);
      setResult(response.data as MarginSimulation);
    } catch (err) {
      showSnackbar(err instanceof Error ? err.message : '계산에 실패했습니다.', 'error');
    } finally {
      setIsCalculating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-gray-400">
        <Loader2 size={24} className="animate-spin" />
      </div>
    );
  }

  const selectedPlan = plans.find((plan) => String(plan.id) === draft.billingPlanId);
  const currency = result?.currencyCode;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-950 flex items-center gap-2">
          <Calculator size={20} className="text-gray-400" />
          마진 시뮬레이션
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          견적 조건을 넣으면 고객 금액과 파트너별 발주 금액·마진을 비교합니다. 저장되지 않습니다.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] gap-4 items-start">
        <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
          <Field label="패키지(범위 플랜)">
            <select
              value={draft.billingPlanId}
              onChange={(e) => update('billingPlanId', e.target.value)}
              disabled={isCalculating}
              className={`${inputClass} bg-white`}
            >
              <option value="">선택</option>
              {plans.map((plan) => (
                <option key={plan.id} value={plan.id}>{plan.name}</option>
              ))}
            </select>
          </Field>
          {selectedPlan && (
            <p className="text-xs text-gray-500">
              포함: {selectedPlan.unitProducts.map((line) => `${line.unitProductName} ${line.includedQuantity}`).join(', ') || '없음'}
            </p>
          )}
          <Field label="권역">
            <select
              value={draft.region}
              onChange={(e) => update('region', e.target.value as ServiceRegion)}
              disabled={isCalculating}
              className={`${inputClass} bg-white`}
            >
              {REGION_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </Field>
          <div>
            <div className="mb-1 flex items-center justify-between">
              <span className="text-xs font-medium text-gray-500">추가 옵션</span>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => update('options', [...draft.options, { unitProductId: '', quantity: '1' }])}
                disabled={isCalculating}
              >
                <Plus size={12} /> 옵션 추가
              </Button>
            </div>
            <ul className="space-y-2">
              {draft.options.map((option, index) => (
                <li key={index} className="flex items-center gap-2">
                  <select
                    value={option.unitProductId}
                    onChange={(e) => updateOption(index, { unitProductId: e.target.value })}
                    disabled={isCalculating}
                    className={`${inputClass} bg-white flex-1 min-w-0`}
                  >
                    <option value="">선택</option>
                    {unitProducts.map((product) => (
                      <option key={product.id} value={product.id}>{product.name}</option>
                    ))}
                  </select>
                  <div className="w-20">
                    <FormattedNumberInput
                      value={option.quantity}
                      onChange={(value) => updateOption(index, { quantity: value })}
                      min={1}
                      disabled={isCalculating}
                      className={inputClass}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => update('options', draft.options.filter((_, i) => i !== index))}
                    disabled={isCalculating}
                    className="p-1.5 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50"
                    aria-label="옵션 삭제"
                  >
                    <Trash2 size={14} />
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <ScopeExtrasFields value={draft.extras} onChange={(next) => update('extras', next)} disabled={isCalculating} />
          <Field label="영업 할인(공급가)">
            <FormattedNumberInput
              value={draft.discountAmount}
              onChange={(value) => update('discountAmount', value)}
              min={0}
              disabled={isCalculating}
              placeholder="0"
              className={inputClass}
            />
          </Field>
          <Field label="발주 조정액(선택, 음수 가능)">
            <FormattedNumberInput
              value={draft.adjustmentAmount}
              onChange={(value) => update('adjustmentAmount', value)}
              disabled={isCalculating}
              placeholder="0"
              className={inputClass}
            />
          </Field>
          <Button type="submit" disabled={isCalculating} className="w-full justify-center">
            {isCalculating ? '계산 중...' : '계산'}
          </Button>
        </form>

        {result ? (
          <div className="space-y-4 min-w-0">
            <section className="bg-white border border-gray-200 rounded-lg p-4">
              <h2 className="text-sm font-bold text-gray-950 mb-2">고객 견적</h2>
              <table className="w-full text-sm">
                <tbody className="divide-y divide-gray-100">
                  {result.lines.map((line, index) => (
                    <tr key={index}>
                      <td className="py-1.5 text-gray-950">{line.name}</td>
                      <td className="py-1.5 text-right text-gray-500 tabular-nums">{line.quantity}</td>
                      <td className="py-1.5 text-right tabular-nums">{formatMoney(line.amount, currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <dl className="mt-3 border-t border-gray-200 pt-2 text-sm space-y-1">
                <div className="flex justify-between"><dt className="text-gray-500">공급가</dt><dd className="tabular-nums">{formatMoney(result.supplyAmount, currency)}</dd></div>
                <div className="flex justify-between"><dt className="text-gray-500">부가세</dt><dd className="tabular-nums">{formatMoney(result.vatAmount, currency)}</dd></div>
                <div className="flex justify-between font-bold"><dt>합계</dt><dd className="tabular-nums">{formatMoney(result.totalAmount, currency)}</dd></div>
              </dl>
              <p className="mt-2 text-xs text-gray-400">
                태블릿 {result.tabletCount}대 · 현장 인력 {result.onsiteStaffPersonDays}인·일 · 최소 마진율 {result.minimumMarginRatePercent}%
              </p>
            </section>

            <section className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium">발주 대상</th>
                    <th className="text-right px-4 py-3 font-medium">발주 금액</th>
                    <th className="text-right px-4 py-3 font-medium">마진(마진율)</th>
                    <th className="text-left px-4 py-3 font-medium">수락률</th>
                    <th className="text-left px-4 py-3 font-medium">수행 평점</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  <tr className="bg-gray-50/50">
                    <td className="px-4 py-3 text-gray-950 font-medium">
                      기본 단가표
                      <p className="text-xs text-gray-400">견적 저장 때 검사하는 예상 발주 금액</p>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatMoney(result.defaultQuote.partnerAmount, currency)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      <MarginCell quote={result.defaultQuote} currency={result.currencyCode} />
                    </td>
                    <td className="px-4 py-3 text-gray-400">-</td>
                    <td className="px-4 py-3 text-gray-400">-</td>
                  </tr>
                  {result.partnerQuotes.map((quote) => (
                    <tr key={quote.organizationId}>
                      <td className="px-4 py-3 text-gray-950 font-medium">
                        {quote.organizationName}
                        <p className="text-xs text-gray-400">{quote.partnerRateCardApplied ? '전용 단가표' : '기본 단가표'}</p>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">{formatMoney(quote.partnerAmount, currency)}</td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        <MarginCell quote={quote} currency={result.currencyCode} />
                      </td>
                      <td className="px-4 py-3">{quote.evaluation && <AcceptanceRate evaluation={quote.evaluation} />}</td>
                      <td className="px-4 py-3">{quote.evaluation && <AverageRating evaluation={quote.evaluation} />}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {result.partnerQuotes.length === 0 && (
                <p className="px-4 py-6 text-center text-sm text-gray-400">발주 요건을 갖춘 파트너가 없습니다.</p>
              )}
            </section>
          </div>
        ) : (
          <div className="bg-white border border-dashed border-gray-200 rounded-lg p-8 text-center text-sm text-gray-400">
            왼쪽에서 조건을 넣고 계산하세요.
          </div>
        )}
      </div>
    </div>
  );
};
