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
  CATALOG_PAGE_SIZE,
  UNIT_PRODUCT_CATEGORY_LABEL,
  UNIT_PRODUCT_TYPE_LABEL,
  UNIT_PRODUCT_TYPE_OPTIONS,
  formatPrice,
  formatSupplyPrice,
} from './billingCatalog/constants';
import type { UnitProductSummary, UnitProductType } from '../types';

const TYPE_OPTIONS: Array<{ value: UnitProductType | 'ALL'; label: string }> = [
  { value: 'ALL', label: '전체' },
  ...UNIT_PRODUCT_TYPE_OPTIONS,
];

/**
 * 단위 상품 목록 — 옛 선택옵션/용량 추가구매 목록 2개를 통합했다(signstage-docs
 * business/billing-catalog-unit-product-model-redesign-review.md 결정, 2026-09-10).
 * `AdminBillingPlanList.tsx`와 같은 구조(검색 → 목록 → 페이지네비게이션, 클라이언트 사이드
 * 검색/페이지네이션 — 글로벌 카탈로그라 서버 페이지네이션이 없다). 단위 상품은 할인이 없어
 * "예상 최종가" 열이 없다.
 */
export const AdminUnitProductList: FC = () => {
  const [products, setProducts] = useState<UnitProductSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [nameDraft, setNameDraft] = useState('');
  const [typeDraft, setTypeDraft] = useState<UnitProductType | 'ALL'>('ALL');
  const [nameQuery, setNameQuery] = useState('');
  const [typeQuery, setTypeQuery] = useState<UnitProductType | 'ALL'>('ALL');
  const [page, setPage] = useState(0);

  const canManage = usePermissionStore((state) => state.hasPermission('ACTION_BILLING_CATALOG_MANAGE'));
  const showSnackbar = useSnackbarStore((state) => state.showSnackbar);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await api.get('/unit-products');
        if (!cancelled) setProducts(response.data as UnitProductSummary[]);
      } catch (err) {
        if (!cancelled) showSnackbar(err instanceof Error ? err.message : '단위 상품 목록을 불러오지 못했습니다.', 'error');
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
    setNameQuery(nameDraft.trim());
    setTypeQuery(typeDraft);
  };

  const handleReset = () => {
    setPage(0);
    setNameDraft('');
    setTypeDraft('ALL');
    setNameQuery('');
    setTypeQuery('ALL');
  };

  const filtered = products.filter(
    (p) => (!nameQuery || p.name.toLowerCase().includes(nameQuery.toLowerCase())) && (typeQuery === 'ALL' || p.type === typeQuery),
  );
  const totalElements = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalElements / CATALOG_PAGE_SIZE));
  const pageItems = filtered.slice(page * CATALOG_PAGE_SIZE, (page + 1) * CATALOG_PAGE_SIZE);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-950 flex items-center gap-2">
            <Boxes size={20} className="text-gray-400" />
            단위 상품
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            행사 과금 카탈로그의 단위 상품(필수/장비/인력/애플리케이션)입니다. 등록/수정은 PLATFORM_OPS 이상만 할 수 있습니다.
          </p>
        </div>
        {canManage && (
          <Button to="/admin/billing-catalog/unit-products/new">
            <Plus size={16} />
            새로 만들기
          </Button>
        )}
      </div>

      <SearchBar onSubmit={handleSearch} onReset={handleReset}>
        <SearchField label="이름" className="w-56">
          <input
            type="text"
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            placeholder="단위 상품 이름"
            className="w-full px-3 py-1.5 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-gray-950/10 focus:border-gray-400 outline-none transition-all"
          />
        </SearchField>
        <SearchField label="종류">
          <select
            value={typeDraft}
            onChange={(e) => setTypeDraft(e.target.value as UnitProductType | 'ALL')}
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
        emptyMessage="해당 조건의 단위 상품이 없습니다."
        pagination={{ page, totalPages, hasNext: page < totalPages - 1, totalElements, onPageChange: setPage }}
      >
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-3 font-medium">종류</th>
              <th className="text-left px-4 py-3 font-medium">이름</th>
              <th className="text-left px-4 py-3 font-medium">분류</th>
              <th className="text-left px-4 py-3 font-medium">배타 그룹</th>
              <th className="text-left px-4 py-3 font-medium">공급가/판매가</th>
              <th className="text-left px-4 py-3 font-medium">상태</th>
              <th className="text-right px-4 py-3 font-medium">사용 건수</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {pageItems.map((product) => (
              <tr key={product.id}>
                <td className="px-4 py-3 text-gray-600">{UNIT_PRODUCT_TYPE_LABEL[product.type] ?? product.type}</td>
                <td className="px-4 py-3 font-medium">
                  <Link to={`/admin/billing-catalog/unit-products/${product.id}`} className="text-gray-950 hover:underline">
                    {product.name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-gray-600">{UNIT_PRODUCT_CATEGORY_LABEL[product.category] ?? product.category}</td>
                <td className="px-4 py-3 text-gray-500">{product.exclusivityGroup ?? '—'}</td>
                <td className="px-4 py-3 text-gray-600">
                  {product.salePrice === null
                    ? '-'
                    : `${formatSupplyPrice(product.supplyPrice, product.currencyCode ?? 'KRW')} / ${formatPrice(product.salePrice, product.currencyCode ?? 'KRW')}`}
                </td>
                <td className="px-4 py-3">
                  <PeriodStatusBadge status={product.periodStatus} />
                </td>
                <td className="px-4 py-3 text-right text-gray-500">{product.usageCount}건</td>
              </tr>
            ))}
          </tbody>
        </table>
      </ListContainer>
    </div>
  );
};
