import { useEffect, useState } from 'react';
import type { FC, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Boxes, Plus } from 'lucide-react';
import { Button } from '../components/Button';
import { ListContainer } from '../components/ListContainer';
import { SearchBar, SearchField } from '../components/SearchBar';
import { usePermissionStore } from '../store/usePermissionStore';
import { useSnackbarStore } from '../store/useSnackbarStore';
import { api } from '../utils/api';
import { PeriodStatusBadge } from './billingCatalog/components';
import {
  CAPACITY_TYPE_CATEGORY,
  CAPACITY_TYPE_LABEL,
  CAPACITY_TYPE_OPTIONS,
  CATALOG_PAGE_SIZE,
  calculateFinalPrice,
  formatDiscount,
  formatPrice,
  formatSupplyPrice,
  OPTIONAL_FEATURE_CATEGORY_LABEL,
} from './billingCatalog/constants';
import type { CapacityAddOnSummary, CapacityType } from '../types';

const TYPE_OPTIONS: Array<{ value: CapacityType | 'ALL'; label: string }> = [
  { value: 'ALL', label: '전체' },
  ...CAPACITY_TYPE_OPTIONS,
];

/** 용량 추가구매 상품 목록 — AdminBillingPlanList.tsx와 같은 구조. 상품에 별도 "이름" 필드가
 * 없어(종류+수량으로 라벨을 만든다) 검색은 "종류" 선택으로 한다. */
export const AdminCapacityAddOnList: FC = () => {
  const [addOns, setAddOns] = useState<CapacityAddOnSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [typeDraft, setTypeDraft] = useState<CapacityType | 'ALL'>('ALL');
  const [typeQuery, setTypeQuery] = useState<CapacityType | 'ALL'>('ALL');
  const [page, setPage] = useState(0);

  const canManage = usePermissionStore((state) => state.hasPermission('ACTION_BILLING_CATALOG_MANAGE'));
  const showSnackbar = useSnackbarStore((state) => state.showSnackbar);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await api.get('/capacity-addons');
        if (!cancelled) setAddOns(response.data as CapacityAddOnSummary[]);
      } catch (err) {
        if (!cancelled) showSnackbar(err instanceof Error ? err.message : '용량 추가구매 상품 목록을 불러오지 못했습니다.', 'error');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSearch = (e: FormEvent) => {
    e.preventDefault();
    setPage(0);
    setTypeQuery(typeDraft);
  };

  const handleReset = () => {
    setPage(0);
    setTypeDraft('ALL');
    setTypeQuery('ALL');
  };

  const filtered = typeQuery === 'ALL' ? addOns : addOns.filter((a) => a.capacityType === typeQuery || a.secondaryCapacityType === typeQuery);
  const totalElements = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalElements / CATALOG_PAGE_SIZE));
  const pageItems = filtered.slice(page * CATALOG_PAGE_SIZE, (page + 1) * CATALOG_PAGE_SIZE);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-950 flex items-center gap-2">
            <Boxes size={20} className="text-gray-400" />
            용량 추가구매 상품
          </h1>
          <p className="mt-1 text-sm text-gray-500">행사 용량 추가구매 상품 카탈로그입니다. 등록/수정은 PLATFORM_OPS 이상만 할 수 있습니다.</p>
        </div>
        {canManage && (
          <Button to="/admin/billing-catalog/capacity-addons/new">
            <Plus size={16} />
            새로 만들기
          </Button>
        )}
      </div>

      <SearchBar onSubmit={handleSearch} onReset={handleReset}>
        <SearchField label="종류">
          <select
            value={typeDraft}
            onChange={(e) => setTypeDraft(e.target.value as CapacityType | 'ALL')}
            className="px-3 py-1.5 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-gray-950/10 focus:border-gray-400 outline-none transition-all bg-white"
          >
            {TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </SearchField>
      </SearchBar>

      <ListContainer
        isLoading={isLoading}
        isEmpty={pageItems.length === 0}
        emptyMessage="해당 조건의 용량 추가구매 상품이 없습니다."
        pagination={{ page, totalPages, hasNext: page < totalPages - 1, totalElements, onPageChange: setPage }}
      >
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-3 font-medium">종류</th>
              <th className="text-left px-4 py-3 font-medium">카테고리</th>
              <th className="text-left px-4 py-3 font-medium">단위 수량</th>
              <th className="text-left px-4 py-3 font-medium">공급가/판매가</th>
              <th className="text-left px-4 py-3 font-medium">할인</th>
              <th className="text-left px-4 py-3 font-medium">예상 최종가</th>
              <th className="text-left px-4 py-3 font-medium">상태</th>
              <th className="text-right px-4 py-3 font-medium">사용 건수</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {pageItems.map((addOn) => (
              <tr key={addOn.id}>
                <td className="px-4 py-3 font-medium">
                  <Link to={`/admin/billing-catalog/capacity-addons/${addOn.id}`} className="text-gray-950 hover:underline">
                    {CAPACITY_TYPE_LABEL[addOn.capacityType] ?? addOn.capacityType}
                    {addOn.secondaryCapacityType && ` + ${CAPACITY_TYPE_LABEL[addOn.secondaryCapacityType] ?? addOn.secondaryCapacityType}`}
                  </Link>
                </td>
                <td className="px-4 py-3 text-gray-500">
                  {CAPACITY_TYPE_CATEGORY[addOn.capacityType]
                    ? OPTIONAL_FEATURE_CATEGORY_LABEL[CAPACITY_TYPE_CATEGORY[addOn.capacityType]!]
                    : '-'}
                </td>
                <td className="px-4 py-3 text-gray-600">
                  +{addOn.unitAmount}
                  {addOn.secondaryCapacityType && addOn.secondaryUnitAmount != null && ` / +${addOn.secondaryUnitAmount}`}
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {addOn.salePrice === null
                    ? '-'
                    : `${formatSupplyPrice(addOn.supplyPrice, addOn.currencyCode ?? 'KRW')} / ${formatPrice(addOn.salePrice, addOn.currencyCode ?? 'KRW')}`}
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {addOn.discountType === null || addOn.discountValue === null ? '-' : formatDiscount(addOn.discountType, addOn.discountValue)}
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {addOn.salePrice === null || addOn.discountType === null || addOn.discountValue === null
                    ? '-'
                    : formatPrice(calculateFinalPrice(addOn.salePrice, addOn.discountType, addOn.discountValue), addOn.currencyCode ?? 'KRW')}
                </td>
                <td className="px-4 py-3">
                  <PeriodStatusBadge status={addOn.periodStatus} />
                </td>
                <td className="px-4 py-3 text-right text-gray-500">{addOn.usageCount}건</td>
              </tr>
            ))}
          </tbody>
        </table>
      </ListContainer>
    </div>
  );
};
