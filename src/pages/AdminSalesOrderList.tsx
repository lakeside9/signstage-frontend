import { useEffect, useState } from 'react';
import type { FC, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { FileText, Plus } from 'lucide-react';
import { Button } from '../components/Button';
import { ListContainer } from '../components/ListContainer';
import { SearchBar, SearchField } from '../components/SearchBar';
import { usePermissionStore } from '../store/usePermissionStore';
import { useSnackbarStore } from '../store/useSnackbarStore';
import { api } from '../utils/api';
import { inputClass } from './billingCatalog/constants';
import { SalesOrderStatusBadge } from './order/components';
import { REGION_LABEL, SALES_ORDER_STATUS_LABEL, formatMoney, formatWallDateTime } from './order/constants';
import type { AdminSalesOrderSummary, PageResponse, SalesOrderStatus } from '../types';

const PAGE_SIZE = 20;

/**
 * 수주 관리(플랫폼 관리자) — 고객 견적부터 수주 확정·발주까지의 시작점(signstage-docs
 * business/platform-order-partner-subcontract-review.md 3장 업무 흐름). 목록의 예상 마진은
 * 견적 공급가에서 기본 단가표로 계산한 예상 발주 금액을 뺀 값이다.
 */
export const AdminSalesOrderList: FC = () => {
  const canManage = usePermissionStore((state) => state.hasPermission('ACTION_SALES_ORDER_MANAGE'));
  const showSnackbar = useSnackbarStore((state) => state.showSnackbar);

  const [statusFilter, setStatusFilter] = useState<'ALL' | SalesOrderStatus>('ALL');
  const [appliedStatus, setAppliedStatus] = useState<'ALL' | SalesOrderStatus>('ALL');
  const [page, setPage] = useState(0);
  const [pageData, setPageData] = useState<PageResponse<AdminSalesOrderSummary> | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const query = new URLSearchParams();
        if (appliedStatus !== 'ALL') query.set('status', appliedStatus);
        query.set('page', String(page));
        query.set('size', String(PAGE_SIZE));
        const response = await api.get(`/platform-admin/sales-orders?${query.toString()}`);
        if (!cancelled) setPageData(response.data as PageResponse<AdminSalesOrderSummary>);
      } catch (err) {
        if (!cancelled) showSnackbar(err instanceof Error ? err.message : '수주 목록을 불러오지 못했습니다.', 'error');
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

  const salesOrders = pageData?.content ?? [];

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-950 flex items-center gap-2">
            <FileText size={20} className="text-gray-400" />
            수주 관리
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            고객 견적을 만들고, 고객이 수락하면 파트너에게 발주합니다.
          </p>
        </div>
        {canManage && (
          <Button to="/admin/sales-orders/new">
            <Plus size={16} /> 견적 작성
          </Button>
        )}
      </div>

      <SearchBar onSubmit={handleSearch} onReset={handleReset}>
        <SearchField label="상태">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'ALL' | SalesOrderStatus)}
            className={`${inputClass} bg-white`}
          >
            <option value="ALL">전체</option>
            {Object.entries(SALES_ORDER_STATUS_LABEL).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </SearchField>
      </SearchBar>

      <ListContainer
        isLoading={isLoading}
        isEmpty={salesOrders.length === 0}
        emptyMessage="수주가 없습니다."
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
              <th className="text-left px-4 py-3 font-medium">고객</th>
              <th className="text-left px-4 py-3 font-medium">일시·권역</th>
              <th className="text-right px-4 py-3 font-medium">견적 공급가</th>
              <th className="text-right px-4 py-3 font-medium">예상 마진</th>
              <th className="text-left px-4 py-3 font-medium">상태</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {salesOrders.map((order) => (
              <tr key={order.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <Link to={`/admin/sales-orders/${order.id}`} className="text-gray-950 font-medium hover:underline">
                    {order.title}
                  </Link>
                </td>
                <td className="px-4 py-3 text-gray-500">{order.customerName}</td>
                <td className="px-4 py-3 text-gray-500">
                  {formatWallDateTime(order.startsAt)} · {REGION_LABEL[order.region]}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">{formatMoney(order.supplyAmount, order.currencyCode)}</td>
                <td className="px-4 py-3 text-right tabular-nums text-gray-500">
                  {formatMoney(order.supplyAmount - order.estimatedPartnerAmount, order.currencyCode)}
                </td>
                <td className="px-4 py-3">
                  <SalesOrderStatusBadge status={order.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </ListContainer>
    </div>
  );
};
