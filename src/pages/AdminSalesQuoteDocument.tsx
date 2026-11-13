import { useEffect, useState } from 'react';
import type { FC } from 'react';
import { useParams } from 'react-router-dom';
import { Download, Loader2 } from 'lucide-react';
import { Button } from '../components/Button';
import { api } from '../utils/api';
import { formatMoney, formatSchedule } from './order/constants';
import type { AdminSalesOrderDetail } from '../types';

const todayIsoDate = () => new Date().toLocaleDateString('sv-SE');

/** 저장되는 PDF 파일 이름이 문서 제목을 따르므로 파일 이름에 못 쓰는 문자를 뺀다. */
const toFileTitle = (order: AdminSalesOrderDetail) =>
  `견적서_${order.customerName}_${order.title}`.replace(/[\\/:*?"<>|]/g, ' ').trim();

/**
 * 고객 견적서 문서(플랫폼 관리자 전용) — 고객 견적 링크는 외부에 주지 않고, 담당자가 이 화면에서 내용을 확인한 뒤
 * PDF로 내려받아 전달한다(2026-11-13 사용자 결정). 관리자 레이아웃 밖의 단독 화면이라 인쇄하면 견적서만 나오고,
 * "PDF 다운로드"는 브라우저 인쇄의 "PDF로 저장"을 연다. 예상 발주 금액·내부 메모·발주 단가 같은 내부 정보는 싣지 않는다.
 */
export const AdminSalesQuoteDocument: FC = () => {
  const { salesOrderId } = useParams<{ salesOrderId: string }>();
  const [order, setOrder] = useState<AdminSalesOrderDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api.get(`/platform-admin/sales-orders/${salesOrderId}`)
      .then((response) => {
        if (!cancelled) setOrder(response.data as AdminSalesOrderDetail);
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : '견적을 불러오지 못했습니다.');
      });
    return () => {
      cancelled = true;
    };
  }, [salesOrderId]);

  useEffect(() => {
    if (!order) return;
    const previousTitle = document.title;
    document.title = toFileTitle(order);
    return () => {
      document.title = previousTitle;
    };
  }, [order]);

  if (loadError) {
    return <p className="py-16 text-center text-sm text-gray-500">{loadError}</p>;
  }
  if (!order) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-400">
        <Loader2 size={24} className="animate-spin" />
      </div>
    );
  }

  const currency = order.currencyCode;

  return (
    <div className="min-h-screen bg-gray-100 py-8 px-4 print:bg-white print:p-0">
      <style>{'@page { size: A4; margin: 14mm; }'}</style>
      <div className="mx-auto mb-4 flex max-w-[210mm] items-center justify-between gap-3 print:hidden">
        <p className="text-sm text-gray-500">
          {order.status === 'CANCELLED'
            ? '취소된 견적입니다 — 고객에게 보내지 마세요.'
            : '내용을 확인한 뒤 PDF로 내려받아 고객에게 전달하세요. 인쇄 창에서 대상을 "PDF로 저장"으로 고릅니다.'}
        </p>
        <Button size="sm" onClick={() => window.print()}>
          <Download size={14} /> PDF 다운로드
        </Button>
      </div>

      <article className="mx-auto max-w-[210mm] bg-white p-10 shadow-sm print:max-w-none print:p-0 print:shadow-none">
        <header className="flex items-end justify-between border-b-2 border-gray-950 pb-3">
          <h1 className="text-2xl font-bold tracking-widest text-gray-950">견 적 서</h1>
          <p className="text-sm font-bold tracking-wide text-gray-950">SIGNSTAGE</p>
        </header>

        <section className="mt-5 grid grid-cols-2 gap-6 text-sm">
          <div>
            <p className="text-base font-bold text-gray-950">{order.customerName} 귀하</p>
            <p className="mt-1 text-gray-500">아래와 같이 견적합니다.</p>
          </div>
          <dl className="space-y-1">
            <div className="flex gap-3"><dt className="w-20 shrink-0 text-gray-500">견적일</dt><dd className="text-gray-950">{todayIsoDate()}</dd></div>
            <div className="flex gap-3"><dt className="w-20 shrink-0 text-gray-500">유효기간</dt><dd className="text-gray-950">{order.quoteValidUntil}까지</dd></div>
          </dl>
        </section>

        <dl className="mt-5 grid grid-cols-[6rem_1fr] gap-y-1.5 border-y border-gray-200 py-3 text-sm">
          <dt className="text-gray-500">행사명</dt><dd className="text-gray-950">{order.title}</dd>
          <dt className="text-gray-500">일정</dt><dd className="text-gray-950">{formatSchedule(order.startsAt, order.endsAt)}</dd>
          <dt className="text-gray-500">장소</dt><dd className="text-gray-950">{order.location ?? '미정'}</dd>
          <dt className="text-gray-500">패키지</dt><dd className="text-gray-950">{order.billingPlanName}</dd>
        </dl>

        <div className="mt-5 flex items-baseline justify-between rounded-md bg-gray-50 px-4 py-3 print:border print:border-gray-300 print:bg-white">
          <span className="text-sm font-medium text-gray-700">합계 금액(부가세 포함)</span>
          <span className="text-xl font-bold tabular-nums text-gray-950">{formatMoney(order.totalAmount, currency)}</span>
        </div>

        {order.serviceDescription && (
          <section className="mt-6 break-inside-avoid">
            <h2 className="text-sm font-bold text-gray-950">제공 서비스</h2>
            <p className="mt-2 text-sm leading-relaxed text-gray-700 whitespace-pre-line">{order.serviceDescription}</p>
          </section>
        )}

        <table className="mt-6 w-full text-sm">
          <thead className="border-y border-gray-300 bg-gray-50 text-xs text-gray-600 print:bg-white">
            <tr>
              <th className="px-2 py-2 text-left font-medium">항목</th>
              <th className="w-16 px-2 py-2 text-right font-medium">수량</th>
              <th className="w-28 px-2 py-2 text-right font-medium">단가</th>
              <th className="w-32 px-2 py-2 text-right font-medium">금액</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {order.lines.map((line, index) => (
              <tr key={index} className="break-inside-avoid align-top">
                <td className="px-2 py-2 text-gray-950">
                  {line.name}
                  {line.description && (
                    <p className="mt-0.5 text-xs text-gray-500 whitespace-pre-line">{line.description}</p>
                  )}
                </td>
                <td className="px-2 py-2 text-right tabular-nums text-gray-600">{line.quantity.toLocaleString()}</td>
                <td className="px-2 py-2 text-right tabular-nums text-gray-600">{formatMoney(line.unitPrice, currency)}</td>
                <td className="px-2 py-2 text-right tabular-nums text-gray-950">{formatMoney(line.amount, currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <dl className="ml-auto mt-3 w-64 space-y-1 border-t border-gray-300 pt-3 text-sm break-inside-avoid">
          <div className="flex justify-between"><dt className="text-gray-500">공급가</dt><dd className="tabular-nums">{formatMoney(order.supplyAmount, currency)}</dd></div>
          <div className="flex justify-between"><dt className="text-gray-500">부가세</dt><dd className="tabular-nums">{formatMoney(order.vatAmount, currency)}</dd></div>
          <div className="flex justify-between border-t border-gray-200 pt-1 text-base font-bold"><dt>합계</dt><dd className="tabular-nums">{formatMoney(order.totalAmount, currency)}</dd></div>
        </dl>

        <p className="mt-10 text-xs text-gray-400">본 견적은 유효기간까지 유효하며, 행사 범위가 바뀌면 다시 견적합니다.</p>
      </article>
    </div>
  );
};
