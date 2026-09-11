import { useEffect, useState } from 'react';
import type { FC, FormEvent } from 'react';
import { ChevronDown, FileCheck, Loader2, Pencil, Trash2, X } from 'lucide-react';
import { FormattedNumberInput } from '../../components/FormattedNumberInput';
import { usePermissionStore } from '../../store/usePermissionStore';
import { useSnackbarStore } from '../../store/useSnackbarStore';
import { api } from '../../utils/api';
import { formatCurrency, formatDateTime } from '../../utils/internationalization';
import type {
  CustomerQuoteDetail,
  CustomerQuoteSummary,
  EffectiveMargin,
  MarginType,
  UnitProductSummary,
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

/** 장비/인력 고객 견적 줄 — 로컬 편집 상태. 카탈로그에서 고른 시점의 품목명을 그대로 쓴다. */
interface EquipmentPersonnelDraftLine {
  unitProductId: number;
  itemName: string;
  quantity: string;
  customerUnitAmount: string;
}

/**
 * 행사 수정 화면(`UserCeremonyEdit`)의 "고객 견적" 탭 — signstage-docs
 * business/partner-customer-quote-design-review.md,
 * business/platform-partner-customer-billing-model-reference.md 4장 결정(2026-09-11). 마진
 * (행사별 override, 없으면 조직 기본값을 따른다)과 장비/인력 고객 견적 줄을 입력받아 실고객에게
 * 제시할 견적 금액(견적서)을 생성한다. **이름 변천**: "고객 견적"(원래 이름) → "고객 정산"
 * (2026-09-11 사용자 요청, "플랫폼 이용료" 탭과 대비되게 "우리가 고객에게 받을 돈"을 드러내려는
 * 의도) → 같은 날 다시 "고객 견적"으로 되돌림(사용자 요청).
 *
 * <p>장비/인력 입력 방식은 2026-09-11 후속 결정(signstage-docs
 * business/unit-product-purchase-self-checkout-review.md 8.5절)으로 다시 설계됐다 — 예전엔
 * "승인된 추가구매 라인에서 품목·수량을 가져와 단가만 입력받는" 파생 목록이었지만, 장비·인력이
 * "플랫폼 이용료" 흐름에서 완전히 분리되면서 그 원천 자체가 없어졌다. 이제 전역 단위 상품
 * 카탈로그(`GET /api/unit-products`, 조직·플랜 큐레이션 없음)에서 파트너가 직접 품목을 골라
 * 수량·고객 단가까지 자유롭게 입력한다 — "참고 원가"도 더는 보여주지 않는다(파트너가 플랫폼에
 * 내는 원가 자체가 없어졌다). OWNER 전용(`ACTION_CUSTOMER_QUOTE_MANAGE`)이라 그 권한이 없으면
 * 탭 내용 자체를 숨긴다.
 *
 * <p>견적서 생성은 플랜이 확정된(DRAFT를 벗어난) 행사에서만 할 수 있다(2026-09-11 사용자
 * 요청 — 단위 상품 추가구매와 같은 기준). `isDraft`는 부모(`UserCeremonyEdit`)가 이미 계산해둔
 * 값을 그대로 받는다 — 마진 설정·기존 견적서 열람은 플랜 상태와 무관하게 계속 가능하다.
 */
export const CustomerQuoteSection: FC<{ organizationId: string; ceremonyId: string; isDraft: boolean }> = ({
  organizationId,
  ceremonyId,
  isDraft,
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

  const [catalog, setCatalog] = useState<UnitProductSummary[]>([]);
  const [isCatalogLoading, setIsCatalogLoading] = useState(true);
  const [equipmentPersonnelLines, setEquipmentPersonnelLines] = useState<EquipmentPersonnelDraftLine[]>([]);
  const [pickerValue, setPickerValue] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const [quotes, setQuotes] = useState<CustomerQuoteSummary[]>([]);
  const [isQuotesLoading, setIsQuotesLoading] = useState(true);
  const [openId, setOpenId] = useState<number | null>(null);
  const [detailById, setDetailById] = useState<Record<number, CustomerQuoteDetail>>({});
  const [isDetailLoading, setIsDetailLoading] = useState(false);

  const showSnackbar = useSnackbarStore((state) => state.showSnackbar);

  const fetchMargin = async () => (await api.get(`${basePath}/customer-margin`)).data as EffectiveMargin;
  const fetchCatalog = async () => (await api.get('/unit-products')).data as UnitProductSummary[];
  const fetchQuotes = async () => (await api.get(`${basePath}/customer-quotes`)).data as CustomerQuoteSummary[];

  useEffect(() => {
    if (!canManage) {
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const [marginData, catalogData, quotesData] = await Promise.all([fetchMargin(), fetchCatalog(), fetchQuotes()]);
        if (cancelled) return;
        setMargin(marginData);
        // 장비/인력(EQUIPMENT/PERSONNEL)만 품목 선택 드롭다운에 노출한다 — 전체 카탈로그, 큐레이션
        // 없음(8.5절 권장) — 이 항목들은 플랫폼이 팔거나 커밋하는 게 아니라 파트너가 실고객에게
        // 파는 것이므로 "이 조직/플랜에서 살 수 있는가"라는 전제가 애초에 적용되지 않는다.
        // 다만 사용중지(active=false/null) 상품은 여전히 제외한다 — `UnitProductSummary.active`
        // 주석이 명시한 계약("새 선택/구매 대상에서 제외")을 이 화면만 빠뜨려 사용중지 상품도
        // 그대로 담기던 문제를 고쳤다(2026-09-11, 추가구매 팝업의 `p.active` 필터와 같은 패턴).
        setCatalog(
          catalogData.filter(
            (product) => (product.category === 'EQUIPMENT' || product.category === 'PERSONNEL') && product.active,
          ),
        );
        setQuotes(quotesData);
      } catch (err) {
        if (!cancelled) showSnackbar(err instanceof Error ? err.message : '고객 견적 정보를 불러오지 못했습니다.', 'error');
      } finally {
        if (!cancelled) {
          setIsMarginLoading(false);
          setIsCatalogLoading(false);
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

  /** "+ 품목 추가" — 같은 품목을 두 번 고르면 새 줄이 아니라 기존 줄의 수량에 1을 더한다(4장 수량-합산 권장과 같은 방식). */
  const handleAddLine = (unitProductId: number) => {
    const product = catalog.find((p) => p.id === unitProductId);
    if (!product) return;
    setEquipmentPersonnelLines((prev) => {
      const existing = prev.find((line) => line.unitProductId === unitProductId);
      if (existing) {
        return prev.map((line) =>
          line.unitProductId === unitProductId ? { ...line, quantity: String(Number(line.quantity || '0') + 1) } : line,
        );
      }
      return [...prev, { unitProductId, itemName: product.name, quantity: '1', customerUnitAmount: '' }];
    });
    setPickerValue('');
  };

  const handleRemoveLine = (unitProductId: number) => {
    setEquipmentPersonnelLines((prev) => prev.filter((line) => line.unitProductId !== unitProductId));
  };

  const updateLine = (unitProductId: number, patch: Partial<EquipmentPersonnelDraftLine>) => {
    setEquipmentPersonnelLines((prev) =>
      prev.map((line) => (line.unitProductId === unitProductId ? { ...line, ...patch } : line)),
    );
  };

  const linesValid = equipmentPersonnelLines.every((line) => {
    const quantity = Number(line.quantity);
    const price = Number(line.customerUnitAmount);
    return line.quantity.trim() !== '' && Number.isInteger(quantity) && quantity >= 1 &&
      line.customerUnitAmount.trim() !== '' && !Number.isNaN(price) && price >= 0;
  });

  const handleGenerate = async () => {
    if (isDraft || !margin || margin.source === 'NONE' || !linesValid) return;
    setIsGenerating(true);
    try {
      const equipmentPersonnelLinesPayload = equipmentPersonnelLines.map((line) => ({
        unitProductId: line.unitProductId,
        quantity: Number(line.quantity),
        customerUnitAmount: Number(line.customerUnitAmount),
      }));
      await api.post(`${basePath}/customer-quotes`, { equipmentPersonnelLines: equipmentPersonnelLinesPayload });
      showSnackbar('고객 견적서를 생성했습니다.', 'success');
      setEquipmentPersonnelLines([]);
      setQuotes(await fetchQuotes());
    } catch (err) {
      showSnackbar(err instanceof Error ? err.message : '고객 견적서 생성에 실패했습니다.', 'error');
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
      showSnackbar(err instanceof Error ? err.message : '견적 상세를 불러오지 못했습니다.', 'error');
    } finally {
      setIsDetailLoading(false);
    }
  };

  // 이미 담은 줄과 같은 배타 그룹(exclusivityGroup)의 상품은 드롭다운에서 미리 뺀다 — 담고
  // 나서 서버가 거부하게 두는 대신(3.3절과 같은 "애초에 못 고르게" 접근), 예를 들어 현장지원
  // 근/중/원거리처럼 동시에 쓸 수 없는 상품 두 개가 한 견적에 나란히 담기던 문제를
  // 고쳤다(2026-09-11).
  const selectedExclusivityGroups = new Set(
    equipmentPersonnelLines
      .map((line) => catalog.find((product) => product.id === line.unitProductId)?.exclusivityGroup)
      .filter((group): group is string => group != null),
  );
  const pickableCatalog = catalog.filter(
    (product) =>
      !equipmentPersonnelLines.some((line) => line.unitProductId === product.id) &&
      (product.exclusivityGroup == null || !selectedExclusivityGroups.has(product.exclusivityGroup)),
  );

  return (
    <section className="mt-4 bg-white border border-gray-200 rounded-lg p-4">
      <h2 className="text-sm font-bold text-gray-950 flex items-center gap-1.5 mb-3">
        <FileCheck size={14} />
        고객 견적
      </h2>
      <p className="text-xs text-gray-400 mb-4">
        실고객에게 제시할 견적 금액입니다 — 시스템 사용료는 원가에 마진을 더해, 장비/인력(태블릿·현장지원 등)은 직접 고른
        품목·수량·단가로 계산합니다. 플랫폼에 내는 금액("플랫폼 이용료" 탭)과는 별개입니다.
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

      {/* 장비/인력 품목 + 견적서 생성 — 플랜이 확정된 행사에서만 할 수 있다(2026-09-11
          사용자 요청 — 단위 상품 추가구매와 같은 기준). 마진 설정·기존 견적서 열람은 이
          가드와 무관하게 계속 가능하다. */}
      <div className="border-t border-gray-100 mt-4 pt-3">
        <h3 className="text-xs font-bold text-gray-700 mb-2">장비/인력</h3>
        {isDraft ? (
          <p className="text-sm text-gray-500">플랜을 확정한 후 고객 견적서를 생성할 수 있습니다.</p>
        ) : isCatalogLoading ? (
          <div className="flex items-center justify-center py-4 text-gray-400">
            <Loader2 size={16} className="animate-spin" />
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 mb-2">
              <select
                value={pickerValue}
                onChange={(e) => {
                  if (e.target.value) handleAddLine(Number(e.target.value));
                }}
                className="flex-1 px-3 py-1.5 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-gray-950/10 focus:border-gray-400 outline-none bg-white"
              >
                <option value="">+ 품목 추가</option>
                {pickableCatalog.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                  </option>
                ))}
              </select>
            </div>

            {equipmentPersonnelLines.length === 0 ? (
              <p className="text-xs text-gray-400">담긴 품목이 없습니다 — 위 드롭다운에서 태블릿·현장지원 등을 골라 담으세요.</p>
            ) : (
              <div className="space-y-2">
                {equipmentPersonnelLines.map((line) => (
                  <div key={line.unitProductId} className="flex items-center gap-2 text-sm">
                    <span className="flex-1 text-gray-950 truncate">{line.itemName}</span>
                    <FormattedNumberInput
                      min={1}
                      step="1"
                      value={line.quantity}
                      onChange={(raw) => updateLine(line.unitProductId, { quantity: raw })}
                      placeholder="수량"
                      className="w-16 px-2 py-1 border border-gray-200 rounded-md text-sm text-right focus:ring-2 focus:ring-gray-950/10 focus:border-gray-400 outline-none"
                    />
                    <FormattedNumberInput
                      min={0}
                      step="1"
                      value={line.customerUnitAmount}
                      onChange={(raw) => updateLine(line.unitProductId, { customerUnitAmount: raw })}
                      placeholder="고객 단가"
                      className="w-32 px-2 py-1 border border-gray-200 rounded-md text-sm text-right focus:ring-2 focus:ring-gray-950/10 focus:border-gray-400 outline-none"
                    />
                    <button
                      onClick={() => handleRemoveLine(line.unitProductId)}
                      className="text-gray-400 hover:text-red-600 shrink-0"
                      aria-label="빼기"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {!isDraft && (
          <div className="mt-3 flex justify-end">
            <button
              onClick={handleGenerate}
              disabled={isGenerating || isMarginLoading || !margin || margin.source === 'NONE' || !linesValid}
              className="px-3 py-1.5 rounded-md bg-gray-950 text-white text-xs font-medium hover:bg-gray-800 disabled:opacity-40 transition-colors"
            >
              {isGenerating ? '생성 중...' : '고객 견적서 생성'}
            </button>
          </div>
        )}
      </div>

      {/* 생성된 견적서 목록 */}
      <div className="border-t border-gray-100 mt-4 pt-3">
        <h3 className="text-xs font-bold text-gray-700 mb-2">견적 내역</h3>
        {isQuotesLoading ? (
          <div className="flex items-center justify-center py-4 text-gray-400">
            <Loader2 size={16} className="animate-spin" />
          </div>
        ) : quotes.length === 0 ? (
          <p className="text-sm text-gray-500">아직 생성한 고객 견적서가 없습니다.</p>
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
