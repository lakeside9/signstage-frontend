import { useEffect, useState } from 'react';
import type { FC } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Inbox } from 'lucide-react';
import { ListContainer } from '../components/ListContainer';
import { useSnackbarStore } from '../store/useSnackbarStore';
import { api } from '../utils/api';
import { inputClass } from './billingCatalog/constants';
import { PartnerOrderStatusBadge } from './order/components';
import { PARTNER_ORDER_STATUS_LABEL, REGION_LABEL, formatDueHour, formatMoney, formatSchedule } from './order/constants';
import type { PageResponse, PartnerOrderStatus, PartnerOrderSummary } from '../types';

const PAGE_SIZE = 20;

/**
 * 발주함(파트너 OWNER·ADMIN) — 플랫폼이 보낸 행사 수행 발주 목록(signstage-docs
 * business/platform-order-partner-subcontract-review.md D04). 응답 기한 안에 수락하면 행사가
 * 만들어진다.
 */
export const UserPartnerOrderList: FC = () => {
  const { organizationId } = useParams<{ organizationId: string }>();
  const showSnackbar = useSnackbarStore((state) => state.showSnackbar);

  const [status, setStatus] = useState<'ALL' | PartnerOrderStatus>('ALL');
  const [page, setPage] = useState(0);
  const [pageData, setPageData] = useState<PageResponse<PartnerOrderSummary> | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const query = new URLSearchParams();
        if (status !== 'ALL') query.set('status', status);
        query.set('page', String(page));
        query.set('size', String(PAGE_SIZE));
        const response = await api.get(`/organizations/${organizationId}/partner-orders?${query.toString()}`);
        if (!cancelled) setPageData(response.data as PageResponse<PartnerOrderSummary>);
      } catch (err) {
        if (!cancelled) showSnackbar(err instanceof Error ? err.message : '발주 목록을 불러오지 못했습니다.', 'error');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [organizationId, status, page, showSnackbar]);

  const partnerOrders = pageData?.content ?? [];

  return (
    <div>
      <div className="mb-6 flex items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-950 flex items-center gap-2">
            <Inbox size={20} className="text-gray-400" />
            발주함
          </h1>
          <p className="mt-1 text-sm text-gray-500">플랫폼이 맡긴 행사 수행 요청입니다. 응답 기한 안에 수락하거나 거절해주세요.</p>
        </div>
        <select
          value={status}
          onChange={(e) => {
            setIsLoading(true);
            setPage(0);
            setStatus(e.target.value as 'ALL' | PartnerOrderStatus);
          }}
          className={`${inputClass} bg-white w-36`}
        >
          <option value="ALL">전체 상태</option>
          {Object.entries(PARTNER_ORDER_STATUS_LABEL).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>

      <ListContainer
        isLoading={isLoading}
        isEmpty={partnerOrders.length === 0}
        emptyMessage="받은 발주가 없습니다."
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
              <th className="text-left px-4 py-3 font-medium">행사</th>
              <th className="text-left px-4 py-3 font-medium">일정</th>
              <th className="text-left px-4 py-3 font-medium">권역·장소</th>
              <th className="text-right px-4 py-3 font-medium">발주 금액</th>
              <th className="text-left px-4 py-3 font-medium">응답 기한</th>
              <th className="text-left px-4 py-3 font-medium">상태</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {partnerOrders.map((po) => (
              <tr key={po.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <Link to={`/partner-orders/${organizationId}/${po.id}`} className="text-gray-950 font-medium hover:underline">
                    {po.title}
                  </Link>
                </td>
                <td className="px-4 py-3 text-gray-500">{formatSchedule(po.startsAt, po.endsAt)}</td>
                <td className="px-4 py-3 text-gray-500">{REGION_LABEL[po.region]} · {po.location ?? '장소 미정'}</td>
                <td className="px-4 py-3 text-right tabular-nums">{formatMoney(po.totalAmount, po.currencyCode)}</td>
                <td className="px-4 py-3 text-gray-500">{formatDueHour(po.responseDueAt)}</td>
                <td className="px-4 py-3"><PartnerOrderStatusBadge status={po.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </ListContainer>
    </div>
  );
};
