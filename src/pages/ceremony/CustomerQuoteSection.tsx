import { useEffect, useState } from 'react';
import type { FC, FormEvent } from 'react';
import { ChevronDown, FileCheck, Loader2, Pencil, X } from 'lucide-react';
import { FormattedNumberInput } from '../../components/FormattedNumberInput';
import { usePermissionStore } from '../../store/usePermissionStore';
import { useSnackbarStore } from '../../store/useSnackbarStore';
import { api } from '../../utils/api';
import { formatCurrency, formatDateTime } from '../../utils/internationalization';
import type {
  CustomerQuoteDetail,
  CustomerQuotePricingInput,
  CustomerQuoteSummary,
  EffectiveMargin,
  MarginType,
} from '../../types';

const SOURCE_LABEL: Record<EffectiveMargin['source'], string> = {
  CEREMONY_OVERRIDE: '이 행사만의 마진',
  ORGANIZATION_DEFAULT: '조직 기본 마진 적용 중',
  NONE: '마진 미설정',
};

const MARGIN_TYPE_LABEL: Record<MarginType, string> = {
  PERCENT: '정률(%)',
  FIXED_AMOUNT: '정액',
};

/**
 * 행사 수정 화면(`UserCeremonyEdit`)의 "고객 정산" 탭(옛 이름 "고객 견적", 2026-09-11 사용자
 * 요청으로 파트너 입장 용어로 변경 — "플랫폼 이용료" 탭과 대비되게 "우리가 고객에게 받을 돈"을
 * 드러낸다) — signstage-docs business/partner-customer-quote-design-review.md,
 * business/platform-partner-customer-billing-model-reference.md 4장 결정(2026-09-11). 마진
 * (행사별 override, 없으면 조직 기본값을 따른다)과 장비/인력 고객 단가를 입력받아 실고객과
 * 정산할 금액(정산서)을 생성한다 — `BillingQuoteSection`("플랫폼 이용료" 탭, 파트너→플랫폼
 * 확정 견적)과 나란히 있지만 완전히 별개 산출물이다. OWNER 전용(`ACTION_CUSTOMER_QUOTE_MANAGE`)
 * 이라 그 권한이 없으면 탭 내용 자체를 숨긴다.
 */
export const CustomerQuoteSection: FC<{ organizationId: string; ceremonyId: string }> = ({
  organizationId,
  ceremonyId,
}) => {
  const basePath = `/organizations/${organizationId}/ceremonies/${ceremonyId}`;
  const hasPermission = usePermissionStore((state) => state.hasPermission);
  const canManage = hasPermission('ACTION_CUSTOMER_QUOTE_MANAGE');

  const [margin, setMargin] = useState<EffectiveMargin | null>(null);
  const [isMarginLoading, setIsMarginLoading] = useState(true);
  const [isEditingOverride, setIsEditingOverride] = useState(false);
  const [overrideType, setOverrideType] = useState<MarginType>('PERCENT');
  const [overrideValue, setOverrideValue] = useState('');
  const [isSavingOverride, setIsSavingOverride] = useState(false);
  const [isClearingOverride, setIsClearingOverride] = useState(false);

  const [pricingInputs, setPricingInputs] = useState<CustomerQuotePricingInput[]>([]);
  const [isPricingLoading, setIsPricingLoading] = useState(true);
  const [customerPrices, setCustomerPrices] = useState<Record<number, string>>({});
  const [isGenerating, setIsGenerating] = useState(false);

  const [quotes, setQuotes] = useState<CustomerQuoteSummary[]>([]);
  const [isQuotesLoading, setIsQuotesLoading] = useState(true);
  const [openId, setOpenId] = useState<number | null>(null);
  const [detailById, setDetailById] = useState<Record<number, CustomerQuoteDetail>>({});
  const [isDetailLoading, setIsDetailLoading] = useState(false);

  const showSnackbar = useSnackbarStore((state) => state.showSnackbar);

  const fetchMargin = async () => (await api.get(`${basePath}/customer-margin`)).data as EffectiveMargin;
  const fetchPricingInputs = async () =>
    (await api.get(`${basePath}/customer-quotes/pricing-inputs`)).data as CustomerQuotePricingInput[];
  const fetchQuotes = async () => (await api.get(`${basePath}/customer-quotes`)).data as CustomerQuoteSummary[];

  useEffect(() => {
    if (!canManage) {
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const [marginData, pricingData, quotesData] = await Promise.all([fetchMargin(), fetchPricingInputs(), fetchQuotes()]);
        if (cancelled) return;
        setMargin(marginData);
        setPricingInputs(pricingData);
        setQuotes(quotesData);
      } catch (err) {
        if (!cancelled) showSnackbar(err instanceof Error ? err.message : '고객 정산 정보를 불러오지 못했습니다.', 'error');
      } finally {
        if (!cancelled) {
          setIsMarginLoading(false);
          setIsPricingLoading(false);
          setIsQuotesLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId, ceremonyId, canManage]);

  if (!canManage) return null;

  const openOverrideForm = () => {
    setOverrideType(margin?.marginType ?? 'PERCENT');
    setOverrideValue(margin?.source === 'CEREMONY_OVERRIDE' && margin.marginValue != null ? String(margin.marginValue) : '');
    setIsEditingOverride(true);
  };

  const handleSaveOverride = async (e: FormEvent) => {
    e.preventDefault();
    const value = Number(overrideValue);
    if (!overrideValue.trim() || Number.isNaN(value) || value < 0) return;
    setIsSavingOverride(true);
    try {
      const response = await api.put(`${basePath}/customer-margin`, { marginType: overrideType, marginValue: value });
      setMargin(response.data as EffectiveMargin);
      setIsEditingOverride(false);
      showSnackbar('이 행사의 마진을 저장했습니다.', 'success');
    } catch (err) {
      showSnackbar(err instanceof Error ? err.message : '마진 저장에 실패했습니다.', 'error');
    } finally {
      setIsSavingOverride(false);
    }
  };

  const handleClearOverride = async () => {
    setIsClearingOverride(true);
    try {
      await api.delete(`${basePath}/customer-margin`);
      setMargin(await fetchMargin());
      showSnackbar('행사별 마진을 해제했습니다. 이제 조직 기본값을 따릅니다.', 'success');
    } catch (err) {
      showSnackbar(err instanceof Error ? err.message : '마진 해제에 실패했습니다.', 'error');
    } finally {
      setIsClearingOverride(false);
    }
  };

  const allPricesFilled =
    pricingInputs.length === 0 ||
    pricingInputs.every((input) => {
      const raw = customerPrices[input.unitProductId];
      return raw !== undefined && raw.trim() !== '' && !Number.isNaN(Number(raw)) && Number(raw) >= 0;
    });

  const handleGenerate = async () => {
    if (!margin || margin.source === 'NONE' || !allPricesFilled) return;
    setIsGenerating(true);
    try {
      const equipmentPersonnelPrices = pricingInputs.map((input) => ({
        unitProductId: input.unitProductId,
        customerUnitAmount: Number(customerPrices[input.unitProductId]),
      }));
      await api.post(`${basePath}/customer-quotes`, { equipmentPersonnelPrices });
      showSnackbar('고객 정산서를 생성했습니다.', 'success');
      setQuotes(await fetchQuotes());
    } catch (err) {
      showSnackbar(err instanceof Error ? err.message : '고객 정산서 생성에 실패했습니다.', 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const toggleDetail = async (quoteId: number) => {
    if (openId === quoteId) {
      setOpenId(null);
      return;
    }
    setOpenId(quoteId);
    if (detailById[quoteId]) return;
    setIsDetailLoading(true);
    try {
      const response = await api.get(`${basePath}/customer-quotes/${quoteId}`);
      setDetailById((prev) => ({ ...prev, [quoteId]: response.data as CustomerQuoteDetail }));
    } catch (err) {
      showSnackbar(err instanceof Error ? err.message : '정산 상세를 불러오지 못했습니다.', 'error');
    } finally {
      setIsDetailLoading(false);
    }
  };

  return (
    <section className="mt-4 bg-white border border-gray-200 rounded-lg p-4">
      <h2 className="text-sm font-bold text-gray-950 flex items-center gap-1.5 mb-3">
        <FileCheck size={14} />
        고객 정산
      </h2>
      <p className="text-xs text-gray-400 mb-4">
        실고객과 정산할 금액입니다 — 시스템 사용료는 원가에 마진을 더해, 장비/인력(태블릿·현장지원 등)은 직접 입력한
        단가로 계산합니다. 플랫폼에 내는 금액("플랫폼 이용료" 탭)과는 별개입니다.
      </p>

      {/* 마진 */}
      <div className="border-t border-gray-100 pt-3">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-bold text-gray-700">마진</h3>
          {!isEditingOverride && (
            <div className="flex items-center gap-2">
              {margin?.source === 'CEREMONY_OVERRIDE' && (
                <button
                  onClick={handleClearOverride}
                  disabled={isClearingOverride}
                  className="text-xs font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
                >
                  {isClearingOverride ? '해제 중...' : '이 행사만의 마진 해제'}
                </button>
              )}
              <button
                onClick={openOverrideForm}
                className="flex items-center gap-1 px-2.5 py-1 rounded-md border border-gray-200 text-gray-500 text-xs font-medium hover:border-gray-400 hover:text-gray-950"
              >
                <Pencil size={12} />
                이 행사만 다르게 설정
              </button>
            </div>
          )}
        </div>

        {isMarginLoading ? (
          <div className="flex items-center justify-center py-4 text-gray-400">
            <Loader2 size={16} className="animate-spin" />
          </div>
        ) : isEditingOverride ? (
          <form onSubmit={handleSaveOverride} className="space-y-2 rounded-md bg-gray-50 p-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-gray-500">이 행사만의 마진</label>
              <button type="button" onClick={() => setIsEditingOverride(false)} className="text-gray-400 hover:text-gray-950">
                <X size={14} />
              </button>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={overrideType}
                onChange={(e) => setOverrideType(e.target.value as MarginType)}
                disabled={isSavingOverride}
                className="px-3 py-1.5 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-gray-950/10 focus:border-gray-400 outline-none transition-all"
              >
                <option value="PERCENT">정률(%)</option>
                <option value="FIXED_AMOUNT">정액</option>
              </select>
              <FormattedNumberInput
                min={0}
                step="0.01"
                value={overrideValue}
                onChange={setOverrideValue}
                disabled={isSavingOverride}
                className="flex-1 px-3 py-1.5 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-gray-950/10 focus:border-gray-400 outline-none transition-all"
              />
              <button
                type="submit"
                disabled={isSavingOverride || !overrideValue.trim() || Number(overrideValue) < 0}
                className="shrink-0 px-3 py-1.5 rounded-md bg-gray-950 text-white text-xs font-medium hover:bg-gray-800 disabled:opacity-40 transition-colors"
              >
                {isSavingOverride ? '저장 중...' : '저장'}
              </button>
            </div>
          </form>
        ) : margin && margin.source !== 'NONE' && margin.marginType ? (
          <p className="text-sm text-gray-950">
            {margin.marginType === 'PERCENT' ? `${margin.marginValue}%` : formatCurrency(margin.marginValue ?? 0, 'KRW')}
            <span className="ml-1.5 text-xs font-normal text-gray-400">
              ({MARGIN_TYPE_LABEL[margin.marginType]} · {SOURCE_LABEL[margin.source]})
            </span>
          </p>
        ) : (
          <p className="text-sm text-amber-700">
            마진이 설정되지 않았습니다. 조직 상세의 "재판매 마진"에서 기본값을 설정하거나, 이 행사만 따로 설정해주세요.
          </p>
        )}
      </div>

      {/* 장비/인력 고객 단가 */}
      <div className="border-t border-gray-100 mt-4 pt-3">
        <h3 className="text-xs font-bold text-gray-700 mb-2">장비/인력 고객 단가</h3>
        {isPricingLoading ? (
          <div className="flex items-center justify-center py-4 text-gray-400">
            <Loader2 size={16} className="animate-spin" />
          </div>
        ) : pricingInputs.length === 0 ? (
          <p className="text-xs text-gray-400">구매한 태블릿·현장지원 등 장비/인력 항목이 없습니다.</p>
        ) : (
          <div className="space-y-2">
            {pricingInputs.map((input) => (
              <div key={input.unitProductId} className="flex items-center gap-2 text-sm">
                <div className="flex-1">
                  <span className="text-gray-950">{input.itemName}</span>
                  <span className="ml-1 text-xs text-gray-400">
                    × {input.quantity} (참고 원가 {formatCurrency(input.referenceCostUnitAmount, 'KRW')}/개)
                  </span>
                </div>
                <FormattedNumberInput
                  min={0}
                  step="1"
                  value={customerPrices[input.unitProductId] ?? ''}
                  onChange={(raw) => setCustomerPrices((prev) => ({ ...prev, [input.unitProductId]: raw }))}
                  placeholder="고객 단가"
                  className="w-32 px-2 py-1 border border-gray-200 rounded-md text-sm text-right focus:ring-2 focus:ring-gray-950/10 focus:border-gray-400 outline-none transition-all"
                />
              </div>
            ))}
          </div>
        )}

        <div className="mt-3 flex justify-end">
          <button
            onClick={handleGenerate}
            disabled={isGenerating || isMarginLoading || !margin || margin.source === 'NONE' || !allPricesFilled}
            className="px-3 py-1.5 rounded-md bg-gray-950 text-white text-xs font-medium hover:bg-gray-800 disabled:opacity-40 transition-colors"
          >
            {isGenerating ? '생성 중...' : '고객 정산서 생성'}
          </button>
        </div>
      </div>

      {/* 생성된 정산서 목록 */}
      <div className="border-t border-gray-100 mt-4 pt-3">
        <h3 className="text-xs font-bold text-gray-700 mb-2">정산 내역</h3>
        {isQuotesLoading ? (
          <div className="flex items-center justify-center py-4 text-gray-400">
            <Loader2 size={16} className="animate-spin" />
          </div>
        ) : quotes.length === 0 ? (
          <p className="text-sm text-gray-500">아직 생성한 고객 정산서가 없습니다.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {quotes.map((quote) => {
              const isOpen = openId === quote.id;
              const detail = detailById[quote.id];
              return (
                <div key={quote.id} className="py-2">
                  <button onClick={() => toggleDetail(quote.id)} className="flex w-full items-center justify-between text-left">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-950">v{quote.version}</span>
                      <span className="text-xs text-gray-400">
                        {quote.createdByLoginId} · {formatDateTime(quote.createdAt)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-gray-950">
                        {formatCurrency(quote.totalCustomerAmount, quote.currencyCode)}
                      </span>
                      <ChevronDown size={14} className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                    </div>
                  </button>

                  {isOpen && (
                    <div className="mt-2 rounded-md bg-gray-50 p-3">
                      {isDetailLoading && !detail ? (
                        <div className="flex items-center justify-center py-4 text-gray-400">
                          <Loader2 size={16} className="animate-spin" />
                        </div>
                      ) : detail ? (
                        <table className="w-full text-xs">
                          <thead className="text-gray-400">
                            <tr>
                              <th className="text-left font-medium pb-1">항목</th>
                              <th className="text-right font-medium pb-1">수량</th>
                              <th className="text-right font-medium pb-1">단가</th>
                              <th className="text-right font-medium pb-1">합계</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {detail.lines.map((line, index) => (
                              <tr key={index}>
                                <td className="py-1 text-gray-700">{line.itemName}</td>
                                <td className="py-1 text-right text-gray-700">{line.quantity}</td>
                                <td className="py-1 text-right text-gray-700">
                                  {formatCurrency(line.customerUnitAmount, quote.currencyCode)}
                                </td>
                                <td className="py-1 text-right font-medium text-gray-950">
                                  {formatCurrency(line.customerAmount, quote.currencyCode)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : null}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
};
