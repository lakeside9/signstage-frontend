import { useEffect, useState } from 'react';
import type { FC, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDown, ArrowUp, Boxes, Plus } from 'lucide-react';
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
import type { UnitProductSummary, UnitProductType, UpdateDisplayOrdersRequest } from '../types';

const TYPE_OPTIONS: Array<{ value: UnitProductType | 'ALL'; label: string }> = [
  { value: 'ALL', label: '전체' },
  ...UNIT_PRODUCT_TYPE_OPTIONS,
];

/** 위/아래 이동 후 배열을 그대로 PUT .../display-orders 요청 본문으로 바꾼다 — 인덱스가 곧 새 displayOrder다(UserCeremonyDetail.tsx와 같은 패턴). */
const toDisplayOrderItems = (items: Array<{ id: number }>): UpdateDisplayOrdersRequest => ({
  items: items.map((item, index) => ({ id: item.id, displayOrder: index })),
});

/**
 * 단위 상품 목록 — 옛 선택옵션/용량 추가구매 목록 2개를 통합했다(signstage-docs
 * business/billing-catalog-unit-product-model-redesign-review.md 결정, 2026-09-10).
 * `AdminBillingPlanList.tsx`와 같은 구조(검색 → 목록 → 페이지네비게이션, 클라이언트 사이드
 * 검색/페이지네이션 — 글로벌 카탈로그라 서버 페이지네이션이 없다). 단위 상품은 할인이 없어
 * "예상 최종가" 열이 없다.
 *
 * <p>위/아래 순서 이동(2026-09-10, 사용자 요청)은 전체 목록이 한 화면에 그대로 보일 때만
 * 켠다(검색/종류 필터가 없고 페이지가 1개뿐일 때) — 필터·페이지로 잘린 부분집합 안에서만
 * 인덱스를 다시 매기면 화면에 없는 나머지 상품들과의 순서가 어긋나기 때문이다.
 */
export const AdminUnitProductList: FC = () => {
  const [products, setProducts] = useState<UnitProductSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [nameDraft, setNameDraft] = useState('');
  const [typeDraft, setTypeDraft] = useState<UnitProductType | 'ALL'>('ALL');
  const [nameQuery, setNameQuery] = useState('');
  const [typeQuery, setTypeQuery] = useState<UnitProductType | 'ALL'>('ALL');
  const [page, setPage] = useState(0);
  const [isReordering, setIsReordering] = useState(false);

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

  // 필터/페이지로 잘리지 않은 전체 목록을 보고 있을 때만 순서 이동을 켠다(클래스 주석 참고).
  const canReorder = canManage && nameQuery === '' && typeQuery === 'ALL' && totalPages === 1;

  const moveProduct = async (productId: number, direction: -1 | 1) => {
    if (isReordering) return;
    const index = products.findIndex((p) => p.id === productId);
    const targetIndex = index + direction;
    if (index < 0 || targetIndex < 0 || targetIndex >= products.length) return;

    const previous = products;
    const next = [...products];
    [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
    setProducts(next);
    setIsReordering(true);
    try {
      const response = await api.put('/platform-admin/unit-products/display-orders', toDisplayOrderItems(next));
      setProducts(response.data as UnitProductSummary[]);
    } catch (err) {
      setProducts(previous);
      showSnackbar(err instanceof Error ? err.message : '단위 상품 순서 저장에 실패했습니다.', 'error');
    } finally {
      setIsReordering(false);
    }
  };

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
              {canManage && <th className="text-left px-4 py-3 font-medium w-20">순서</th>}
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
            {pageItems.map((product, index) => (
              <tr key={product.id}>
                {canManage && (
                  <td className="px-4 py-3">
                    <div className="inline-flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => moveProduct(product.id, -1)}
                        disabled={!canReorder || isReordering || index === 0}
                        title={canReorder ? '위로 이동' : '검색/필터를 초기화해야 순서를 바꿀 수 있습니다'}
                        className="p-1 rounded-md border border-gray-200 text-gray-500 hover:border-gray-400 disabled:opacity-30"
                      >
                        <ArrowUp size={12} />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveProduct(product.id, 1)}
                        disabled={!canReorder || isReordering || index === pageItems.length - 1}
                        title={canReorder ? '아래로 이동' : '검색/필터를 초기화해야 순서를 바꿀 수 있습니다'}
                        className="p-1 rounded-md border border-gray-200 text-gray-500 hover:border-gray-400 disabled:opacity-30"
                      >
                        <ArrowDown size={12} />
                      </button>
                    </div>
                  </td>
                )}
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
