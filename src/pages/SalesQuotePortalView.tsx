import { useEffect, useState } from 'react';
import type { FC, FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle2, FileText, Loader2 } from 'lucide-react';
import { Button } from '../components/Button';
import { useSnackbarStore } from '../store/useSnackbarStore';
import { api } from '../utils/api';
import { formatDateTime } from '../utils/internationalization';
import { inputClass } from './billingCatalog/constants';
import { formatMoney, formatSchedule } from './order/constants';
import type { SalesQuotePortal } from '../types';

/**
 * 고객 견적 열람·수락(로그인 없음) — signstage-docs business/platform-order-partner-subcontract-review.md
 * D02. 플랫폼 관리자가 보낸 링크의 토큰으로만 접근한다(서명자 포털과 같은 방식). 유효기간이 지난
 * 견적은 수락할 수 없고, 취소된 견적은 찾을 수 없다고 나온다.
 */
export const SalesQuotePortalView: FC = () => {
  const { accessToken } = useParams<{ accessToken: string }>();
  const showSnackbar = useSnackbarStore((state) => state.showSnackbar);
  const [quote, setQuote] = useState<SalesQuotePortal | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [acceptedByName, setAcceptedByName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const endpoint = `/portal/sales-quotes/${accessToken}`;

  useEffect(() => {
    let cancelled = false;
    api.get(endpoint)
      .then((response) => {
        if (!cancelled) setQuote(response.data as SalesQuotePortal);
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : '견적을 불러오지 못했습니다.');
      });
    return () => {
      cancelled = true;
    };
  }, [endpoint]);

  const handleAccept = async (e: FormEvent) => {
    e.preventDefault();
    if (!acceptedByName.trim()) {
      showSnackbar('수락하시는 분의 이름을 입력해주세요.', 'error');
      return;
    }
    setIsSubmitting(true);
    try {
      const response = await api.post(`${endpoint}/accept`, { acceptedByName: acceptedByName.trim() });
      setQuote(response.data as SalesQuotePortal);
      showSnackbar('견적을 수락했습니다. 담당자가 곧 연락드립니다.', 'success');
    } catch (err) {
      showSnackbar(err instanceof Error ? err.message : '수락에 실패했습니다.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loadError) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <p className="text-sm text-gray-500">{loadError}</p>
      </div>
    );
  }
  if (!quote) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-400">
        <Loader2 size={24} className="animate-spin" />
      </div>
    );
  }

  const currency = quote.currencyCode;
  const today = new Date().toISOString().slice(0, 10);
  const isExpired = quote.status === 'QUOTED' && quote.quoteValidUntil < today;

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="mx-auto max-w-2xl bg-white border border-gray-200 rounded-lg p-6">
        <p className="text-xs font-bold tracking-wide text-gray-400">SIGNSTAGE 견적서</p>
        <h1 className="mt-1 text-xl font-bold text-gray-950 flex items-center gap-2">
          <FileText size={20} className="text-gray-400" />
          {quote.title}
        </h1>
        <p className="mt-1 text-sm text-gray-500">{quote.customerName} 귀하</p>

        <dl className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <div><dt className="text-xs text-gray-500">일정</dt><dd className="text-gray-950">{formatSchedule(quote.startsAt, quote.endsAt)}</dd></div>
          <div><dt className="text-xs text-gray-500">장소</dt><dd className="text-gray-950">{quote.location ?? '미정'}</dd></div>
          <div><dt className="text-xs text-gray-500">패키지</dt><dd className="text-gray-950">{quote.billingPlanName}</dd></div>
          <div><dt className="text-xs text-gray-500">견적 유효기간</dt><dd className="text-gray-950">{quote.quoteValidUntil}까지</dd></div>
        </dl>

        {quote.serviceDescription && (
          <section className="mt-6">
            <h2 className="text-sm font-bold text-gray-950">제공 서비스</h2>
            <p className="mt-2 rounded-md bg-gray-50 px-4 py-3 text-sm text-gray-700 whitespace-pre-line">{quote.serviceDescription}</p>
          </section>
        )}

        <table className="mt-6 w-full text-sm">
          <thead className="text-xs text-gray-500 border-b border-gray-200">
            <tr>
              <th className="text-left font-medium pb-2">항목</th>
              <th className="text-right font-medium pb-2">수량</th>
              <th className="text-right font-medium pb-2">단가</th>
              <th className="text-right font-medium pb-2">금액</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {quote.lines.map((line, index) => (
              <tr key={index} className="align-top">
                <td className="py-2 text-gray-950">
                  {line.name}
                  {line.description && (
                    <p className="mt-0.5 text-xs text-gray-500 whitespace-pre-line">{line.description}</p>
                  )}
                </td>
                <td className="py-2 text-right tabular-nums text-gray-500">{line.quantity}</td>
                <td className="py-2 text-right tabular-nums text-gray-500">{formatMoney(line.unitPrice, currency)}</td>
                <td className="py-2 text-right tabular-nums">{formatMoney(line.amount, currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <dl className="mt-3 border-t border-gray-200 pt-3 text-sm space-y-1">
          <div className="flex justify-between"><dt className="text-gray-500">공급가</dt><dd className="tabular-nums">{formatMoney(quote.supplyAmount, currency)}</dd></div>
          <div className="flex justify-between"><dt className="text-gray-500">부가세</dt><dd className="tabular-nums">{formatMoney(quote.vatAmount, currency)}</dd></div>
          <div className="flex justify-between text-base font-bold"><dt>합계</dt><dd className="tabular-nums">{formatMoney(quote.totalAmount, currency)}</dd></div>
        </dl>

        <div className="mt-6 border-t border-gray-200 pt-4">
          {quote.status === 'ACCEPTED' ? (
            <p className="text-sm text-emerald-700 flex items-center gap-1.5">
              <CheckCircle2 size={16} />
              {quote.acceptedByName}님이 {quote.acceptedAt ? formatDateTime(quote.acceptedAt) : ''}에 수락한 견적입니다.
            </p>
          ) : isExpired ? (
            <p className="text-sm text-gray-500">견적 유효기간이 지났습니다. 담당자에게 새 견적을 요청해주세요.</p>
          ) : (
            <form onSubmit={handleAccept} className="flex flex-col sm:flex-row sm:items-end gap-2">
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-500 mb-1">수락하시는 분 성함</label>
                <input
                  value={acceptedByName}
                  onChange={(e) => setAcceptedByName(e.target.value)}
                  disabled={isSubmitting}
                  className={inputClass}
                />
              </div>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                견적 수락
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
