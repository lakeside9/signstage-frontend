import { useEffect, useState } from 'react';
import type { FC, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Send } from 'lucide-react';
import { ListContainer } from '../components/ListContainer';
import { SearchBar, SearchField } from '../components/SearchBar';
import { useSnackbarStore } from '../store/useSnackbarStore';
import { api } from '../utils/api';
import { formatDateTime } from '../utils/internationalization';
import { inputClass } from './billingCatalog/constants';
import { PartnerOrderStatusBadge } from './order/components';
import { PARTNER_ORDER_STATUS_LABEL, formatDueHour, formatMoney } from './order/constants';
import type { AdminPartnerOrderSummary, PageResponse, PartnerOrderStatus } from '../types';

const PAGE_SIZE = 20;

/**
 * 발주 현황(플랫폼 관리자) — 모든 수주의 파트너 발주를 한 목록으로 본다(signstage-docs
 * business/platform-order-partner-subcontract-review.md D04·D05). 발급·취소는 수주 상세에서 한다.
 * 응답 기한이 지난 응답 대기 발주는 "기한 만료"로 보인다.
 */
export const AdminPartnerOrderList: FC = () => {
  const showSnackbar = useSnackbarStore((state) => state.showSnackbar);

  const [statusFilter, setStatusFilter] = useState<'ALL' | PartnerOrderStatus>('ALL');
  const [appliedStatus, setAppliedStatus] = useState<'ALL' | PartnerOrderStatus>('ALL');
  const [page, setPage] = useState(0);
  const [pageData, setPageData] = useState<PageResponse<AdminPartnerOrderSummary> | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const query = new URLSearchParams();
        if (appliedStatus !== 'ALL') query.set('status', appliedStatus);
        query.set('page', String(page));
        query.set('size', String(PAGE_SIZE));
        const response = await api.get(`/platform-admin/partner-orders?${query.toString()}`);
        if (!cancelled) setPageData(response.data as PageResponse<AdminPartnerOrderSummary>);
      } catch (err) {
        if (!cancelled) showSnackbar(err instanceof Error ? err.message : '발주 목록을 불러오지 못했습니다.', 'error');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [appliedStatus, page, showSnackbar]);

  const handleSearch = (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setPage(0);
    setAppliedStatus(statusFilter);
  };

  const handleReset = () => {
    setIsLoading(true);
    setStatusFilter('ALL');
    setPage(0);
    setAppliedStatus('ALL');
  };

  const partnerOrders = pageData?.content ?? [];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-950 flex items-center gap-2">
          <Send size={20} className="text-gray-400" />
          발주 현황
        </h1>
        <p className="mt-1 text-sm text-gray-500">파트너에게 보낸 발주와 응답 상태입니다. 발주·취소는 수주 상세에서 합니다.</p>
      </div>

      <SearchBar onSubmit={handleSearch} onReset={handleReset}>
        <SearchField label="상태">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'ALL' | PartnerOrderStatus)}
            className={`${inputClass} bg-white`}
          >
            <option value="ALL">전체</option>
            {Object.entries(PARTNER_ORDER_STATUS_LABEL).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </SearchField>
      </SearchBar>

      <ListContainer
        isLoading={isLoading}
        isEmpty={partnerOrders.length === 0}
        emptyMessage="발주가 없습니다."
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
              <th className="text-left px-4 py-3 font-medium">수주</th>
              <th className="text-left px-4 py-3 font-medium">파트너</th>
              <th className="text-right px-4 py-3 font-medium">발주 금액</th>
              <th className="text-left px-4 py-3 font-medium">발급</th>
              <th className="text-left px-4 py-3 font-medium">응답 기한</th>
              <th className="text-left px-4 py-3 font-medium">상태</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {partnerOrders.map((po) => (
              <tr key={po.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <Link to={`/admin/sales-orders/${po.salesOrderId}`} className="text-gray-950 font-medium hover:underline">
                    {po.salesOrderTitle}
                  </Link>
                </td>
                <td className="px-4 py-3 text-gray-500">{po.organizationName}</td>
                <td className="px-4 py-3 text-right tabular-nums">{formatMoney(po.totalAmount, po.currencyCode)}</td>
                <td className="px-4 py-3 text-gray-500">{formatDateTime(po.issuedAt)}</td>
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
