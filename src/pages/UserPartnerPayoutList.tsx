import { useEffect, useState } from 'react';
import type { FC } from 'react';
import { useParams } from 'react-router-dom';
import { Banknote } from 'lucide-react';
import { ListContainer } from '../components/ListContainer';
import { Modal } from '../components/Modal';
import { useSnackbarStore } from '../store/useSnackbarStore';
import { api } from '../utils/api';
import { DetailRow } from './billingCatalog/components';
import { CompensationTable, OffsetTable, PartnerLedgerTable, PayoutItemsTable, PayoutStatusBadge } from './order/components';
import { formatMoney } from './order/constants';
import type { PageResponse, PartnerLedger, PartnerPayoutDetail, PartnerPayoutSummary } from '../types';

const PAGE_SIZE = 20;

/**
 * 지급 내역(파트너) — signstage-docs business/platform-order-partner-subcontract-review.md D11·D12.
 * 검수 승인된 발주는 승인월 단위로 합산해 다음 달 말일까지 지급된다. 금액은 공급가이고, 실제 이체
 * 금액(부가세 등 반영)은 지급 완료 후 보인다. 미지급 잔액은 승인됐지만 아직 지급되지 않은 금액이다.
 */
export const UserPartnerPayoutList: FC = () => {
  const { organizationId } = useParams<{ organizationId: string }>();
  const showSnackbar = useSnackbarStore((state) => state.showSnackbar);

  const [page, setPage] = useState(0);
  const [pageData, setPageData] = useState<PageResponse<PartnerPayoutSummary> | null>(null);
  const [ledger, setLedger] = useState<PartnerLedger | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [detail, setDetail] = useState<PartnerPayoutDetail | null>(null);

  const basePath = `/organizations/${organizationId}/partner-payouts`;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [payoutResponse, ledgerResponse] = await Promise.all([
          api.get(`${basePath}?page=${page}&size=${PAGE_SIZE}&sort=id,desc`),
          api.get(`${basePath}/ledger?size=10`),
        ]);
        if (!cancelled) {
          setPageData(payoutResponse.data as PageResponse<PartnerPayoutSummary>);
          setLedger(ledgerResponse.data as PartnerLedger);
        }
      } catch (err) {
        if (!cancelled) showSnackbar(err instanceof Error ? err.message : '지급 내역을 불러오지 못했습니다.', 'error');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [basePath, page, showSnackbar]);

  const openDetail = async (payoutId: number) => {
    try {
      const response = await api.get(`${basePath}/${payoutId}`);
      setDetail(response.data as PartnerPayoutDetail);
    } catch (err) {
      showSnackbar(err instanceof Error ? err.message : '지급 상세를 불러오지 못했습니다.', 'error');
    }
  };

  const payouts = pageData?.content ?? [];
  const summary = detail?.summary;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-950 flex items-center gap-2">
          <Banknote size={20} className="text-gray-400" />
          지급 내역
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          검수 승인된 발주는 승인월 단위로 합산해 다음 달 말일까지 지급됩니다. 귀책 상계가 있으면 지급액에서 빼고,
          넘는 금액은 다음 지급에서 뺍니다. 금액은 공급가(부가세 별도)입니다.
        </p>
      </div>

      {ledger && (
        <section className="mb-6 bg-white border border-gray-200 rounded-lg p-4">
          <h2 className="text-sm font-bold text-gray-950 mb-2">원장(최근 10건)</h2>
          <PartnerLedgerTable ledger={ledger} />
        </section>
      )}

      <ListContainer
        isLoading={isLoading}
        isEmpty={payouts.length === 0}
        emptyMessage="지급 내역이 없습니다."
        pagination={
          pageData
            ? {
                page: pageData.page,
                totalPages: pageData.totalPages,
                hasNext: pageData.hasNext,
                totalElements: pageData.totalElements,
                onPageChange: (nextPage) => {
                  setIsLoading(true);
                  setPage(nextPage);
                },
              }
            : undefined
        }
      >
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-3 font-medium">승인월</th>
              <th className="text-right px-4 py-3 font-medium">지급액(공급가)</th>
              <th className="text-left px-4 py-3 font-medium">지급 기한</th>
              <th className="text-left px-4 py-3 font-medium">상태</th>
              <th className="text-right px-4 py-3 font-medium">이체 금액</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {payouts.map((payout) => (
              <tr key={payout.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => openDetail(payout.id)}>
                <td className="px-4 py-3 text-gray-950 font-medium">{payout.settlementMonth}</td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {formatMoney(payout.amount, payout.currencyCode)}
                  {payout.offsetAmount > 0 && (
                    <p className="text-xs text-gray-400">상계 {formatMoney(-payout.offsetAmount, payout.currencyCode)}</p>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-500">{payout.dueDate}</td>
                <td className="px-4 py-3">
                  <PayoutStatusBadge status={payout.status} />
                  {payout.paidDate && <p className="text-xs text-gray-400">{payout.paidDate} 지급</p>}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {payout.transferredAmount !== null ? formatMoney(payout.transferredAmount, payout.currencyCode) : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </ListContainer>

      <Modal open={detail !== null} onClose={() => setDetail(null)} title="지급 상세" widthClassName="max-w-3xl">
        {detail && summary && (
          <div className="space-y-4">
            <section className="border border-gray-200 rounded-lg divide-y divide-gray-100">
              <DetailRow label="승인월" value={summary.settlementMonth} />
              <DetailRow label="상태" value={<PayoutStatusBadge status={summary.status} />} />
              <DetailRow label="검수 합계(공급가)" value={formatMoney(summary.grossAmount, summary.currencyCode)} />
              {summary.offsetAmount > 0 && (
                <DetailRow label="귀책 상계" value={formatMoney(-summary.offsetAmount, summary.currencyCode)} />
              )}
              <DetailRow label="지급액(공급가)" value={formatMoney(summary.amount, summary.currencyCode)} />
              <DetailRow label="지급 기한" value={summary.dueDate} />
              <DetailRow
                label="정산 계좌"
                value={summary.bankName ? `${summary.bankName} ${summary.bankAccountNumber ?? ''}` : '미등록'}
              />
              {summary.paidDate && (
                <DetailRow
                  label="지급"
                  value={`${summary.paidDate} · 이체 ${formatMoney(summary.transferredAmount, summary.currencyCode)}${summary.paymentMemo ? ` · ${summary.paymentMemo}` : ''}`}
                />
              )}
              {summary.cancellationReason && <DetailRow label="취소 사유" value={summary.cancellationReason} />}
            </section>
            {detail.items.length > 0 && (
              <PayoutItemsTable
                items={detail.items}
                linkTo={(item) => `/partner-orders/${organizationId}/${item.partnerOrderId}`}
              />
            )}
            {detail.offsets.length > 0 && (
              <section>
                <h3 className="text-sm font-bold text-gray-950 mb-1">반영된 귀책 상계</h3>
                <OffsetTable offsets={detail.offsets} />
              </section>
            )}
            {detail.compensations.length > 0 && (
              <section>
                <h3 className="text-sm font-bold text-gray-950 mb-1">더한 취소 보상</h3>
                <CompensationTable compensations={detail.compensations} currencyCode={summary.currencyCode} />
              </section>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};
