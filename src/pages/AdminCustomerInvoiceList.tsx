import { useEffect, useState } from 'react';
import type { FC, FormEvent } from 'react';
import { Wallet } from 'lucide-react';
import { ListContainer } from '../components/ListContainer';
import { SearchBar, SearchField } from '../components/SearchBar';
import { useSnackbarStore } from '../store/useSnackbarStore';
import { api } from '../utils/api';
import { inputClass } from './billingCatalog/constants';
import { INVOICE_STATUS_LABEL } from './order/constants';
import { InvoiceTable } from './order/invoiceComponents';
import type { CustomerInvoiceStatus, CustomerInvoiceSummary, PageResponse } from '../types';

const PAGE_SIZE = 20;

type StatusFilter = 'ALL' | 'OVERDUE' | CustomerInvoiceStatus;

/**
 * 청구·수납(플랫폼 관리자) — signstage-docs business/platform-order-partner-subcontract-review.md D12·D16.
 * 모든 수주의 선금·잔금 청구를 한 목록으로 보고 입금·세금계산서를 기록한다. "미수"는 입금 기한이
 * 지났는데 입금 기록이 없는 청구다. 청구 발행은 수주 상세에서 한다.
 */
export const AdminCustomerInvoiceList: FC = () => {
  const showSnackbar = useSnackbarStore((state) => state.showSnackbar);

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ISSUED');
  const [applied, setApplied] = useState<StatusFilter>('ISSUED');
  const [page, setPage] = useState(0);
  const [pageData, setPageData] = useState<PageResponse<CustomerInvoiceSummary> | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const query = new URLSearchParams();
        if (applied === 'OVERDUE') query.set('overdueOnly', 'true');
        else if (applied !== 'ALL') query.set('status', applied);
        query.set('page', String(page));
        query.set('size', String(PAGE_SIZE));
        query.set('sort', 'dueDate,asc');
        const response = await api.get(`/platform-admin/customer-invoices?${query.toString()}`);
        if (!cancelled) setPageData(response.data as PageResponse<CustomerInvoiceSummary>);
      } catch (err) {
        if (!cancelled) showSnackbar(err instanceof Error ? err.message : '청구 목록을 불러오지 못했습니다.', 'error');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [applied, page, showSnackbar]);

  const handleSearch = (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setPage(0);
    setApplied(statusFilter);
  };

  const handleReset = () => {
    setIsLoading(true);
    setStatusFilter('ISSUED');
    setPage(0);
    setApplied('ISSUED');
  };

  const invoices = pageData?.content ?? [];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-950 flex items-center gap-2">
          <Wallet size={20} className="text-gray-400" />
          청구·수납
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          고객에게 보낸 선금·잔금 청구와 입금 현황입니다. 청구는 수주 상세에서 발행합니다.
        </p>
      </div>

      <SearchBar onSubmit={handleSearch} onReset={handleReset}>
        <SearchField label="상태">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className={`${inputClass} bg-white`}
          >
            <option value="ALL">전체</option>
            <option value="OVERDUE">미수(기한 경과)</option>
            {Object.entries(INVOICE_STATUS_LABEL).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </SearchField>
      </SearchBar>

      <ListContainer
        isLoading={isLoading}
        isEmpty={invoices.length === 0}
        emptyMessage="청구가 없습니다."
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
        <InvoiceTable
          invoices={invoices}
          showSalesOrder
          onChanged={(updated) =>
            setPageData((current) =>
              current
                ? { ...current, content: current.content.map((invoice) => (invoice.id === updated.id ? updated : invoice)) }
                : current,
            )
          }
        />
      </ListContainer>
    </div>
  );
};
