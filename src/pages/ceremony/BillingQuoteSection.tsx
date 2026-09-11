import { useEffect, useState } from 'react';
import type { FC, FormEvent } from 'react';
import { ChevronDown, FileCheck, Loader2, X } from 'lucide-react';
import { useSnackbarStore } from '../../store/useSnackbarStore';
import { api } from '../../utils/api';
import { formatCurrency, formatDateTime } from '../../utils/internationalization';
import type { BillingQuoteDetail, BillingQuoteSummary } from '../../types';

const STATUS_BADGE_CLASS: Record<string, string> = {
  FINALIZED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  VOID: 'bg-gray-50 text-gray-500 border-gray-200 line-through',
};

const STATUS_LABEL: Record<string, string> = {
  FINALIZED: '확정',
  VOID: '무효화됨',
};

const LINE_TYPE_LABEL: Record<string, string> = {
  PLAN_UNIT_PRODUCT: '플랜 포함',
  UNIT_PRODUCT_PURCHASE: '추가구매',
};

/**
 * 행사 수정 화면(`UserCeremonyEdit`) 안에 얹는 "확정 이용료" 섹션(옛 이름 "확정 견적" —
 * "견적"(미확정 추정치)과 "확정"이 한 용어 안에서 충돌한다는 2026-09-11 사용자 지적으로
 * "예상 이용료"와 짝을 맞춰 바꿨다, 코드 식별자·API는 그대로 `BillingQuote`) —
 * signstage-docs business/currency-tax-internationalization-review.md 9/10장 결정
 * (2026-09-10). "예상 이용료" 섹션 바로 아래 둔다 — 그 계산을 스냅샷으로 고정하는 게 이
 * 섹션의 역할이라 자연스럽게 이어진다. 확정할 때마다 새 버전이 쌓이고(재확정), 무효화해도
 * 행 자체는 지워지지 않고 상태만 VOID로 바뀐다(append-only).
 */
export const BillingQuoteSection: FC<{ organizationId: string; ceremonyId: string }> = ({
  organizationId,
  ceremonyId,
}) => {
  const basePath = `/organizations/${organizationId}/ceremonies/${ceremonyId}`;

  const [quotes, setQuotes] = useState<BillingQuoteSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFinalizing, setIsFinalizing] = useState(false);

  const [openId, setOpenId] = useState<number | null>(null);
  const [detailById, setDetailById] = useState<Record<number, BillingQuoteDetail>>({});
  const [isDetailLoading, setIsDetailLoading] = useState(false);

  const [voidingId, setVoidingId] = useState<number | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [isVoiding, setIsVoiding] = useState(false);

  const showSnackbar = useSnackbarStore((state) => state.showSnackbar);

  const fetchQuotes = async () => {
    const response = await api.get(`${basePath}/quotes`);
    return response.data as BillingQuoteSummary[];
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchQuotes();
        if (!cancelled) setQuotes(data);
      } catch (err) {
        if (!cancelled) showSnackbar(err instanceof Error ? err.message : '확정 이용료 목록을 불러오지 못했습니다.', 'error');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId, ceremonyId]);

  const handleFinalize = async () => {
    setIsFinalizing(true);
    try {
      await api.post(`${basePath}/quotes`);
      showSnackbar('이용료를 확정했습니다.', 'success');
      setQuotes(await fetchQuotes());
    } catch (err) {
      showSnackbar(err instanceof Error ? err.message : '이용료 확정에 실패했습니다.', 'error');
    } finally {
      setIsFinalizing(false);
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
      const response = await api.get(`${basePath}/quotes/${quoteId}`);
      setDetailById((prev) => ({ ...prev, [quoteId]: response.data as BillingQuoteDetail }));
    } catch (err) {
      showSnackbar(err instanceof Error ? err.message : '이용료 상세를 불러오지 못했습니다.', 'error');
    } finally {
      setIsDetailLoading(false);
    }
  };

  const handleVoid = async (e: FormEvent) => {
    e.preventDefault();
    if (!voidingId || !voidReason.trim()) return;
    setIsVoiding(true);
    try {
      await api.post(`${basePath}/quotes/${voidingId}/void`, { reason: voidReason.trim() });
      showSnackbar('이용료를 무효화했습니다.', 'success');
      setVoidingId(null);
      setVoidReason('');
      setQuotes(await fetchQuotes());
    } catch (err) {
      showSnackbar(err instanceof Error ? err.message : '무효화에 실패했습니다.', 'error');
    } finally {
      setIsVoiding(false);
    }
  };

  return (
    <section className="mt-4 bg-white border border-gray-200 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold text-gray-950 flex items-center gap-1.5">
          <FileCheck size={14} />
          확정 이용료
        </h2>
        <button
          onClick={handleFinalize}
          disabled={isFinalizing}
          className="flex items-center gap-1 px-2.5 py-1 rounded-md border border-gray-200 text-gray-500 text-xs font-medium hover:border-gray-400 hover:text-gray-950 disabled:opacity-50"
        >
          {isFinalizing ? <Loader2 size={12} className="animate-spin" /> : null}
          지금 이용료 확정
        </button>
      </div>
      <p className="text-xs text-gray-400 mb-3">
        지금 이 순간의 예상 이용료를 스냅샷으로 고정합니다. 이후 카탈로그·할인이 바뀌어도 확정된 이용료는 그대로 유지됩니다.
      </p>

      {isLoading ? (
        <div className="flex items-center justify-center py-6 text-gray-400">
          <Loader2 size={18} className="animate-spin" />
        </div>
      ) : quotes.length === 0 ? (
        <p className="text-sm text-gray-500">아직 확정한 이용료가 없습니다.</p>
      ) : (
        <div className="divide-y divide-gray-100">
          {quotes.map((quote) => {
            const isOpen = openId === quote.id;
            const detail = detailById[quote.id];
            return (
              <div key={quote.id} className="py-2">
                <button
                  onClick={() => toggleDetail(quote.id)}
                  className="flex w-full items-center justify-between text-left"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-950">v{quote.version}</span>
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_BADGE_CLASS[quote.status]}`}
                    >
                      {STATUS_LABEL[quote.status]}
                    </span>
                    <span className="text-xs text-gray-400">
                      {quote.createdByLoginId} · {formatDateTime(quote.createdAt)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-gray-950">
                      {formatCurrency(quote.grossAmount, quote.currencyCode)}
                    </span>
                    <ChevronDown size={14} className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                  </div>
                </button>

                {quote.status === 'VOID' && quote.voidReason && (
                  <p className="mt-1 text-xs text-gray-400">무효화 사유: {quote.voidReason}</p>
                )}

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
                            <th className="text-left font-medium pb-1">품목</th>
                            <th className="text-right font-medium pb-1">수량</th>
                            <th className="text-right font-medium pb-1">단가</th>
                            <th className="text-right font-medium pb-1">세액</th>
                            <th className="text-right font-medium pb-1">합계</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {detail.lines.map((line, index) => (
                            <tr key={index}>
                              <td className="py-1 text-gray-700">
                                {line.itemName}
                                <span className="ml-1 text-gray-400">({LINE_TYPE_LABEL[line.lineType] ?? line.lineType})</span>
                              </td>
                              <td className="py-1 text-right text-gray-700">{line.quantity}</td>
                              <td className="py-1 text-right text-gray-700">
                                {formatCurrency(line.unitListAmount, quote.currencyCode)}
                              </td>
                              <td className="py-1 text-right text-gray-700">{formatCurrency(line.taxAmount, quote.currencyCode)}</td>
                              <td className="py-1 text-right font-medium text-gray-950">
                                {formatCurrency(line.grossAmount, quote.currencyCode)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : null}

                    {quote.status === 'FINALIZED' && (
                      <div className="mt-3 border-t border-gray-200 pt-2">
                        {voidingId === quote.id ? (
                          <form onSubmit={handleVoid} className="flex items-center gap-2">
                            <input
                              type="text"
                              value={voidReason}
                              onChange={(e) => setVoidReason(e.target.value)}
                              disabled={isVoiding}
                              placeholder="무효화 사유"
                              className="flex-1 px-2 py-1 border border-gray-200 rounded-md text-xs focus:ring-2 focus:ring-gray-950/10 focus:border-gray-400 outline-none transition-all"
                            />
                            <button
                              type="submit"
                              disabled={isVoiding || !voidReason.trim()}
                              className="px-2 py-1 rounded-md bg-red-600 text-white text-xs font-medium hover:bg-red-700 disabled:opacity-40"
                            >
                              무효화 확정
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setVoidingId(null);
                                setVoidReason('');
                              }}
                              className="text-gray-400 hover:text-gray-950"
                            >
                              <X size={14} />
                            </button>
                          </form>
                        ) : (
                          <button
                            onClick={() => setVoidingId(quote.id)}
                            className="text-xs font-medium text-red-600 hover:text-red-700"
                          >
                            이 이용료 무효화
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};
